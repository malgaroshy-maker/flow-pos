import type { FastifyInstance } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import {
  products,
  customers,
  quotations,
  sales,
  saleItems,
  warranties,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';

export interface NotificationItem {
  id: string;
  type: 'low_stock' | 'expiry' | 'overdue_debt' | 'expiring_quote' | 'warranty_ending';
  severity: 'info' | 'warning' | 'alert';
  title: string;
  message: string;
  tab: string; // Nav tab to open
  createdAt: string;
}

export async function notificationRoutes(app: FastifyInstance) {
  // All notification endpoints require authenticated user session
  app.addHook('preHandler', authenticateRequest);

  app.get('/notifications', async (req, reply) => {
    const notifications: NotificationItem[] = [];
    const now = new Date();
    const nowIso = now.toISOString();

    const allProducts = app.db.select().from(products).all();
    const allCustomers = app.db.select().from(customers).all();
    const allQuotations = app.db.select().from(quotations).all();
    const allWarranties = app.db.select().from(warranties).all();

    // 1. Low Stock Alerts
    for (const p of allProducts) {
      const available = p.quantity - (p.reservedQuantity || 0);
      if (available <= p.reorderPoint) {
        notifications.push({
          id: `low_stock_${p.id}`,
          type: 'low_stock',
          severity: available <= 0 ? 'alert' : 'warning',
          title: available <= 0 ? 'نفاد مخزون صنف' : 'تنبيه إعادة الطلب',
          message: `المنتج "${p.name}" المتبقي منه (${available} ${p.baseUnit}) وهو عند أو أقل من حد الطلب (${p.reorderPoint})`,
          tab: 'Products',
          createdAt: nowIso,
        });
      }

      // 2. Expiry Date Approaching (within 30 days)
      if (p.expiryDate) {
        const expiryTime = new Date(p.expiryDate).getTime();
        const diffDays = Math.ceil((expiryTime - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          notifications.push({
            id: `expiry_${p.id}`,
            type: 'expiry',
            severity: diffDays <= 7 ? 'alert' : 'warning',
            title: diffDays <= 0 ? 'صلاحية منتهية' : 'قرب انتهاء الصلاحية',
            message: `الصنف "${p.name}" (دفعة ${p.batchNo || 'عام'}) ينتهي تاريخ صلاحيته خلال ${diffDays} يوماً (${p.expiryDate})`,
            tab: 'Products',
            createdAt: nowIso,
          });
        }
      }
    }

    // 3. Overdue Customer Debts
    for (const c of allCustomers) {
      if (c.creditBalance > 0) {
        notifications.push({
          id: `debt_${c.id}`,
          type: 'overdue_debt',
          severity: 'info',
          title: 'ذمة قائمة على عميل',
          message: `العميل "${c.name}" عليه دين مستحق بقيمة (${(c.creditBalance / 1000).toFixed(3)} د.ل)`,
          tab: 'Customers',
          createdAt: nowIso,
        });
      }
    }

    // 4. Expiring Quotations (within 3 days)
    for (const q of allQuotations) {
      if (q.status === 'active') {
        const validTime = new Date(q.validUntil).getTime();
        const diffDays = Math.ceil((validTime - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
          notifications.push({
            id: `quote_${q.id}`,
            type: 'expiring_quote',
            severity: diffDays <= 1 ? 'alert' : 'warning',
            title: 'قرب انتهاء عرض سعر',
            message: `عرض السعر #${q.quoteNumber} للعميل (${q.customerName || 'عام'}) سينتهي صلاحيته خلال ${diffDays} يوم`,
            tab: 'Quotations',
            createdAt: nowIso,
          });
        }
      }
    }

    // 5. Warranties ending soon (within 30 days)
    for (const w of allWarranties) {
      const endTime = new Date(w.endDate).getTime();
      const diffDays = Math.ceil((endTime - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        notifications.push({
          id: `warranty_${w.id}`,
          type: 'warranty_ending',
          severity: diffDays <= 7 ? 'alert' : 'warning',
          title: 'قرب انتهاء ضمان',
          message: `ضمان "${w.productName}" (رقم تسلسلي ${w.serialNumber}) ينتهي خلال ${diffDays} يوماً (${w.endDate.slice(0, 10)})`,
          tab: 'Warranty',
          createdAt: nowIso,
        });
      }
    }

    return notifications;
  });
}
