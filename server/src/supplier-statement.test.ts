import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

describe('supplier statement of account', () => {
  let app: ReturnType<typeof buildApp>;
  let managerToken: string;
  let supplierId: number;
  let productId: number;

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

    // Create supplier
    const supRes = await app.inject({
      method: 'POST',
      url: '/api/suppliers',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'مورد اختبار كشف الحساب',
        phone: '0910000000',
        address: 'طرابلس',
      },
    });
    supplierId = supRes.json().id;

    // Create test product
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'بن للمورد',
        type: 'consumable',
        category: 'قهوة',
        baseUnit: 'كجم',
        costPrice: 10000,
        retailPrice: 15000,
        quantity: 0,
      },
    });
    productId = prodRes.json().id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 for unknown supplier ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suppliers/99999/statement',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('computes sign-preserving running balance and excludes cash returns from debt', async () => {
    // 1. Open shift (required for purchase payments and cash returns)
    const shiftRes = await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { openingCash: 100000 },
    });
    expect(shiftRes.statusCode).toBe(200);

    // 2. Create purchase (total: 100,000 milli-LYD, paid: 20,000 milli-LYD -> unpaid debt: 80,000)
    const purRes = await app.inject({
      method: 'POST',
      url: '/api/purchases',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        supplierId,
        supplierName: 'مورد اختبار كشف الحساب',
        paid: 20000,
        items: [{ productId, quantity: 10, unitCost: 10000 }],
      },
    });
    expect(purRes.statusCode).toBe(200);
    const purchaseId = purRes.json().purchaseId;

    // 3. Make supplier payment (amount: 30,000 milli-LYD -> debt becomes 50,000)
    const payRes = await app.inject({
      method: 'POST',
      url: `/api/suppliers/${supplierId}/payment`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { amount: 30000, notes: 'دفعة تحت الحساب' },
    });
    expect(payRes.statusCode).toBe(200);
    expect(payRes.json().newDebtBalance).toBe(50000);

    // 4. Return item with refundMethod = 'debt' (quantity 1 @ 10,000 milli-LYD -> debt becomes 40,000)
    const retDebtRes = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId, quantity: 1 }],
        refundMethod: 'debt',
      },
    });
    expect(retDebtRes.statusCode).toBe(200);

    // 5. Return item with refundMethod = 'cash' (quantity 1 @ 10,000 milli-LYD -> debt stays 40,000)
    const retCashRes = await app.inject({
      method: 'POST',
      url: `/api/purchases/${purchaseId}/return`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        items: [{ productId, quantity: 1 }],
        refundMethod: 'cash',
      },
    });
    expect(retCashRes.statusCode).toBe(200);

    // 6. Fetch statement
    const stmtRes = await app.inject({
      method: 'GET',
      url: `/api/suppliers/${supplierId}/statement`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(stmtRes.statusCode).toBe(200);

    const body = stmtRes.json();
    expect(body.supplier.id).toBe(supplierId);
    expect(body.summary.currentBalance).toBe(40000);
    expect(body.summary.calculatedBalance).toBe(40000);

    // Statement items: 1 purchase, 1 payment, 1 debt return (cash return excluded)
    expect(body.statement).toHaveLength(3);

    // Row 1: Purchase (unpaid debt = 80,000)
    expect(body.statement[0].type).toBe('purchase');
    expect(body.statement[0].debit).toBe(80000);
    expect(body.statement[0].credit).toBe(0);
    expect(body.statement[0].runningBalance).toBe(80000);

    // Row 2: Payment (30,000)
    expect(body.statement[1].type).toBe('payment');
    expect(body.statement[1].debit).toBe(0);
    expect(body.statement[1].credit).toBe(30000);
    expect(body.statement[1].runningBalance).toBe(50000);

    // Row 3: Return debt (10,000)
    expect(body.statement[2].type).toBe('return');
    expect(body.statement[2].debit).toBe(0);
    expect(body.statement[2].credit).toBe(10000);
    expect(body.statement[2].runningBalance).toBe(40000);
  });
});
