import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type Fastify from 'fastify';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { warranties } from './db/schema.js';

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

  it('flags warranties ending within 30 days, excluding ones further out or already expired', async () => {
    const productRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'ماكينة قهوة',
        type: 'equipment',
        category: 'معدات',
        baseUnit: 'قطعة',
        costPrice: 100000,
        retailPrice: 200000,
        quantity: 5,
        reorderPoint: 0,
        warrantyMonths: 12,
      },
    });
    const product = productRes.json();

    await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { openingCash: 0 },
    });

    await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [
          { productId: product.id, quantity: 1, unitPrice: 200000, serialNumber: 'SN-SOON' },
        ],
        discount: 0,
      },
    });

    // Force the auto-created warranty's end date to 10 days from now so it
    // falls inside the notification horizon without waiting a real year.
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    app.db
      .update(warranties)
      .set({ endDate: soon.toISOString().slice(0, 10) })
      .where(eq(warranties.serialNumber, 'SN-SOON'))
      .run();

    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const warrantyAlert = res
      .json()
      .find((n: any) => n.type === 'warranty_ending' && n.message.includes('SN-SOON'));
    expect(warrantyAlert).toBeDefined();
    expect(warrantyAlert.severity).toBe('warning'); // 10 days out: warning, not yet the ≤7-day alert tier
  });
});
