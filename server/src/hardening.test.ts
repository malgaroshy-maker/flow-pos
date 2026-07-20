import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

let app: ReturnType<typeof buildApp>;
let managerToken: string;
let salesToken: string;

async function login(username: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token;
}

async function createProduct(overrides: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { authorization: `Bearer ${managerToken}` },
    payload: {
      name: 'منتج اختبار',
      type: 'consumable',
      category: 'اختبار',
      baseUnit: 'قطعة',
      costPrice: 10000,
      retailPrice: 20000,
      wholesalePrice: 15000,
      quantity: 50,
      reorderPoint: 5,
      ...overrides,
    },
  });
  expect(res.statusCode).toBe(200);
  return res.json();
}

async function openShift(openingCash = 100000) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers: { authorization: `Bearer ${salesToken}` },
    payload: { openingCash },
  });
  expect(res.statusCode).toBe(200);
  return res.json();
}

beforeEach(async () => {
  const sqlite = openDatabase(':memory:');
  runMigrations(sqlite);
  seed(sqlite);
  app = buildApp(sqlite);
  managerToken = await login('مدير', 'admin');
  salesToken = await login('بائع', 'sales');
});

afterEach(async () => {
  await app.close();
});

describe('input validation', () => {
  it('rejects a negative discount', async () => {
    const product = await createProduct();
    await openShift();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 20000 }],
        discount: -5000,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_discount');
  });

  it('rejects a discount larger than the subtotal', async () => {
    const product = await createProduct();
    await openShift();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 20000 }],
        discount: 999999,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('discount_exceeds_subtotal');
  });

  it('rejects fractional and negative quantities/amounts', async () => {
    const product = await createProduct();
    await openShift();

    const fractional = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1.5, unitPrice: 20000 }],
        discount: 0,
      },
    });
    expect(fractional.statusCode).toBe(400);

    const negativeExpense = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { amount: -50000, reason: 'اختبار', category: 'اختبار' },
    });
    expect(negativeExpense.statusCode).toBe(400);

    const floatExpense = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { amount: 50.5, reason: 'اختبار', category: 'اختبار' },
    });
    expect(floatExpense.statusCode).toBe(400);
  });
});

describe('server-authoritative pricing', () => {
  it('rejects a sales-role sale at a price different from the product retail price', async () => {
    const product = await createProduct({ retailPrice: 20000 });
    await openShift();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 1 }],
        discount: 0,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('price_not_allowed');
  });

  it('allows a custom price with a manager PIN override and flags it in the audit log', async () => {
    const product = await createProduct({ retailPrice: 20000 });
    await openShift();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 18000 }],
        discount: 0,
        overridePin: '1111',
      },
    });
    expect(res.statusCode).toBe(200);

    const logs = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    const actions = logs.json().map((l: any) => l.action);
    expect(actions).toContain('price_override_sale');
  });
});

describe('stock overrides are always audited', () => {
  it('flags a manager selling beyond available stock', async () => {
    const product = await createProduct({ quantity: 1 });
    await openShift();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 5, unitPrice: 20000 }],
        discount: 0,
      },
    });
    expect(res.statusCode).toBe(200);

    const logs = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    const actions = logs.json().map((l: any) => l.action);
    expect(actions).toContain('stock_override_sale');
  });
});

describe('backup endpoints are manager-only', () => {
  it('rejects the sales role on backup create, list, and restore', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/backup',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(create.statusCode).toBe(403);
    expect(create.json().error).toBe('forbidden');

    const list = await app.inject({
      method: 'GET',
      url: '/api/backup/list',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(list.statusCode).toBe(403);

    const restore = await app.inject({
      method: 'POST',
      url: '/api/backup/restore',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { filename: 'pos_backup_x.db' },
    });
    expect(restore.statusCode).toBe(403);
  });

  it('allows the manager through the gate', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/backup/list',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json())).toBe(true);
  });
});

describe('receivables and drawer integrity', () => {
  it('rejects overpayment of a customer debt', async () => {
    const product = await createProduct();
    await openShift();

    const custRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { name: 'عميل اختبار' },
    });
    const customer = custRes.json();

    await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 20000 }],
        discount: 0,
        paymentType: 'credit',
        customerId: customer.id,
      },
    });

    const overpay = await app.inject({
      method: 'POST',
      url: `/api/customers/${customer.id}/payment`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { amount: 999999 },
    });
    expect(overpay.statusCode).toBe(400);
    expect(overpay.json().error).toBe('overpayment');
  });

  it('rejects a customer cash payment when no shift is open', async () => {
    const custRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { name: 'عميل بدون توكة' },
    });
    const customer = custRes.json();

    const res = await app.inject({
      method: 'POST',
      url: `/api/customers/${customer.id}/payment`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { amount: 1000 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('no_active_shift');
  });

  it('rejects a paid purchase when no shift is open, accepts it as debt', async () => {
    const product = await createProduct();

    const paidNoShift = await app.inject({
      method: 'POST',
      url: '/api/purchases',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 10, unitCost: 9000 }],
        paid: 90000,
      },
    });
    expect(paidNoShift.statusCode).toBe(400);
    expect(paidNoShift.json().error).toBe('no_active_shift');

    const debtNoShift = await app.inject({
      method: 'POST',
      url: '/api/purchases',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 10, unitCost: 9000 }],
        paid: 0,
      },
    });
    expect(debtNoShift.statusCode).toBe(200);
    expect(debtNoShift.json().status).toBe('pending');
  });

  it('keeps the cancelled credit invoice honest: balance may go negative after payment', async () => {
    const product = await createProduct();
    await openShift();

    const custRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { name: 'عميل إلغاء' },
    });
    const customer = custRes.json();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 20000 }],
        discount: 0,
        paymentType: 'credit',
        customerId: customer.id,
      },
    });
    const sale = saleRes.json();

    // Customer pays the full debt, then the invoice is cancelled.
    await app.inject({
      method: 'POST',
      url: `/api/customers/${customer.id}/payment`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { amount: 20000 },
    });

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    expect(cancelRes.statusCode).toBe(200);

    const custAfter = await app.inject({
      method: 'GET',
      url: `/api/customers/${customer.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    // We owe the customer 20.000 LYD — the debt must not silently clamp to zero.
    expect(custAfter.json().creditBalance).toBe(-20000);
  });
});

describe('invoice numbering', () => {
  it('continues from the max existing number and keeps cancelled numbers', async () => {
    const product = await createProduct();
    await openShift();

    const makeSale = async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sales',
        headers: { authorization: `Bearer ${salesToken}` },
        payload: {
          items: [{ productId: product.id, quantity: 1, unitPrice: 20000 }],
          discount: 0,
        },
      });
      expect(res.statusCode).toBe(200);
      return res.json();
    };

    const first = await makeSale();
    const second = await makeSale();
    await app.inject({
      method: 'POST',
      url: `/api/sales/${second.id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    const third = await makeSale();

    const num = (inv: string) => parseInt(inv.split('-')[2]!, 10);
    expect(num(second.invoiceNumber)).toBe(num(first.invoiceNumber) + 1);
    expect(num(third.invoiceNumber)).toBe(num(second.invoiceNumber) + 1);
  });
});

describe('auth & access hardening', () => {
  it('requires a session for product reads', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products' });
    expect(res.statusCode).toBe(401);
  });

  it('invalidates the session on logout', async () => {
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(after.statusCode).toBe(401);
  });

  it('rejects restore filenames with path traversal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/backup/restore',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { filename: '../../data/pos.db' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_filename');
  });

  // Keep this last in the file: it locks out 127.0.0.1 for subsequent attempts.
  it('locks out repeated failed PIN attempts', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/pin-switch',
        payload: { pin: '0000' },
      });
      expect(res.statusCode).toBe(401);
    }
    const locked = await app.inject({
      method: 'POST',
      url: '/api/auth/pin-switch',
      payload: { pin: '1111' }, // even the correct PIN is refused while locked out
    });
    expect(locked.statusCode).toBe(429);
  });
});
