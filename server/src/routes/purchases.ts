import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import {
  purchases,
  purchaseItems,
  products,
  stockMovements,
  suppliers,
  auditLogs,
  users,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';

export async function purchaseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // List all purchases
  app.get('/purchases', async (_req, _reply) => {
    const list = app.db.select().from(purchases).orderBy(desc(purchases.id)).all();
    const userList = app.db.select({ id: users.id, username: users.username }).from(users).all();
    const userMap = new Map(userList.map((u) => [u.id, u.username]));
    return list.map((p) => ({ ...p, username: userMap.get(p.userId) || 'غير معروف' }));
  });

  // Get single purchase with items
  app.get('/purchases/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const purchase = app.db.select().from(purchases).where(eq(purchases.id, id)).get();
    if (!purchase) return reply.code(404).send({ error: 'not_found' });
    const items = app.db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id)).all();
    return { ...purchase, items };
  });

  // Create purchase (receive stock from supplier) - manager only
  app.post('/purchases', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تسجيل المشتريات متاح للمدراء فقط' });
    }

    const body = req.body as {
      supplierId?: number;
      supplierName?: string;
      items: Array<{ productId: number; quantity: number; unitCost: number }>;
      paid?: number;
      notes?: string;
    };

    if (!body.items || body.items.length === 0) {
      return reply
        .code(400)
        .send({ error: 'missing_items', message: 'يجب إضافة منتج واحد على الأقل' });
    }

    const result = app.sqlite.transaction(() => {
      const now = new Date().toISOString();
      const year = new Date().getFullYear();

      // Generate purchase invoice number
      const lastPurchase = app.db
        .select({ invoiceNumber: purchases.invoiceNumber })
        .from(purchases)
        .orderBy(desc(purchases.id))
        .limit(1)
        .get();

      let seqNum = 1;
      if (lastPurchase?.invoiceNumber) {
        const match = lastPurchase.invoiceNumber.match(/PUR-\d{4}-(\d+)/);
        if (match && match[1]) seqNum = parseInt(match[1], 10) + 1;
      }
      const invoiceNumber = `PUR-${year}-${String(seqNum).padStart(5, '0')}`;

      // Calculate total
      let totalCost = 0;
      const processedItems: Array<{
        productId: number;
        productName: string;
        quantity: number;
        unitCost: number;
        total: number;
      }> = [];

      for (const item of body.items) {
        const product = app.db.select().from(products).where(eq(products.id, item.productId)).get();
        if (!product) throw new Error(`المنتج ${item.productId} غير موجود`);

        const lineTotal = item.quantity * item.unitCost;
        totalCost += lineTotal;

        // Update product quantity using weighted average cost
        const newQty = product.quantity + item.quantity;
        const oldTotalCost = product.quantity * product.costPrice;
        const addedCost = item.quantity * item.unitCost;
        const newAvgCost =
          newQty > 0 ? Math.round((oldTotalCost + addedCost) / newQty) : item.unitCost;

        app.db
          .update(products)
          .set({ quantity: newQty, costPrice: newAvgCost })
          .where(eq(products.id, item.productId))
          .run();

        // Stock movement
        app.db
          .insert(stockMovements)
          .values({
            productId: item.productId,
            type: 'purchase',
            quantity: item.quantity,
            balanceAfter: newQty,
            reason: `استلام بضاعة - فاتورة ${invoiceNumber}`,
            userId: req.user!.userId,
            createdAt: now,
          })
          .run();

        processedItems.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: lineTotal,
        });
      }

      const paid = body.paid ?? totalCost;
      const unpaid = totalCost - paid;
      const status: 'paid' | 'partial' | 'pending' =
        paid >= totalCost ? 'paid' : paid > 0 ? 'partial' : 'pending';

      // Create purchase record
      const purchaseResult = app.db
        .insert(purchases)
        .values({
          invoiceNumber,
          supplierId: body.supplierId || null,
          supplierName: body.supplierName || null,
          total: totalCost,
          paid,
          status,
          notes: body.notes || null,
          userId: req.user!.userId,
          createdAt: now,
        })
        .run();

      const purchaseId = Number(purchaseResult.lastInsertRowid);

      // Insert items
      for (const item of processedItems) {
        app.db
          .insert(purchaseItems)
          .values({ purchaseId, ...item })
          .run();
      }

      // If there's unpaid amount and a supplier, add to their debt
      if (unpaid > 0 && body.supplierId) {
        const supplier = app.db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, body.supplierId))
          .get();
        if (supplier) {
          app.db
            .update(suppliers)
            .set({ debtBalance: supplier.debtBalance + unpaid })
            .where(eq(suppliers.id, body.supplierId))
            .run();
        }
      }

      // Audit log
      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'create_purchase',
          details: `فاتورة مشتريات ${invoiceNumber}: إجمالي ${(totalCost / 1000).toFixed(3)} د.ل، مدفوع ${(paid / 1000).toFixed(3)} د.ل`,
          createdAt: now,
        })
        .run();

      return { success: true, invoiceNumber, purchaseId, total: totalCost, paid, status };
    })();

    return result;
  });
}
