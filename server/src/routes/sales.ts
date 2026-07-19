import type { FastifyInstance } from 'fastify';
import { eq, desc, like } from 'drizzle-orm';
import {
  sales,
  saleItems,
  products,
  stockMovements,
  cashMovements,
  auditLogs,
  shifts,
  settings,
  users,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { applyPermille, lineTotal } from '../lib/money.js';

export async function saleRoutes(app: FastifyInstance) {
  // Apply authentication to all sales routes
  app.addHook('preHandler', authenticateRequest);

  // List recent sales
  app.get('/sales', async (req, reply) => {
    const list = app.db.select().from(sales).orderBy(desc(sales.id)).all();

    // Fetch users for username mapping
    const userList = app.db.select({ id: users.id, username: users.username }).from(users).all();
    const userMap = new Map(userList.map((u) => [u.id, u.username]));

    return list.map((s) => ({
      ...s,
      username: userMap.get(s.userId) || 'غير معروف',
    }));
  });

  // Get single sale details with items
  app.get('/sales/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const saleId = Number(id);

    const sale = app.db.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) {
      return reply.code(404).send({ error: 'not_found', message: 'الفاتورة غير موجودة' });
    }

    const items = app.db
      .select({
        id: saleItems.id,
        productId: saleItems.productId,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        total: saleItems.total,
        productName: products.name,
        productType: products.type,
        baseUnit: products.baseUnit,
        serialNumber: saleItems.serialNumber,
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, saleId))
      .all();

    return { ...sale, items };
  });

  // Create a new cash/credit sale
  app.post('/sales', async (req, reply) => {
    const body = req.body as {
      items: Array<{
        productId: number;
        quantity: number;
        unitPrice: number;
        serialNumber?: string;
      }>;
      discount: number; // in milli-LYD
      paymentType: 'cash' | 'credit';
      paymentMethod: 'cash' | 'card' | 'transfer';
      overridePin?: string;
    };

    const { items, discount = 0, paymentType = 'cash', paymentMethod = 'cash', overridePin } = body;

    if (!items || items.length === 0) {
      return reply.code(400).send({ error: 'empty_cart', message: 'السلة فارغة' });
    }

    // 1. Must check for active shift
    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (!activeShift) {
      return reply
        .code(400)
        .send({ error: 'no_active_shift', message: 'لا توجد توكة مفتوحة لتسجيل المبيعات' });
    }

    // Load active settings for tax calculation
    const currentSettings = app.db.select().from(settings).where(eq(settings.id, 1)).get();
    const isTaxEnabled = currentSettings?.taxEnabled ?? false;
    const taxRatePermille = currentSettings?.taxRatePermille ?? 0;

    // Check discount cap
    let subtotal = 0;
    for (const item of items) {
      subtotal += lineTotal(item.unitPrice, item.quantity);
    }

    const discountCap = Math.floor(subtotal * 0.1); // default 10% discount cap for Sales role
    const isOverDiscountCap = discount > discountCap;

    // 2. Perform overrides or permission check
    let pinUser: any = null;
    if (overridePin) {
      pinUser = app.db.select().from(users).where(eq(users.pin, overridePin)).get();
      if (!pinUser || !pinUser.active || pinUser.role !== 'manager') {
        return reply
          .code(400)
          .send({ error: 'invalid_override_pin', message: 'رمز PIN الخاص بالمدير غير صحيح' });
      }
    }

    if (isOverDiscountCap && req.user!.role !== 'manager' && !pinUser) {
      return reply.code(400).send({
        error: 'discount_limit_exceeded',
        message: 'لقد تجاوزت حد الخصم المسموح به (10%). يرجى إدخال PIN المدير للموافقة.',
      });
    }

    // 3. Stock availability verification + Sale Execution inside SQLite Transaction
    try {
      const result = app.sqlite.transaction(() => {
        const now = new Date().toISOString();

        // Verification step inside transaction
        for (const item of items) {
          const product = app.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .get();
          if (!product) {
            throw new Error(`product_not_found:${item.productId}`);
          }
          if (product.quantity < item.quantity && !pinUser && req.user!.role !== 'manager') {
            throw new Error(`insufficient_stock:${product.name}:${product.quantity}`);
          }
        }

        // Generate gap-free sequential invoice number: INV-YYYY-NNNNN
        const currentYear = new Date().getFullYear();
        const yearPrefix = `INV-${currentYear}-`;
        const matchingSales = app.db
          .select({ invoiceNumber: sales.invoiceNumber })
          .from(sales)
          .where(like(sales.invoiceNumber, `${yearPrefix}%`))
          .all();

        const nextNum = matchingSales.length + 1;
        const invoiceNumber = `${yearPrefix}${String(nextNum).padStart(5, '0')}`;

        // Compute Tax & Totals
        const taxAmount = isTaxEnabled ? applyPermille(subtotal - discount, taxRatePermille) : 0;
        const total = subtotal + taxAmount - discount;

        // Create Sales record
        const saleInsert = app.db
          .insert(sales)
          .values({
            invoiceNumber,
            userId: req.user!.userId,
            shiftId: activeShift.id,
            paymentType,
            paymentMethod,
            taxAmount,
            discount,
            qrRef: invoiceNumber,
            total,
            status: 'completed',
            createdAt: now,
          })
          .run();

        const saleId = Number(saleInsert.lastInsertRowid);

        // Process each item
        for (const item of items) {
          const product = app.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .get()!;
          const newQty = product.quantity - item.quantity;

          // Update stock
          app.db
            .update(products)
            .set({ quantity: newQty })
            .where(eq(products.id, item.productId))
            .run();

          // Create stock movement ledger
          app.db
            .insert(stockMovements)
            .values({
              productId: item.productId,
              type: 'sale',
              quantity: -item.quantity,
              balanceAfter: newQty,
              reason: `مبيعات فاتورة رقم ${invoiceNumber}`,
              userId: req.user!.userId,
              createdAt: now,
            })
            .run();

          // Create sale items
          app.db
            .insert(saleItems)
            .values({
              saleId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: lineTotal(item.unitPrice, item.quantity),
              serialNumber: item.serialNumber || null,
            })
            .run();
        }

        // Cash flow movement (only for cash payments)
        if (paymentMethod === 'cash') {
          app.db
            .insert(cashMovements)
            .values({
              shiftId: activeShift.id,
              type: 'sale',
              amount: total,
              referenceId: invoiceNumber,
              userId: req.user!.userId,
              createdAt: now,
            })
            .run();
        }

        // Audit override if active
        if (pinUser) {
          app.db
            .insert(auditLogs)
            .values({
              userId: pinUser.id,
              action: 'manager_override_sale',
              details: `موافقة المدير ${pinUser.username} لتخطي الحدود لفاتورة ${invoiceNumber}`,
              createdAt: now,
            })
            .run();
        }

        // Audit sale
        app.db
          .insert(auditLogs)
          .values({
            userId: req.user!.userId,
            action: 'create_sale',
            details: `إنشاء فاتورة مبيعات ${invoiceNumber} بمبلغ إجمالي ${total} د.ل`,
            createdAt: now,
          })
          .run();

        return { id: saleId, invoiceNumber, total };
      })();

      return result;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.startsWith('product_not_found:')) {
        return reply.code(400).send({
          error: 'product_not_found',
          message: 'أحد المنتجات في السلة غير موجود في قاعدة البيانات',
        });
      }
      if (msg.startsWith('insufficient_stock:')) {
        const [, name, qty] = msg.split(':');
        return reply.code(400).send({
          error: 'insufficient_stock',
          message: `المخزون غير كافٍ للمنتج (${name})، الكمية المتاحة: ${qty}. يرجى طلب موافقة المدير لتجاوز الرصيد.`,
        });
      }
      throw err;
    }
  });

  // Cancel / Refund sale invoice (manager only or manager PIN override required)
  app.post('/sales/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const saleId = Number(id);
    const { overridePin } = req.body as { overridePin?: string };

    let overrideUser: any = null;
    if (overridePin) {
      overrideUser = app.db.select().from(users).where(eq(users.pin, overridePin)).get();
      if (!overrideUser || !overrideUser.active || overrideUser.role !== 'manager') {
        return reply
          .code(400)
          .send({ error: 'invalid_override_pin', message: 'رمز PIN الخاص بالمدير غير صحيح' });
      }
    }

    if (req.user!.role !== 'manager' && !overrideUser) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'إلغاء الفواتير يتطلب صلاحية مدير أو إدخال رمز PIN للمدير',
      });
    }

    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (!activeShift) {
      return reply
        .code(400)
        .send({ error: 'no_active_shift', message: 'يجب فتح توكة أولاً لإجراء عملية الإرجاع' });
    }

    try {
      const result = app.sqlite.transaction(() => {
        const sale = app.db.select().from(sales).where(eq(sales.id, saleId)).get();
        if (!sale) {
          throw new Error('sale_not_found');
        }
        if (sale.status === 'cancelled') {
          throw new Error('already_cancelled');
        }

        const now = new Date().toISOString();
        const actorId = overrideUser ? overrideUser.id : req.user!.userId;

        // Cancel sale
        app.db.update(sales).set({ status: 'cancelled' }).where(eq(sales.id, saleId)).run();

        // Get sale items to reverse stock
        const items = app.db.select().from(saleItems).where(eq(saleItems.saleId, saleId)).all();
        for (const item of items) {
          const product = app.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .get()!;
          const newQty = product.quantity + item.quantity;

          // Restore stock
          app.db
            .update(products)
            .set({ quantity: newQty })
            .where(eq(products.id, item.productId))
            .run();

          // Create stock movement ledger for return
          app.db
            .insert(stockMovements)
            .values({
              productId: item.productId,
              type: 'return',
              quantity: item.quantity,
              balanceAfter: newQty,
              reason: `مرتجع مبيعات فاتورة رقم ${sale.invoiceNumber}`,
              userId: actorId,
              createdAt: now,
            })
            .run();
        }

        // Reverse cash (only if original payment was cash)
        if (sale.paymentMethod === 'cash') {
          app.db
            .insert(cashMovements)
            .values({
              shiftId: activeShift.id,
              type: 'refund',
              amount: -sale.total,
              referenceId: sale.invoiceNumber,
              userId: actorId,
              createdAt: now,
            })
            .run();
        }

        // Log audit
        app.db
          .insert(auditLogs)
          .values({
            userId: actorId,
            action: 'cancel_sale',
            details: `إلغاء فاتورة مبيعات ${sale.invoiceNumber} بقيمة مرتجعة ${sale.total} د.ل`,
            createdAt: now,
          })
          .run();

        return { success: true };
      })();

      return result;
    } catch (err: any) {
      if (err.message === 'sale_not_found') {
        return reply.code(404).send({ error: 'sale_not_found', message: 'الفاتورة غير موجودة' });
      }
      if (err.message === 'already_cancelled') {
        return reply
          .code(400)
          .send({ error: 'already_cancelled', message: 'الفاتورة ملغاة بالفعل' });
      }
      throw err;
    }
  });
}
