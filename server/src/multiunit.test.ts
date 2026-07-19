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

async function createCupsProduct() {
  // 1000 cups in stock (base unit = cup); carton = 20 packs = 1000 cups
  const prodRes = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { authorization: `Bearer ${managerToken}` },
    payload: {
      name: 'أكواب ورقية',
      type: 'consumable',
      category: 'أكواب',
      baseUnit: 'كوب',
      costPrice: 100,
      retailPrice: 250,
      wholesalePrice: 0,
      quantity: 2000,
      reorderPoint: 100,
    },
  });
  const product = prodRes.json();

  const unitsRes = await app.inject({
    method: 'PUT',
    url: `/api/products/${product.id}/units`,
    headers: { authorization: `Bearer ${managerToken}` },
    payload: {
      units: [
        { unitName: 'ربطة', conversionFactor: 50, price: 10000 },
        { unitName: 'كرتونة', conversionFactor: 1000, price: 180000 },
      ],
    },
  });
  expect(unitsRes.statusCode).toBe(200);
  return { product, units: unitsRes.json().units };
}

async function productQty(id: number): Promise<number> {
  const res = await app.inject({
    method: 'GET',
    url: `/api/products/${id}`,
    headers: { authorization: `Bearer ${managerToken}` },
  });
  return res.json().quantity;
}

async function openShift() {
  await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers: { authorization: `Bearer ${salesToken}` },
    payload: { openingCash: 0 },
  });
}

describe('multi-unit products', () => {
  it('selling a packaging unit deducts conversion_factor base units and cancel restores them', async () => {
    const { product, units } = await createCupsProduct();
    const carton = units.find((u: any) => u.unitName === 'كرتونة');
    await openShift();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitId: carton.id, unitPrice: 180000 }],
        discount: 0,
      },
    });
    expect(saleRes.statusCode).toBe(200);
    expect(saleRes.json().total).toBe(180000);
    expect(await productQty(product.id)).toBe(1000);

    // Receipt payload carries the sold unit snapshot
    const detail = await app.inject({
      method: 'GET',
      url: `/api/sales/${saleRes.json().id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    const line = detail.json().items[0];
    expect(line.unitName).toBe('كرتونة');
    expect(line.conversionFactor).toBe(1000);
    expect(line.quantity).toBe(1);

    // Cancellation restores the base units
    const cancel = await app.inject({
      method: 'POST',
      url: `/api/sales/${saleRes.json().id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(200);
    expect(await productQty(product.id)).toBe(2000);
  });

  it('unit price is authoritative and stock checks run in base units', async () => {
    const { product, units } = await createCupsProduct();
    const carton = units.find((u: any) => u.unitName === 'كرتونة');
    await openShift();

    // Wrong unit price rejected for the sales role
    const wrongPrice = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitId: carton.id, unitPrice: 1 }],
        discount: 0,
      },
    });
    expect(wrongPrice.statusCode).toBe(400);
    expect(wrongPrice.json().error).toBe('price_not_allowed');

    // 3 cartons = 3000 cups > 2000 in stock → blocked for sales role
    const overStock = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 3, unitId: carton.id, unitPrice: 180000 }],
        discount: 0,
      },
    });
    expect(overStock.statusCode).toBe(400);
    expect(overStock.json().error).toBe('insufficient_stock');

    // A unit belonging to another product is rejected
    const otherProd = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'منتج آخر',
        type: 'consumable',
        category: 'أخرى',
        baseUnit: 'قطعة',
        costPrice: 0,
        retailPrice: 1000,
        wholesalePrice: 0,
        quantity: 5,
        reorderPoint: 0,
      },
    });
    const wrongUnit = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [
          { productId: otherProd.json().id, quantity: 1, unitId: carton.id, unitPrice: 180000 },
        ],
        discount: 0,
      },
    });
    expect(wrongUnit.statusCode).toBe(400);
    expect(wrongUnit.json().error).toBe('unit_not_found');
  });
});

describe('credit limits', () => {
  it('blocks credit sales beyond the limit for the sales role, allows with manager PIN', async () => {
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'جهاz غالي',
        type: 'equipment',
        category: 'معدات',
        baseUnit: 'جهاز',
        costPrice: 0,
        retailPrice: 500000,
        wholesalePrice: 0,
        quantity: 10,
        reorderPoint: 0,
      },
    });
    const product = prodRes.json();

    const custRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { name: 'عميل محدود', creditLimit: 400000 },
    });
    const customer = custRes.json();
    await openShift();

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 500000 }],
        discount: 0,
        paymentType: 'credit',
        customerId: customer.id,
      },
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe('credit_limit_exceeded');

    const withPin = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 500000 }],
        discount: 0,
        paymentType: 'credit',
        customerId: customer.id,
        overridePin: '1111',
      },
    });
    expect(withPin.statusCode).toBe(200);

    const logs = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(logs.json().map((l: any) => l.action)).toContain('credit_limit_override_sale');
  });
});

describe('per-product tax exemption', () => {
  it('taxes only non-exempt lines', async () => {
    // Enable 10% tax (taxRatePermille = 100 → 10.0%)
    await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { taxEnabled: true, taxRatePermille: 100 },
    });

    const taxable = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'صنف خاضع',
        type: 'consumable',
        category: 'أخرى',
        baseUnit: 'قطعة',
        costPrice: 0,
        retailPrice: 100000,
        wholesalePrice: 0,
        quantity: 10,
        reorderPoint: 0,
      },
    });
    const exempt = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'صنف معفي',
        type: 'consumable',
        category: 'أخرى',
        baseUnit: 'قطعة',
        costPrice: 0,
        retailPrice: 50000,
        wholesalePrice: 0,
        quantity: 10,
        reorderPoint: 0,
        taxExempt: true,
      },
    });
    await openShift();

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [
          { productId: taxable.json().id, quantity: 1, unitPrice: 100000 },
          { productId: exempt.json().id, quantity: 1, unitPrice: 50000 },
        ],
        discount: 0,
      },
    });
    expect(saleRes.statusCode).toBe(200);
    // Tax = 10% of the taxable line only (100.000) = 10.000 LYD
    const sale = await app.inject({
      method: 'GET',
      url: `/api/sales/${saleRes.json().id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(sale.json().taxAmount).toBe(10000);
    expect(sale.json().total).toBe(160000);
  });
});
