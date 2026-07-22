import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { cashMovements } from './db/schema.js';

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
      retailPrice: 30000,
      wholesalePrice: 0,
      quantity: 20,
      reorderPoint: 0,
      ...overrides,
    },
  });
  return res.json();
}

async function openShift() {
  const res = await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers: { authorization: `Bearer ${salesToken}` },
    payload: { openingCash: 0 },
  });
  return res.json();
}

async function productQty(id: number): Promise<number> {
  const res = await app.inject({
    method: 'GET',
    url: `/api/products/${id}`,
    headers: { authorization: `Bearer ${managerToken}` },
  });
  return res.json().quantity;
}

async function getSale(saleId: number) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/sales/${saleId}`,
    headers: { authorization: `Bearer ${managerToken}` },
  });
  return res.json();
}

describe('customer sale returns', () => {
  it('a partial cash-sale return restores stock and refunds cash into the open shift', async () => {
    const product = await createProduct();
    await openShift();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 5, unitPrice: 30000 }],
        discount: 0,
      },
    });
    expect(saleRes.statusCode).toBe(200);
    const sale = saleRes.json();
    expect(await productQty(product.id)).toBe(15);

    const detail = await getSale(sale.id);
    const lineId = detail.items[0].id;

    const returnRes = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 2 }] },
    });
    expect(returnRes.statusCode).toBe(200);
    expect(returnRes.json().returnValue).toBe(60000);
    expect(returnRes.json().refundMethod).toBe('cash');
    expect(returnRes.json().returnNumber).toMatch(/^RET-\d{4}-\d{5}$/);
    expect(await productQty(product.id)).toBe(17);

    // Only 3 remain returnable on this line; asking for 4 must fail
    const over = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 4 }] },
    });
    expect(over.statusCode).toBe(400);
    expect(over.json().error).toBe('over_return');
  });

  it('a credit-sale return reduces the customer balance instead of touching cash', async () => {
    const product = await createProduct();
    await openShift();

    const custRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { name: 'عميل آجل' },
    });
    const customer = custRes.json();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 4, unitPrice: 30000 }],
        discount: 0,
        paymentType: 'credit',
        customerId: customer.id,
      },
    });
    expect(saleRes.statusCode).toBe(200);
    const sale = saleRes.json();

    const custBefore = await app.inject({
      method: 'GET',
      url: '/api/customers',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(custBefore.json().find((c: any) => c.id === customer.id).creditBalance).toBe(120000);

    const detail = await getSale(sale.id);
    const lineId = detail.items[0].id;

    const returnRes = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 1 }] },
    });
    expect(returnRes.statusCode).toBe(200);
    expect(returnRes.json().refundMethod).toBe('debt');

    const custAfter = await app.inject({
      method: 'GET',
      url: '/api/customers',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(custAfter.json().find((c: any) => c.id === customer.id).creditBalance).toBe(90000);
  });

  it('is manager-only (or PIN override), and rejects returns against a fully-cancelled sale', async () => {
    const product = await createProduct();
    await openShift();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 3, unitPrice: 30000 }],
        discount: 0,
      },
    });
    const sale = saleRes.json();
    const detail = await getSale(sale.id);
    const lineId = detail.items[0].id;

    const bySales = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 1 }] },
    });
    expect(bySales.statusCode).toBe(403);

    const withPin = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 1 }], overridePin: '1111' },
    });
    expect(withPin.statusCode).toBe(200);

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(200);

    const afterCancel = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 1 }] },
    });
    expect(afterCancel.statusCode).toBe(400);
    expect(afterCancel.json().error).toBe('sale_cancelled');
  });

  it('a bundle sale return restores every component proportionally', async () => {
    const machine = await createProduct({ name: 'ماكينة', quantity: 3, retailPrice: 5000000 });
    const grinder = await createProduct({ name: 'مطحنة', quantity: 6, retailPrice: 1500000 });
    const bundle = await createProduct({ name: 'باقة تجهيز', quantity: 0, retailPrice: 6000000 });
    await app.inject({
      method: 'PUT',
      url: `/api/products/${bundle.id}/components`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        components: [
          { componentProductId: machine.id, quantity: 1 },
          { componentProductId: grinder.id, quantity: 2 },
        ],
      },
    });
    await openShift();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: bundle.id, quantity: 2, unitPrice: 6000000 }],
        discount: 0,
      },
    });
    const sale = saleRes.json();
    expect(await productQty(machine.id)).toBe(1);
    expect(await productQty(grinder.id)).toBe(2);

    const detail = await getSale(sale.id);
    const lineId = detail.items[0].id;

    const returnRes = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 1 }] },
    });
    expect(returnRes.statusCode).toBe(200);
    expect(returnRes.json().returnValue).toBe(6000000);
    expect(await productQty(machine.id)).toBe(2);
    expect(await productQty(grinder.id)).toBe(4);
  });

  it('cash returns require an open shift when the sale was paid in cash', async () => {
    const product = await createProduct();
    await openShift();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 2, unitPrice: 30000 }],
        discount: 0,
      },
    });
    const sale = saleRes.json();
    const detail = await getSale(sale.id);
    const lineId = detail.items[0].id;

    await app.inject({
      method: 'POST',
      url: '/api/shifts/close',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { actualCash: 60000 },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 1 }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('no_active_shift');
  });

  it('cancelling a sale after a partial return restores only unreturned stock and refunds only remaining cash', async () => {
    const product = await createProduct({ quantity: 20 });
    await openShift();

    // Sell 10 items @ 30 LYD = 300 LYD
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 10, unitPrice: 30000 }],
        discount: 0,
      },
    });
    const sale = saleRes.json();
    expect(await productQty(product.id)).toBe(10);

    const detail = await getSale(sale.id);
    const lineId = detail.items[0].id;

    // Return 3 items (90 LYD refund, stock restored to 13)
    const returnRes = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ saleItemId: lineId, quantity: 3 }] },
    });
    expect(returnRes.statusCode).toBe(200);
    expect(await productQty(product.id)).toBe(13);

    // Cancel remaining sale (restores remaining 7 items -> total 20, refunds remaining 210 LYD)
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(await productQty(product.id)).toBe(20);

    // Verify shift cash balance: initial 0 + sales 300 - return 90 - cancel 210 = 0
    const shiftRes = await app.inject({
      method: 'GET',
      url: '/api/shifts/active',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    const shiftId = shiftRes.json().active.id;
    const movements = app.db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, shiftId))
      .all();
    const netCash = movements.reduce((acc, m) => acc + m.amount, 0);
    expect(netCash).toBe(0);
  });
});
