import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { quotations } from './db/schema.js';

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

async function createProduct(quantity = 10) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { authorization: `Bearer ${managerToken}` },
    payload: {
      name: 'ماكينة تحضير قهوة',
      type: 'equipment',
      category: 'معدات',
      baseUnit: 'جهاز',
      costPrice: 500000,
      retailPrice: 800000,
      wholesalePrice: 0,
      quantity,
      reorderPoint: 0,
    },
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

describe('quotations', () => {
  it('creating a quotation never touches stock, converting applies full sale effects once', async () => {
    const product = await createProduct(10);

    const quoteRes = await app.inject({
      method: 'POST',
      url: '/api/quotations',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 2, unitPrice: 800000 }],
        discount: 0,
      },
    });
    expect(quoteRes.statusCode).toBe(200);
    const quote = quoteRes.json();
    expect(quote.quoteNumber).toMatch(/^QUO-\d{4}-00001$/);
    expect(quote.total).toBe(1600000);

    // Stock untouched by the quotation
    expect(await productQty(product.id)).toBe(10);

    // Convert: open a shift, then post the sale with quotationId
    await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { openingCash: 0 },
    });

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 2, unitPrice: 800000 }],
        discount: 0,
        quotationId: quote.id,
      },
    });
    expect(saleRes.statusCode).toBe(200);

    // Stock deducted by the conversion sale
    expect(await productQty(product.id)).toBe(8);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/quotations/${quote.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(detail.json().status).toBe('converted');
    expect(detail.json().convertedSaleId).toBe(saleRes.json().id);

    // A second conversion attempt must fail
    const again = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 2, unitPrice: 800000 }],
        discount: 0,
        quotationId: quote.id,
      },
    });
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toBe('quotation_not_active');
    // …and the failed conversion must not have deducted stock
    expect(await productQty(product.id)).toBe(8);
  });

  it('enforces the same price authority as sales', async () => {
    const product = await createProduct();
    const res = await app.inject({
      method: 'POST',
      url: '/api/quotations',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 1 }],
        discount: 0,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('price_not_allowed');
  });

  it('expired quotations cannot be converted', async () => {
    const product = await createProduct();
    const quoteRes = await app.inject({
      method: 'POST',
      url: '/api/quotations',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 800000 }],
        discount: 0,
        validDays: 1,
      },
    });
    const quote = quoteRes.json();

    // Force the validity into the past
    app.db
      .update(quotations)
      .set({ validUntil: '2020-01-01' })
      .where(eq(quotations.id, quote.id))
      .run();

    await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { openingCash: 0 },
    });

    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [{ productId: product.id, quantity: 1, unitPrice: 800000 }],
        discount: 0,
        quotationId: quote.id,
      },
    });
    expect(saleRes.statusCode).toBe(400);
    expect(saleRes.json().error).toBe('quotation_expired');

    // The list endpoint reports it as expired now
    const list = await app.inject({
      method: 'GET',
      url: '/api/quotations',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(list.json().find((q: any) => q.id === quote.id).status).toBe('expired');
  });

  it('cancel is limited to the creator or a manager', async () => {
    const product = await createProduct();
    const mine = await app.inject({
      method: 'POST',
      url: '/api/quotations',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { items: [{ productId: product.id, quantity: 1, unitPrice: 800000 }], discount: 0 },
    });

    const bySales = await app.inject({
      method: 'POST',
      url: `/api/quotations/${mine.json().id}/cancel`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {},
    });
    expect(bySales.statusCode).toBe(403);

    const byManager = await app.inject({
      method: 'POST',
      url: `/api/quotations/${mine.json().id}/cancel`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    expect(byManager.statusCode).toBe(200);
  });
});
