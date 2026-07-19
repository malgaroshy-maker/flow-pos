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
      name: 'أكواب ورقية 8oz',
      type: 'consumable',
      category: 'أكواب',
      baseUnit: 'كرتونة',
      costPrice: 50000,
      retailPrice: 90000,
      wholesalePrice: 75000,
      quantity: 100,
      reorderPoint: 10,
    },
  });
  const product = prodRes.json();

  const wholesaleRes = await app.inject({
    method: 'POST',
    url: '/api/customers',
    headers: { authorization: `Bearer ${salesToken}` },
    payload: { name: 'مقهى الجملة', tier: 'wholesale' },
  });
  const wholesaleCustomer = wholesaleRes.json();

  const retailRes = await app.inject({
    method: 'POST',
    url: '/api/customers',
    headers: { authorization: `Bearer ${salesToken}` },
    payload: { name: 'زبون تجزئة' },
  });
  const retailCustomer = retailRes.json();

  await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers: { authorization: `Bearer ${salesToken}` },
    payload: { openingCash: 0 },
  });

  return { product, wholesaleCustomer, retailCustomer };
}

function sellAs(token: string, productId: number, unitPrice: number, customerId?: number) {
  return app.inject({
    method: 'POST',
    url: '/api/sales',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      items: [{ productId, quantity: 1, unitPrice }],
      discount: 0,
      paymentType: 'cash',
      customerId,
      // paymentType cash with a customer attached is a normal tracked cash sale
    },
  });
}

describe('pricing precedence: special price → tier → default', () => {
  it('wholesale customers get the wholesale price without any override', async () => {
    const { product, wholesaleCustomer } = await setup();

    // Retail price for a wholesale customer is NOT the resolved price → rejected
    const wrong = await sellAs(salesToken, product.id, 90000, wholesaleCustomer.id);
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error).toBe('price_not_allowed');

    const right = await sellAs(salesToken, product.id, 75000, wholesaleCustomer.id);
    expect(right.statusCode).toBe(200);
    expect(right.json().total).toBe(75000);
  });

  it('retail customers and walk-ins get the retail price', async () => {
    const { product, retailCustomer } = await setup();

    const walkIn = await sellAs(salesToken, product.id, 90000);
    expect(walkIn.statusCode).toBe(200);

    const retail = await sellAs(salesToken, product.id, 90000, retailCustomer.id);
    expect(retail.statusCode).toBe(200);

    const wholesalePriceForRetail = await sellAs(salesToken, product.id, 75000, retailCustomer.id);
    expect(wholesalePriceForRetail.statusCode).toBe(400);
  });

  it('a special price beats the tier price', async () => {
    const { product, wholesaleCustomer } = await setup();

    const setSpecial = await app.inject({
      method: 'PUT',
      url: `/api/customers/${wholesaleCustomer.id}/special-prices`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { productId: product.id, price: 70000 },
    });
    expect(setSpecial.statusCode).toBe(200);

    // Wholesale price no longer authorized — the special price is
    const tierPrice = await sellAs(salesToken, product.id, 75000, wholesaleCustomer.id);
    expect(tierPrice.statusCode).toBe(400);

    const special = await sellAs(salesToken, product.id, 70000, wholesaleCustomer.id);
    expect(special.statusCode).toBe(200);
    expect(special.json().total).toBe(70000);

    // Removing the special price restores tier pricing
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/customers/${wholesaleCustomer.id}/special-prices/${product.id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(del.statusCode).toBe(200);

    const backToTier = await sellAs(salesToken, product.id, 75000, wholesaleCustomer.id);
    expect(backToTier.statusCode).toBe(200);
  });

  it('only managers may set special prices, and inputs are validated', async () => {
    const { product, retailCustomer } = await setup();

    const bySales = await app.inject({
      method: 'PUT',
      url: `/api/customers/${retailCustomer.id}/special-prices`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { productId: product.id, price: 1000 },
    });
    expect(bySales.statusCode).toBe(403);

    const floatPrice = await app.inject({
      method: 'PUT',
      url: `/api/customers/${retailCustomer.id}/special-prices`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { productId: product.id, price: 70.5 },
    });
    expect(floatPrice.statusCode).toBe(400);
  });

  it('a product with no wholesale price falls back to retail for wholesale customers', async () => {
    const { wholesaleCustomer } = await setup();

    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'منتج بدون سعر جملة',
        type: 'consumable',
        category: 'أخرى',
        baseUnit: 'قطعة',
        costPrice: 1000,
        retailPrice: 2000,
        wholesalePrice: 0,
        quantity: 10,
        reorderPoint: 0,
      },
    });
    const product = prodRes.json();

    const res = await sellAs(salesToken, product.id, 2000, wholesaleCustomer.id);
    expect(res.statusCode).toBe(200);
  });
});
