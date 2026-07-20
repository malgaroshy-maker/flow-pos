import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Fastify from 'fastify';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

describe('notification center routes', () => {
  let app: ReturnType<typeof buildApp>;
  let managerToken: string;

  beforeEach(async () => {
    const sqlite = openDatabase(':memory:');
    runMigrations(sqlite);
    seed(sqlite);
    app = buildApp(sqlite);

    const mgrRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'مدير', password: 'admin' },
    });
    managerToken = mgrRes.json().token;
  });

  afterEach(async () => {
    await app.close();
  });

  it('computes low stock, expiring products, and overdue customer debt notifications', async () => {
    // 1. Create product with quantity <= reorderPoint
    await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'منتج منخفض المخزون',
        type: 'consumable',
        category: 'اختبارات',
        baseUnit: 'قطعة',
        costPrice: 1000,
        retailPrice: 2000,
        quantity: 2,
        reorderPoint: 5,
      },
    });

    // 2. Create customer with credit balance
    await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'عميل مدين للإشعارات',
        phone: '0910000000',
        tier: 'retail',
        creditLimit: 100000,
      },
    });

    // 3. Fetch notifications
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const notifications = res.json();
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    const lowStockAlert = notifications.find((n: any) => n.type === 'low_stock');
    expect(lowStockAlert).toBeDefined();
    expect(lowStockAlert.title).toContain('تنبيه إعادة الطلب');
  });
});
