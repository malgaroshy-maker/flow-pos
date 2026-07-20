import { test, expect } from '@playwright/test';

test.describe('Flow POS E2E Core Operational Smoke Test', () => {
  test('executes complete cycle: login -> POS sale -> invoice print -> logout', async ({
    page,
    request,
  }) => {
    // 0. AUTHENTICATE AND PREPARE STATE VIA BACKEND API
    const loginApiRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'مدير', password: 'admin' },
    });
    expect(loginApiRes.ok()).toBeTruthy();
    const { token } = await loginApiRes.json();
    const authHeader = { Authorization: `Bearer ${token}` };

    // Ensure active shift exists via API
    const activeShiftRes = await request.get('http://localhost:3001/api/shifts/active', {
      headers: authHeader,
    });
    const shiftData = await activeShiftRes.json();

    if (!shiftData || !shiftData.active) {
      await request.post('http://localhost:3001/api/shifts/open', {
        headers: authHeader,
        data: { openingCash: 100000 },
      });
    }

    // Seed demo product for POS sale
    await request.post('http://localhost:3001/api/products', {
      headers: authHeader,
      data: {
        name: 'قهوة ديمو الدخان',
        type: 'consumable',
        category: 'مشروبات',
        baseUnit: 'كوب',
        costPrice: 5000,
        retailPrice: 10000,
        wholesalePrice: 8000,
        quantity: 100,
        barcode: '9988776655',
      },
    });

    // 1. LOGIN VIA UI
    await page.goto('/');

    await page.fill('input[type="text"]', 'مدير');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');

    // Verify main app navbar loaded
    const posNavBtn = page.locator('button:has-text("نقطة البيع")').first();
    await expect(posNavBtn).toBeVisible({ timeout: 10000 });

    // 2. POS SALE FLOW
    await posNavBtn.click();

    // Select 'قهوة ديمو الدخان' in POS grid
    const demoCard = page.locator('text=قهوة ديمو الدخان').first();
    await expect(demoCard).toBeVisible({ timeout: 10000 });
    await demoCard.click();

    // Complete sale by clicking "تأكيد البيع"
    const checkoutBtn = page.locator('button:has-text("تأكيد البيع")').first();
    await expect(checkoutBtn).toBeEnabled({ timeout: 5000 });
    await checkoutBtn.click();

    // 3. INVOICE PRINT VIEW VERIFICATION
    const printView = page.locator('.print-only').or(page.locator('text=معاينة الفاتورة')).or(page.locator('text=طباعة')).first();
    await expect(printView).toBeVisible({ timeout: 5000 });

    // Close invoice modal if open
    const closeModalBtn = page.locator('button:has-text("إغلاق")').or(page.locator('button:has-text("إلغاء")')).first();
    if (await closeModalBtn.isVisible({ timeout: 2000 })) {
      await closeModalBtn.click();
    }

    // 4. LOGOUT & CLEANUP
    const logoutBtn = page.locator('button:has-text("تسجيل الخروج")').first();
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify redirected back to login screen
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
  });
});
