import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Fastify from 'fastify';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

describe('warranty & service tickets routes', () => {
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

  it('auto-creates a warranty record when equipment with serial number is sold', async () => {
    // 1. Create equipment product
    const pRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'مطحنة أصلية احترافية',
        type: 'equipment',
        category: 'معدات',
        baseUnit: 'قطعة',
        costPrice: 500000,
        retailPrice: 800000,
        quantity: 5,
        warrantyMonths: 24,
      },
    });
    const productId = pRes.json().id;

    // 2. Open shift & execute sale with serial number
    await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { openingCash: 50000 },
    });

    await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId, quantity: 1, unitPrice: 800000, serialNumber: 'GRIND-9988' }],
        discount: 0,
        paymentType: 'cash',
        paymentMethod: 'cash',
      },
    });

    // 3. Lookup serial warranty status
    const lookupRes = await app.inject({
      method: 'GET',
      url: '/api/warranties/lookup/GRIND-9988',
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(lookupRes.statusCode).toBe(200);
    const data = lookupRes.json();
    expect(data.warranty).toBeDefined();
    expect(data.warranty.serialNumber).toBe('GRIND-9988');
    expect(data.warranty.months).toBe(24);
    expect(data.isInWarranty).toBe(true);
  });

  it('creates and processes a service reception ticket', async () => {
    // Create service ticket
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/service-tickets',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        serialNumber: 'EQ-7711',
        productName: 'ماكينة قهوة إسبراسو',
        customerName: 'مطعم الأمل',
        customerPhone: '0912223344',
        faultDescription: 'تسريب مياه وسخونة زائدة',
        inWarranty: false,
      },
    });

    expect(ticketRes.statusCode).toBe(200);
    const ticket = ticketRes.json();
    expect(ticket.ticketNumber).toContain('SRV-');
    expect(ticket.status).toBe('open');

    // Update diagnosis & labor cost
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/service-tickets/${ticket.id}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        diagnosis: 'تغيير حلقة الجوان وتعديل الترموستات',
        parts: 'جوان إيطالي 58mm',
        laborCost: 15000,
        partsCost: 10000,
        status: 'repairing',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.totalCost).toBe(25000);
    expect(updated.status).toBe('repairing');
  });
});
