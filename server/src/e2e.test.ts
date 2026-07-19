import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

let app: ReturnType<typeof buildApp>;
let managerToken: string;
let salesToken: string;

beforeEach(async () => {
  const sqlite = openDatabase(':memory:');
  runMigrations(sqlite);
  seed(sqlite);
  app = buildApp(sqlite);

  // Login Manager
  const mRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'مدير', password: 'admin' },
  });
  expect(mRes.statusCode).toBe(200);
  managerToken = mRes.json().token;

  // Login Cashier (Sales)
  const sRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'بائع', password: 'sales' },
  });
  expect(sRes.statusCode).toBe(200);
  salesToken = sRes.json().token;
});

afterEach(async () => {
  await app.close();
});

describe('Full End-to-End Business Cycle Integration Test', () => {
  it('executes complete flow: products -> purchases -> shift -> sales -> reports -> stock reduction -> cancellation', async () => {
    // 1. Create Consumable Product with Barcode & Reorder Point
    const createProdRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'حبوب قهوة إسبراسو 1كجم',
        type: 'consumable',
        category: 'حبوب البن',
        baseUnit: 'كيلو',
        barcode: '6291100000012',
        costPrice: 40000, // 40.000 LYD
        retailPrice: 65000, // 65.000 LYD
        wholesalePrice: 55000, // 55.000 LYD
        quantity: 10,
        reorderPoint: 5,
        batchNo: 'BATCH-2026-A',
        expiryDate: '2027-12-31',
      },
    });
    expect([200, 201]).toContain(createProdRes.statusCode);
    const coffeeProduct = createProdRes.json();
    expect(coffeeProduct.id).toBeDefined();
    expect(coffeeProduct.barcode).toBe('6291100000012');

    // 2. Search Product by Barcode
    const barcodeSearchRes = await app.inject({
      method: 'GET',
      url: '/api/products/barcode/6291100000012',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(barcodeSearchRes.statusCode).toBe(200);
    expect(barcodeSearchRes.json().id).toBe(coffeeProduct.id);

    // 3. Create Equipment Product with Serial & Warranty
    const createEquipRes = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'آلة إسبراسو إيطالية 2 جروب',
        type: 'equipment',
        category: 'المعدات',
        baseUnit: 'جهاز',
        barcode: '6291100000099',
        costPrice: 8500000, // 8500.000 LYD
        retailPrice: 10500000, // 10500.000 LYD
        wholesalePrice: 9800000, // 9800.000 LYD
        quantity: 2,
        reorderPoint: 1,
        serialNumber: 'SN-EXP-99482',
        warrantyMonths: 24,
      },
    });
    expect([200, 201]).toContain(createEquipRes.statusCode);
    const machineProduct = createEquipRes.json();

    // 4. Create Supplier & Record Purchase Invoice (Stock Addition)
    const createSupRes = await app.inject({
      method: 'POST',
      url: '/api/suppliers',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'شركة الاستيراد الذهبية للمعدات',
        phone: '0910000000',
        address: 'طرابلس - شارع الجرابة',
        notes: 'مورد رئيسي لماكينات القهوة',
      },
    });
    expect([200, 201]).toContain(createSupRes.statusCode);
    const supplier = createSupRes.json();

    const purchaseRes = await app.inject({
      method: 'POST',
      url: '/api/purchases',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        supplierId: supplier.id,
        items: [
          {
            productId: coffeeProduct.id,
            quantity: 20, // Add 20 more units
            unitCost: 38000, // 38.000 LYD (Weighted average will update cost)
          },
        ],
        // Recorded as supplier debt: paying cash requires an open drawer shift,
        // and the shift is opened later in this flow.
        paid: 0,
        notes: 'فاتورة شراء شحنة قهوة جديدة',
      },
    });
    expect([200, 201]).toContain(purchaseRes.statusCode);
    const purchaseInvoice = purchaseRes.json();
    expect(purchaseInvoice.invoiceNumber).toMatch(/^PUR-2026-/);

    // Verify Stock increased to 10 + 20 = 30
    const checkStockRes = await app.inject({
      method: 'GET',
      url: `/api/products/${coffeeProduct.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(checkStockRes.json().quantity).toBe(30);

    // 5. Open Shift with Initial Drawer Cash (150.000 LYD)
    const openShiftRes = await app.inject({
      method: 'POST',
      url: '/api/shifts/open',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { openingCash: 150000 },
    });
    expect([200, 201]).toContain(openShiftRes.statusCode);
    const activeShift = openShiftRes.json();
    expect(activeShift.status).toBe('open');

    // Verify Active Shift endpoint
    const currentShiftRes = await app.inject({
      method: 'GET',
      url: '/api/shifts/active',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(currentShiftRes.statusCode).toBe(200);
    expect(currentShiftRes.json().active.id).toBe(activeShift.id);

    // 6. Perform Cash Sale in POS (Sell 5 units of Coffee)
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [
          {
            productId: coffeeProduct.id,
            quantity: 5,
            unitPrice: 65000,
          },
        ],
        discount: 0,
        paymentType: 'cash',
        paymentMethod: 'cash',
      },
    });
    expect([200, 201]).toContain(saleRes.statusCode);
    const saleInvoice = saleRes.json();
    expect(saleInvoice.invoiceNumber).toMatch(/^INV-2026-/);
    expect(saleInvoice.total).toBe(5 * 65000); // 325.000 LYD

    // Check stock reduced from 30 -> 25
    const stockAfterSale1 = await app.inject({
      method: 'GET',
      url: `/api/products/${coffeeProduct.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(stockAfterSale1.json().quantity).toBe(25);

    // 7. Sell larger quantity to trigger low stock (Sell 21 units -> stock becomes 4 <= reorderPoint 5)
    const lowStockSaleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [
          {
            productId: coffeeProduct.id,
            quantity: 21,
            unitPrice: 65000,
          },
        ],
        discount: 0,
        paymentType: 'cash',
        paymentMethod: 'cash',
      },
    });
    expect([200, 201]).toContain(lowStockSaleRes.statusCode);

    // Verify stock is now 4 (Low Stock!)
    const stockAfterSale2 = await app.inject({
      method: 'GET',
      url: `/api/products/${coffeeProduct.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(stockAfterSale2.json().quantity).toBe(4);

    // Check products list to confirm low stock filtering / presence
    const allProductsRes = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: { authorization: `Bearer ${salesToken}` },
    });
    const lowStockProductInList = allProductsRes.json().find((p: any) => p.id === coffeeProduct.id);
    expect(lowStockProductInList.quantity).toBeLessThanOrEqual(lowStockProductInList.reorderPoint);

    // 8. Create Customer & Perform Credit Sale
    const createCustRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        name: 'مقهى الأندلس الأنيق',
        phone: '0921112233',
        address: 'طرابلس - النوفليين',
      },
    });
    expect([200, 201]).toContain(createCustRes.statusCode);
    const customer = createCustRes.json();

    const creditSaleRes = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        items: [
          {
            productId: machineProduct.id,
            quantity: 1,
            unitPrice: 10500000,
            serialNumber: 'SN-EXP-99482',
          },
        ],
        discount: 500000, // 500 LYD discount
        paymentType: 'credit',
        customerId: customer.id,
      },
    });
    expect([200, 201]).toContain(creditSaleRes.statusCode);
    const creditInvoice = creditSaleRes.json();
    expect(creditInvoice.total).toBe(10000000); // 10,000.000 LYD

    // Check Customer Balance (Debt = 10,000.000 LYD)
    const custDetailRes = await app.inject({
      method: 'GET',
      url: `/api/customers/${customer.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(custDetailRes.json().creditBalance).toBe(10000000);

    // 9. Record Customer Debt Payment (2,000.000 LYD)
    const custPayRes = await app.inject({
      method: 'POST',
      url: `/api/customers/${customer.id}/payments`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        amount: 2000000,
        notes: 'دفعة تحت الحساب عداً ونقداً',
      },
    });
    expect([200, 201]).toContain(custPayRes.statusCode);

    // Verify updated customer balance (10,000 - 2,000 = 8,000 LYD)
    const custAfterPayRes = await app.inject({
      method: 'GET',
      url: `/api/customers/${customer.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(custAfterPayRes.json().creditBalance).toBe(8000000);

    // 10. Record Shift Cash Expense (50.000 LYD)
    const expRes = await app.inject({
      method: 'POST',
      url: '/api/expenses',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: {
        amount: 50000,
        reason: 'شراء أوراق طباعة وضيافة للمحل',
        category: 'مستلزمات التشغيل',
      },
    });
    expect([200, 201]).toContain(expRes.statusCode);

    // 11. Fetch Financial Reports & Sales List
    const salesReportRes = await app.inject({
      method: 'GET',
      url: '/api/sales',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(salesReportRes.statusCode).toBe(200);
    const salesList = salesReportRes.json();
    expect(salesList.length).toBe(3); // 2 cash + 1 credit

    // 12. Cancel / Refund Sale Invoice (Cash Sale 1) with Manager PIN Override
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/sales/${saleInvoice.id}/cancel`,
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { overridePin: '1111' },
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().status).toBe('cancelled');

    // Check stock restored after cancellation (4 + 5 = 9)
    const stockAfterCancel = await app.inject({
      method: 'GET',
      url: `/api/products/${coffeeProduct.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(stockAfterCancel.json().quantity).toBe(9);

    // 13. Close Shift with Actual Cash Count
    // Cash Calculation:
    // Opening: 150,000
    // Sale 1 Cash: +325,000 (then refunded -325,000) = 0 net
    // Sale 2 Cash: 21 * 65,000 = +1,365,000
    // Cust Pay Cash: +2,000,000
    // Expenses Cash: -50,000
    // Total Expected Cash = 150k + 1,365k + 2,000k - 50k = 3,465,000 milli-LYD (3,465.000 LYD)
    const closeShiftRes = await app.inject({
      method: 'POST',
      url: '/api/shifts/close',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { actualCash: 3465000 },
    });
    expect(closeShiftRes.statusCode).toBe(200);
    const closedShift = closeShiftRes.json();
    expect(closedShift.status).toBe('closed');
    expect(closedShift.variance).toBe(0); // Zero variance

    // 14. Audit Logs Verification
    const auditLogsRes = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(auditLogsRes.statusCode).toBe(200);
    expect(auditLogsRes.json().length).toBeGreaterThan(0);
  });
});
