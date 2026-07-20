import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Fastify from 'fastify';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

describe('stocktaking routes & business logic', () => {
  let app: ReturnType<typeof buildApp>;
  let managerToken: string;
  let salesToken: string;
  let testProductId: number;

  beforeEach(async () => {
    const sqlite = openDatabase(':memory:');
    runMigrations(sqlite);
    seed(sqlite);
    app = buildApp(sqlite);

    // Login Manager
    const mgrRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'مدير', password: 'admin' },
    });
    managerToken = mgrRes.json().token;

    // Login Sales
    const salesRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'بائع', password: 'sales' },
    });
    salesToken = salesRes.json().token;

    // Create a test product with initial quantity 20
    const pRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'منتج اختبار الجرد',
        type: 'consumable',
        category: 'اختبارات',
        baseUnit: 'قطعة',
        costPrice: 5000,
        retailPrice: 10000,
        quantity: 20,
        barcode: '1122334455',
      },
    });
    testProductId = pRes.json().id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates stocktake session and records barcode scan counts', async () => {
    // 1. Create stocktaking session
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/stocktaking',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { notes: 'جرد شهري لشهر يوليو' },
    });

    expect(createRes.statusCode).toBe(200);
    const session = createRes.json();
    expect(session.status).toBe('open');

    // 2. Count product by barcode (counted 18 instead of expected 20)
    const countRes = await app.inject({
      method: 'POST',
      url: `/api/stocktaking/${session.id}/count`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { barcode: '1122334455', countedQty: 18 },
    });

    expect(countRes.statusCode).toBe(200);
    const sessionWithItems = countRes.json();
    expect(sessionWithItems.items).toHaveLength(1);

    const item = sessionWithItems.items[0];
    expect(item.productId).toBe(testProductId);
    expect(item.expectedQty).toBe(20);
    expect(item.countedQty).toBe(18);
    expect(item.variance).toBe(-2);
  });

  it('enforces blind count for sales role during open stocktake sessions', async () => {
    // Manager opens session and counts
    const sRes = await app.inject({
      method: 'POST',
      url: '/api/stocktaking',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    const session = sRes.json();

    await app.inject({
      method: 'POST',
      url: `/api/stocktaking/${session.id}/count`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { productId: testProductId, countedQty: 15 },
    });

    // Sales user fetches session details
    const salesFetch = await app.inject({
      method: 'GET',
      url: `/api/stocktaking/${session.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });

    expect(salesFetch.statusCode).toBe(200);
    const salesData = salesFetch.json();
    // Sales role sees countedQty, but expectedQty and variance are hidden (0)
    expect(salesData.items[0].countedQty).toBe(15);
    expect(salesData.items[0].expectedQty).toBe(0);
    expect(salesData.items[0].variance).toBe(0);
  });

  it('closes session and applies variance adjustments with manager authority', async () => {
    // 1. Open & count
    const sRes = await app.inject({
      method: 'POST',
      url: '/api/stocktaking',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {},
    });
    const session = sRes.json();

    await app.inject({
      method: 'POST',
      url: `/api/stocktaking/${session.id}/count`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { productId: testProductId, countedQty: 25 }, // +5 variance
    });

    // 2. Close session
    const closeRes = await app.inject({
      method: 'POST',
      url: `/api/stocktaking/${session.id}/close`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(closeRes.statusCode).toBe(200);

    // 3. Sales user attempts to apply without PIN -> rejected
    const forbiddenApply = await app.inject({
      method: 'POST',
      url: `/api/stocktaking/${session.id}/apply`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {},
    });
    expect(forbiddenApply.statusCode).toBe(403);

    // 4. Sales user applies with Manager PIN 1111 -> success
    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/stocktaking/${session.id}/apply`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { overridePin: '1111' },
    });
    expect(applyRes.statusCode).toBe(200);

    // 5. Verify product stock updated from 20 -> 25
    const pRes = await app.inject({
      method: 'GET',
      url: `/api/products/${testProductId}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(pRes.json().quantity).toBe(25);

    // 6. Attempting to apply again fails
    const reApply = await app.inject({
      method: 'POST',
      url: `/api/stocktaking/${session.id}/apply`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(reApply.statusCode).toBe(400);
  });
});
