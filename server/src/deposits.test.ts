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
      name: 'ماكينة قهوة للحجز',
      type: 'equipment',
      category: 'معدات',
      baseUnit: 'جهاز',
      costPrice: 0,
      retailPrice: 1000000,
      wholesalePrice: 0,
      quantity: 1,
      reorderPoint: 0,
      ...overrides,
    },
  });
  return res.json();
}

async function createCustomer(name = 'عميل عربون') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/customers',
    headers: { authorization: `Bearer ${salesToken}` },
    payload: { name },
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

async function shiftMovements(shiftId: number) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/shifts/${shiftId}/movements`,
    headers: { authorization: `Bearer ${managerToken}` },
  });
  return res.json();
}

describe('deposits & equipment reservation', () => {
  it('a deposit reserves the unit: others cannot buy it, the depositor can', async () => {
    const product = await createProduct({ quantity: 1 });
    const customer = await createCustomer();
    const other = await createCustomer('عميل آخر');
    const shift = await openShift();

    const depRes = await app.inject({
      method: 'POST',
      url: '/api/deposits',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { customerId: customer.id, productId: product.id, amount: 200000 },
    });
    expect(depRes.statusCode).toBe(200);
    const deposit = depRes.json();

    // The only unit is reserved — a normal sale is blocked for the sales role
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 1000000 }],
        discount: 0,
        customerId: other.id,
      },
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe('insufficient_stock');

    // The depositor converts: deposit applied, cash due = total - deposit
    const sale = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 1000000 }],
        discount: 0,
        customerId: customer.id,
        depositId: deposit.id,
      },
    });
    expect(sale.statusCode).toBe(200);

    const movements = await shiftMovements(shift.id);
    const saleMovement = movements.find((m: any) => m.referenceId === sale.json().invoiceNumber);
    expect(saleMovement.amount).toBe(800000); // 1000.000 − 200.000 deposit

    const deps = await app.inject({
      method: 'GET',
      url: '/api/deposits',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    const applied = deps.json().find((d: any) => d.id === deposit.id);
    expect(applied.status).toBe('applied');
    expect(applied.saleId).toBe(sale.json().id);
  });

  it('cancelling the sale returns the deposit to held and re-reserves the unit', async () => {
    const product = await createProduct({ quantity: 1 });
    const customer = await createCustomer();
    await openShift();

    const deposit = (
      await app.inject({
        method: 'POST',
        url: '/api/deposits',
        headers: { authorization: `Bearer ${salesToken}` },
        payload: { customerId: customer.id, productId: product.id, amount: 200000 },
      })
    ).json();

    const sale = (
      await app.inject({
        method: 'POST',
        url: '/api/sales',
        headers: { authorization: `Bearer ${salesToken}` },
        payload: {
          items: [{ productId: product.id, quantity: 1, unitPrice: 1000000 }],
          discount: 0,
          customerId: customer.id,
          depositId: deposit.id,
        },
      })
    ).json();

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(200);

    const deps = await app.inject({
      method: 'GET',
      url: '/api/deposits',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(deps.json().find((d: any) => d.id === deposit.id).status).toBe('held');

    const prod = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(prod.json().quantity).toBe(1);
    expect(prod.json().reservedQuantity).toBe(1);
  });

  it('refund pays cash back out; forfeit keeps the money; both release the reservation', async () => {
    const product = await createProduct({ quantity: 2 });
    const customer = await createCustomer();
    const shift = await openShift();

    const d1 = (
      await app.inject({
        method: 'POST',
        url: '/api/deposits',
        headers: { authorization: `Bearer ${salesToken}` },
        payload: { customerId: customer.id, productId: product.id, amount: 100000 },
      })
    ).json();
    const d2 = (
      await app.inject({
        method: 'POST',
        url: '/api/deposits',
        headers: { authorization: `Bearer ${salesToken}` },
        payload: { customerId: customer.id, productId: product.id, amount: 150000 },
      })
    ).json();

    const refund = await app.inject({
      method: 'POST',
      url: `/api/deposits/${d1.id}/refund`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {},
    });
    expect(refund.statusCode).toBe(200);

    const forfeitBySales = await app.inject({
      method: 'POST',
      url: `/api/deposits/${d2.id}/forfeit`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {},
    });
    expect(forfeitBySales.statusCode).toBe(403);

    const forfeit = await app.inject({
      method: 'POST',
      url: `/api/deposits/${d2.id}/forfeit`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    expect(forfeit.statusCode).toBe(200);

    const prod = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(prod.json().reservedQuantity).toBe(0);

    // Drawer: +100k +150k −100k (refund) = +150k net from deposits
    const movements = await shiftMovements(shift.id);
    const depositNet = movements
      .filter((m: any) => String(m.referenceId).includes('عربون'))
      .reduce((s: number, m: any) => s + m.amount, 0);
    expect(depositNet).toBe(150000);
  });

  it("rejects applying another customer's deposit or one exceeding the total", async () => {
    const product = await createProduct({ quantity: 5, retailPrice: 100000 });
    const customer = await createCustomer();
    const other = await createCustomer('عميل آخر');
    await openShift();

    const deposit = (
      await app.inject({
        method: 'POST',
        url: '/api/deposits',
        headers: { authorization: `Bearer ${salesToken}` },
        payload: { customerId: customer.id, amount: 250000 },
      })
    ).json();

    const wrongCustomer = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 100000 }],
        discount: 0,
        customerId: other.id,
        depositId: deposit.id,
      },
    });
    expect(wrongCustomer.statusCode).toBe(400);
    expect(wrongCustomer.json().error).toBe('deposit_customer_mismatch');

    const exceeds = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 2, unitPrice: 100000 }],
        discount: 0,
        customerId: customer.id,
        depositId: deposit.id,
      },
    });
    expect(exceeds.statusCode).toBe(400);
    expect(exceeds.json().error).toBe('deposit_exceeds_total');
  });
});

describe('setup bundles', () => {
  async function setupBundle() {
    const machine = await createProduct({
      name: 'ماكينة',
      quantity: 3,
      retailPrice: 5000000,
    });
    const grinder = await createProduct({
      name: 'مطحنة',
      quantity: 6,
      retailPrice: 1500000,
    });
    const bundle = await createProduct({
      name: 'باقة تجهيز مقهى',
      quantity: 0,
      retailPrice: 6000000,
    });
    const compRes = await app.inject({
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
    expect(compRes.statusCode).toBe(200);
    return { machine, grinder, bundle };
  }

  async function qty(id: number) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/products/${id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    return res.json().quantity;
  }

  it('selling a bundle deducts all components at the bundle price; cancel restores them', async () => {
    const { machine, grinder, bundle } = await setupBundle();
    await openShift();

    const sale = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: bundle.id, quantity: 1, unitPrice: 6000000 }],
        discount: 0,
      },
    });
    expect(sale.statusCode).toBe(200);
    expect(sale.json().total).toBe(6000000);
    expect(await qty(machine.id)).toBe(2);
    expect(await qty(grinder.id)).toBe(4);
    expect(await qty(bundle.id)).toBe(0); // parent stock untouched

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/sales/${sale.json().id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(200);
    expect(await qty(machine.id)).toBe(3);
    expect(await qty(grinder.id)).toBe(6);
  });

  it('blocks the sale when any component is short, and reports bundle availability', async () => {
    const { grinder, bundle } = await setupBundle();
    await openShift();

    // Grinders allow 3 bundles (6/2) but machines only 3 → availability = 3;
    // ask for 4 bundles → the machine (3 in stock) blocks it
    const over = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: bundle.id, quantity: 4, unitPrice: 6000000 }],
        discount: 0,
      },
    });
    expect(over.statusCode).toBe(400);
    expect(over.json().error).toBe('insufficient_stock');

    const list = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    const bundleRow = list.json().find((p: any) => p.id === bundle.id);
    expect(bundleRow.bundleAvailable).toBe(3);
    expect(bundleRow.components.length).toBe(2);

    // Nested bundles are rejected
    const nested = await app.inject({
      method: 'PUT',
      url: `/api/products/${grinder.id}/components`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { components: [{ componentProductId: bundle.id, quantity: 1 }] },
    });
    expect(nested.statusCode).toBe(400);
    expect(nested.json().error).toBe('nested_bundle');
  });
});
