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

async function setup() {
  const prodRes = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { authorization: `Bearer ${managerToken}` },
    payload: {
      name: 'فلتر ماء صناعي',
      type: 'consumable',
      category: 'فلاتر',
      baseUnit: 'قطعة',
      costPrice: 0,
      retailPrice: 30000,
      wholesalePrice: 0,
      quantity: 0,
      reorderPoint: 0,
    },
  });
  const product = prodRes.json();

  const supRes = await app.inject({
    method: 'POST',
    url: '/api/suppliers',
    headers: { authorization: `Bearer ${managerToken}` },
    payload: { name: 'مورد الفلاتر' },
  });
  const supplier = supRes.json();

  // Purchase 10 units at 20.000 LYD on full credit → supplier debt 200.000
  const purchaseRes = await app.inject({
    method: 'POST',
    url: '/api/purchases',
    headers: { authorization: `Bearer ${managerToken}` },
    payload: {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 10, unitCost: 20000 }],
      paid: 0,
    },
  });
  const purchase = purchaseRes.json();
  return { product, supplier, purchase };
}

async function supplierDebt(id: number): Promise<number> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/suppliers',
    headers: { authorization: `Bearer ${managerToken}` },
  });
  return res.json().find((s: any) => s.id === id).debtBalance;
}

async function productQty(id: number): Promise<number> {
  const res = await app.inject({
    method: 'GET',
    url: `/api/products/${id}`,
    headers: { authorization: `Bearer ${managerToken}` },
  });
  return res.json().quantity;
}

describe('supplier returns', () => {
  it('reduces stock and supplier debt, blocks over-returns across multiple returns', async () => {
    const { product, supplier, purchase } = await setup();

    const first = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchase.purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ productId: product.id, quantity: 4 }], refundMethod: 'debt' },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().returnValue).toBe(80000);
    expect(await productQty(product.id)).toBe(6);
    expect(await supplierDebt(supplier.id)).toBe(120000);

    // Only 6 remain returnable; asking for 7 must fail
    const over = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchase.purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ productId: product.id, quantity: 7 }], refundMethod: 'debt' },
    });
    expect(over.statusCode).toBe(400);
    expect(over.json().error).toBe('over_return');

    const rest = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchase.purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ productId: product.id, quantity: 6 }], refundMethod: 'debt' },
    });
    expect(rest.statusCode).toBe(200);
    expect(await productQty(product.id)).toBe(0);
    expect(await supplierDebt(supplier.id)).toBe(0);
  });

  it('cash refunds require an open shift and land in the drawer', async () => {
    const { product, purchase } = await setup();

    const noShift = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchase.purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ productId: product.id, quantity: 2 }], refundMethod: 'cash' },
    });
    expect(noShift.statusCode).toBe(400);
    expect(noShift.json().error).toBe('no_active_shift');

    const shiftRes = await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { openingCash: 0 },
    });
    const shift = shiftRes.json();

    const cashReturn = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchase.purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ productId: product.id, quantity: 2 }], refundMethod: 'cash' },
    });
    expect(cashReturn.statusCode).toBe(200);

    const movements = await app.inject({
      method: 'GET',
      url: `/api/shifts/${shift.id}/movements`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    const deposit = movements
      .json()
      .find((m: any) => m.referenceId?.includes(purchase.invoiceNumber));
    expect(deposit).toBeDefined();
    expect(deposit.amount).toBe(40000);
  });

  it('is manager-only and rejects stock the shop no longer holds', async () => {
    const { product, purchase } = await setup();

    const bySales = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchase.purchaseId}/return`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { items: [{ productId: product.id, quantity: 1 }] },
    });
    expect(bySales.statusCode).toBe(403);

    // Sell 8 of the 10 units so only 2 remain in stock, then try returning 5
    await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { openingCash: 0 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 8, unitPrice: 30000 }],
        discount: 0,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchase.purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ productId: product.id, quantity: 5 }], refundMethod: 'debt' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('insufficient_stock');
  });
});
