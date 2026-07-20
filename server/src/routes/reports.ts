import type { FastifyInstance } from 'fastify';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import {
  sales,
  saleItems,
  products,
  shifts,
  customers,
  auditLogs,
  users,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';

export async function reportRoutes(app: FastifyInstance) {
  // All report endpoints require manager authentication (financial visibility)
  app.addHook('preHandler', authenticateRequest);

  // GET /api/reports/analytics — Comprehensive aggregated analytics & trends
  app.get('/reports/analytics', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'التقارير المالية متاحة للمدير فقط' });
    }

    const { startDate, endDate, slowDays } = (req.query as any) || {};
    const slowDaysVal = Number(slowDays || 30);

    const allSales = app.db.select().from(sales).all();
    const allSaleItems = app.db.select().from(saleItems).all();
    const allProducts = app.db.select().from(products).all();

    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // Date filtering
    let filteredSales = allSales.filter((s) => s.status === 'completed');
    if (startDate) {
      filteredSales = filteredSales.filter((s) => s.createdAt >= startDate);
    }
    if (endDate) {
      filteredSales = filteredSales.filter((s) => s.createdAt <= endDate + 'T23:59:59.999Z');
    }

    const filteredSaleIds = new Set(filteredSales.map((s) => s.id));
    const filteredItems = allSaleItems.filter((i) => filteredSaleIds.has(i.saleId));

    // 1. Totals Calculation
    let grossSales = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let netSales = 0;
    let totalCost = 0;

    for (const s of filteredSales) {
      totalDiscount += s.discount;
      totalTax += s.taxAmount;
      netSales += s.total;
    }

    for (const item of filteredItems) {
      grossSales += item.total;
      const p = productMap.get(item.productId);
      const cost = p ? p.costPrice : 0;
      totalCost += item.quantity * cost;
    }

    const totalProfit = netSales - totalCost;

    // 2. Sales Trend Daily Grouping
    const trendMap = new Map<string, { date: string; sales: number; profit: number; count: number }>();
    for (const s of filteredSales) {
      const dateStr = s.createdAt.slice(0, 10);
      const entry = trendMap.get(dateStr) || { date: dateStr, sales: 0, profit: 0, count: 0 };
      entry.sales += s.total;
      entry.count += 1;

      // Add profit for items in this sale
      const itemsInSale = filteredItems.filter((i) => i.saleId === s.id);
      let saleCost = 0;
      for (const item of itemsInSale) {
        const p = productMap.get(item.productId);
        saleCost += item.quantity * (p ? p.costPrice : 0);
      }
      entry.profit += s.total - saleCost;
      trendMap.set(dateStr, entry);
    }
    const trendData = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 3. Top Products Breakdown
    const productStatsMap = new Map<number, { id: number; name: string; category: string; qty: number; revenue: number; profit: number }>();
    for (const item of filteredItems) {
      const p = productMap.get(item.productId);
      const cost = p ? p.costPrice : 0;
      const profit = item.total - item.quantity * cost;

      const entry = productStatsMap.get(item.productId) || {
        id: item.productId,
        name: p ? p.name : `منتج #${item.productId}`,
        category: p?.category || 'عام',
        qty: 0,
        revenue: 0,
        profit: 0,
      };
      entry.qty += item.quantity;
      entry.revenue += item.total;
      entry.profit += profit;
      productStatsMap.set(item.productId, entry);
    }
    const topProducts = Array.from(productStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 4. Category Breakdown
    const categoryMap = new Map<string, { category: string; revenue: number; profit: number; qty: number }>();
    for (const item of filteredItems) {
      const p = productMap.get(item.productId);
      const category = p?.category || 'عام';
      const cost = p ? p.costPrice : 0;
      const profit = item.total - item.quantity * cost;

      const entry = categoryMap.get(category) || { category, revenue: 0, profit: 0, qty: 0 };
      entry.revenue += item.total;
      entry.profit += profit;
      entry.qty += item.quantity;
      categoryMap.set(category, entry);
    }
    const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);

    // 5. Slow Moving Products (No sales in last N days)
    const cutoffDate = new Date(Date.now() - slowDaysVal * 24 * 60 * 60 * 1000).toISOString();
    const recentSaleProductIds = new Set(
      allSaleItems
        .filter((i) => {
          const sale = allSales.find((s) => s.id === i.saleId);
          return sale && sale.status === 'completed' && sale.createdAt >= cutoffDate;
        })
        .map((i) => i.productId)
    );

    const slowMovingProducts = allProducts
      .filter((p) => p.quantity > 0 && !recentSaleProductIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        quantity: p.quantity,
        baseUnit: p.baseUnit,
        costPrice: p.costPrice,
        retailPrice: p.retailPrice,
        tiedCapital: p.quantity * p.costPrice,
      }))
      .sort((a, b) => b.tiedCapital - a.tiedCapital);

    return {
      summary: {
        grossSales,
        totalDiscount,
        totalTax,
        netSales,
        totalCost,
        totalProfit,
        completedInvoicesCount: filteredSales.length,
      },
      trendData,
      topProducts,
      categoryBreakdown,
      slowMovingProducts,
    };
  });

  // GET /api/reports/excel — Generate & Stream Excel (.xlsx) file
  app.get('/reports/excel', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'التصدير متاح للمدير فقط' });
    }

    const { type } = (req.query as any) || {};

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'منظومة Flow POS';
    workbook.created = new Date();

    if (type === 'products') {
      const sheet = workbook.addWorksheet('قائمة المنتجات والمخزون', { views: [{ rightToLeft: true }] });
      sheet.columns = [
        { header: 'معرف المنتج', key: 'id', width: 12 },
        { header: 'اسم المنتج', key: 'name', width: 30 },
        { header: 'النوع', key: 'type', width: 15 },
        { header: 'القسم', key: 'category', width: 20 },
        { header: 'الوحدة الأساسية', key: 'baseUnit', width: 15 },
        { header: 'الباركد', key: 'barcode', width: 20 },
        { header: 'سعر الشراء (د.ل)', key: 'costPrice', width: 18 },
        { header: 'سعر التجزئة (د.ل)', key: 'retailPrice', width: 18 },
        { header: 'سعر الجملة (د.ل)', key: 'wholesalePrice', width: 18 },
        { header: 'المخزون الحالي', key: 'quantity', width: 15 },
        { header: 'رأس المال المستثمر (د.ل)', key: 'totalCapital', width: 22 },
      ];

      const allProducts = app.db.select().from(products).all();
      for (const p of allProducts) {
        sheet.addRow({
          id: p.id,
          name: p.name,
          type: p.type === 'equipment' ? 'معدة/جهاز' : 'استهلاكي',
          category: p.category,
          baseUnit: p.baseUnit,
          barcode: p.barcode || '—',
          costPrice: (p.costPrice / 1000).toFixed(3),
          retailPrice: (p.retailPrice / 1000).toFixed(3),
          wholesalePrice: (p.wholesalePrice / 1000).toFixed(3),
          quantity: p.quantity,
          totalCapital: ((p.quantity * p.costPrice) / 1000).toFixed(3),
        });
      }
    } else if (type === 'sales') {
      const sheet = workbook.addWorksheet('سجل مبيعات الفواتير', { views: [{ rightToLeft: true }] });
      sheet.columns = [
        { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 20 },
        { header: 'تاريخ البيع', key: 'createdAt', width: 22 },
        { header: 'المسؤول', key: 'username', width: 18 },
        { header: 'العميل', key: 'customerName', width: 25 },
        { header: 'نوع الدفع', key: 'paymentType', width: 15 },
        { header: 'وسيلة الدفع', key: 'paymentMethod', width: 15 },
        { header: 'الخصم (د.ل)', key: 'discount', width: 15 },
        { header: 'الإجمالي (د.ل)', key: 'total', width: 18 },
        { header: 'الحالة', key: 'status', width: 15 },
      ];

      const allSales = app.db.select().from(sales).orderBy(desc(sales.id)).all();
      const allUsers = app.db.select().from(users).all();
      const userMap = new Map(allUsers.map((u) => [u.id, u.username]));

      for (const s of allSales) {
        sheet.addRow({
          invoiceNumber: s.invoiceNumber,
          createdAt: new Date(s.createdAt).toLocaleString('ar-LY'),
          username: userMap.get(s.userId) || 'كاشير',
          customerName: s.customerName || 'نقدي عام',
          paymentType: s.paymentType === 'cash' ? 'نقدي' : 'آجل',
          paymentMethod: s.paymentMethod === 'cash' ? 'كاش' : s.paymentMethod === 'card' ? 'بطاقة' : 'حوالة',
          discount: (s.discount / 1000).toFixed(3),
          total: (s.total / 1000).toFixed(3),
          status: s.status === 'completed' ? 'مدفوعة' : 'ملغاة',
        });
      }
    } else {
      const sheet = workbook.addWorksheet('ملخص التقارير العامة', { views: [{ rightToLeft: true }] });
      sheet.columns = [
        { header: 'البيان', key: 'title', width: 30 },
        { header: 'القيمة', key: 'val', width: 25 },
      ];
      sheet.addRow({ title: 'تاريخ الاستخراج', val: new Date().toLocaleString('ar-LY') });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="report_${type}_${Date.now()}.xlsx"`);
    return reply.send(buffer);
  });
}
