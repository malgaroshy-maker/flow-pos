import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Fastify from 'fastify';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

describe('reports & analytics routes', () => {
  let app: ReturnType<typeof buildApp>;
  let managerToken: string;
  let salesToken: string;

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
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects sales role from accessing financial analytics reports', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/analytics',
      headers: { authorization: `Bearer ${salesToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('calculates aggregated sales, profit, and slow-moving stock for manager', async () => {
    // 1. Create product
    const pRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'منتج تقارير الأرباح',
        type: 'consumable',
        category: 'المشروبات',
        baseUnit: 'علبة',
        costPrice: 2000,
        retailPrice: 5000,
        quantity: 50,
      },
    });
    const productId = pRes.json().id;

    // 2. Open shift and execute sale of 10 items
    await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { openingCash: 100000 },
    });

    await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId, quantity: 10, unitPrice: 5000 }],
        discount: 0,
        paymentType: 'cash',
        paymentMethod: 'cash',
      },
    });

    // 3. Fetch analytics
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/analytics',
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();

    expect(data.summary.netSales).toBe(50000); // 10 × 5000
    expect(data.summary.totalCost).toBe(20000); // 10 × 2000
    expect(data.summary.totalProfit).toBe(30000); // 50000 - 20000
    expect(data.topProducts).toHaveLength(1);
    expect(data.topProducts[0].name).toBe('منتج تقارير الأرباح');
  });

  it('generates Excel (.xlsx) file stream for sales export', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/excel?type=sales',
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });
});
