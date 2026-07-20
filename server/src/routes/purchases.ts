import type { FastifyInstance } from 'fastify';
import { eq, desc, like } from 'drizzle-orm';
import {
  purchases,
  purchaseItems,
  products,
  stockMovements,
  suppliers,
  supplierReturns,
  auditLogs,
  users,
  shifts,
  cashMovements,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { lineTotal } from '../lib/money.js';
import { requireNonNegativeInt, requirePositiveInt, ValidationError } from '../lib/validate.js';

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

    try {
      for (const item of body.items) {
        requirePositiveInt(item.productId, 'productId');
        requirePositiveInt(item.quantity, 'quantity');
        requireNonNegativeInt(item.unitCost, 'unitCost');
      }
      if (body.paid !== undefined) requireNonNegativeInt(body.paid, 'paid');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    // Cash leaving the drawer must be tied to an open shift.
    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    const willPay = body.paid === undefined || body.paid > 0;
    if (willPay && !activeShift) {
      return reply.code(400).send({
        error: 'no_active_shift',
        message: 'دفع نقدية للمورد يتطلب توكة مفتوحة. افتح توكة أو سجل الفاتورة كدين (مدفوع = 0)',
      });
    }

    const result = app.sqlite.transaction(() => {
      const now = new Date().toISOString();
      const year = new Date().getFullYear();

      // Generate purchase invoice number: PUR-YYYY-NNNNN, max+1 within the year
      // (same strategy as sales invoices).
      const yearPrefix = `PUR-${year}-`;
      const matching = app.db
        .select({ invoiceNumber: purchases.invoiceNumber })
        .from(purchases)
        .where(like(purchases.invoiceNumber, `${yearPrefix}%`))
        .all();
      let maxNum = 0;
      for (const p of matching) {
        const num = parseInt(p.invoiceNumber.slice(yearPrefix.length), 10);
        if (Number.isFinite(num) && num > maxNum) maxNum = num;
      }
      const invoiceNumber = `${yearPrefix}${String(maxNum + 1).padStart(5, '0')}`;

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

        const itemTotal = lineTotal(item.unitCost, item.quantity);
        totalCost += itemTotal;

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
          total: itemTotal,
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

      // Record cash leaving the drawer (open shift already verified above)
      if (paid > 0 && activeShift) {
        app.db
          .insert(cashMovements)
          .values({
            shiftId: activeShift.id,
            type: 'expense',
            amount: -paid,
            referenceId: invoiceNumber,
            userId: req.user!.userId,
            createdAt: now,
          })
          .run();
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

  // Supplier return against an existing purchase (manager only).
  // Stock goes down, and the value comes back either as reduced supplier debt
  // or as cash into the open drawer shift.
  app.post('/purchases/:id/return', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'مرتجع المشتريات متاح للمدراء فقط' });
    }

    const purchaseId = Number((req.params as { id: string }).id);
    const body = req.body as {
      items?: Array<{ productId: number; quantity: number }>;
      refundMethod?: 'debt' | 'cash';
    };
    const refundMethod = body.refundMethod ?? 'debt';

    if (!body.items || body.items.length === 0) {
      return reply
        .code(400)
        .send({ error: 'missing_items', message: 'حدد الأصناف والكميات المرتجعة' });
    }
    if (refundMethod !== 'debt' && refundMethod !== 'cash') {
      return reply
        .code(400)
        .send({ error: 'invalid_refund_method', message: 'طريقة الاسترداد غير صالحة' });
    }

    try {
      for (const item of body.items) {
        requirePositiveInt(item.productId, 'productId');
        requirePositiveInt(item.quantity, 'quantity');
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const purchase = app.db.select().from(purchases).where(eq(purchases.id, purchaseId)).get();
    if (!purchase) {
      return reply.code(404).send({ error: 'not_found', message: 'فاتورة المشتريات غير موجودة' });
    }

    if (refundMethod === 'debt' && !purchase.supplierId) {
      return reply.code(400).send({
        error: 'no_supplier',
        message: 'لا يمكن تخفيض دين مورد لفاتورة بدون مورد — استخدم الاسترداد النقدي',
      });
    }

    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (refundMethod === 'cash' && !activeShift) {
      return reply.code(400).send({
        error: 'no_active_shift',
        message: 'الاسترداد النقدي من المورد يتطلب توكة مفتوحة لإيداع المبلغ في الدرج',
      });
    }

    try {
      const result = app.sqlite.transaction(() => {
        const now = new Date().toISOString();
        const lines = app.db
          .select()
          .from(purchaseItems)
          .where(eq(purchaseItems.purchaseId, purchaseId))
          .all();

        let returnValue = 0;
        for (const item of body.items!) {
          const line = lines.find((l) => l.productId === item.productId);
          if (!line) {
            throw new Error(`item_not_in_purchase:${item.productId}`);
          }
          const returnable = line.quantity - line.returnedQuantity;
          if (item.quantity > returnable) {
            throw new Error(`over_return:${line.productName}:${returnable}`);
          }

          const product = app.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .get();
          if (!product) throw new Error(`item_not_in_purchase:${item.productId}`);
          if (product.quantity < item.quantity) {
            throw new Error(`insufficient_stock:${product.name}:${product.quantity}`);
          }

          const newQty = product.quantity - item.quantity;
          app.db
            .update(products)
            .set({ quantity: newQty })
            .where(eq(products.id, item.productId))
            .run();

          app.db
            .insert(stockMovements)
            .values({
              productId: item.productId,
              type: 'supplier_return',
              quantity: -item.quantity,
              balanceAfter: newQty,
              reason: `مرتجع مشتريات - فاتورة ${purchase.invoiceNumber}`,
              userId: req.user!.userId,
              createdAt: now,
            })
            .run();

          app.db
            .update(purchaseItems)
            .set({ returnedQuantity: line.returnedQuantity + item.quantity })
            .where(eq(purchaseItems.id, line.id))
            .run();

          returnValue += lineTotal(line.unitCost, item.quantity);
        }

        if (purchase.supplierId) {
          app.db
            .insert(supplierReturns)
            .values({
              purchaseId,
              supplierId: purchase.supplierId,
              amount: returnValue,
              refundMethod: refundMethod as 'debt' | 'cash',
              userId: req.user!.userId,
              createdAt: now,
            })
            .run();
        }

        if (refundMethod === 'debt') {
          const supplier = app.db
            .select()
            .from(suppliers)
            .where(eq(suppliers.id, purchase.supplierId!))
            .get();
          if (supplier) {
            // May go negative: the supplier then owes us the difference.
            app.db
              .update(suppliers)
              .set({ debtBalance: supplier.debtBalance - returnValue })
              .where(eq(suppliers.id, supplier.id))
              .run();
          }
        } else {
          app.db
            .insert(cashMovements)
            .values({
              shiftId: activeShift!.id,
              type: 'deposit',
              amount: returnValue,
              referenceId: `مرتجع مشتريات ${purchase.invoiceNumber}`,
              userId: req.user!.userId,
              createdAt: now,
            })
            .run();
        }

        app.db
          .insert(auditLogs)
          .values({
            userId: req.user!.userId,
            action: 'supplier_return',
            details: `مرتجع مشتريات على الفاتورة ${purchase.invoiceNumber} بقيمة ${(returnValue / 1000).toFixed(3)} د.ل (${refundMethod === 'debt' ? 'خصم من دين المورد' : 'استرداد نقدي للدرج'})`,
            createdAt: now,
          })
          .run();

        return { success: true, returnValue, refundMethod };
      })();

      return result;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.startsWith('item_not_in_purchase:')) {
        return reply.code(400).send({
          error: 'item_not_in_purchase',
          message: 'أحد الأصناف غير موجود في فاتورة المشتريات الأصلية',
        });
      }
      if (msg.startsWith('over_return:')) {
        const [, name, returnable] = msg.split(':');
        return reply.code(400).send({
          error: 'over_return',
          message: `الكمية المرتجعة للصنف (${name}) تتجاوز المتاح للإرجاع (${returnable})`,
        });
      }
      if (msg.startsWith('insufficient_stock:')) {
        const [, name, qty] = msg.split(':');
        return reply.code(400).send({
          error: 'insufficient_stock',
          message: `المخزون الحالي للصنف (${name}) هو ${qty} فقط — لا يمكن إرجاع كمية أكبر من الموجود`,
        });
      }
      throw err;
    }
  });
}
