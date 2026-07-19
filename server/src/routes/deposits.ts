import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import {
  deposits,
  customers,
  products,
  shifts,
  cashMovements,
  auditLogs,
  users,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { requirePositiveInt, ValidationError } from '../lib/validate.js';

function getActiveShift(app: FastifyInstance) {
  return app.db.select().from(shifts).where(eq(shifts.status, 'open')).limit(1).get();
}

export async function depositRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // List deposits with customer/product context
  app.get('/deposits', async () => {
    const list = app.db.select().from(deposits).orderBy(desc(deposits.id)).all();
    const customerList = app.db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .all();
    const productList = app.db
      .select({ id: products.id, name: products.name })
      .from(products)
      .all();
    const userList = app.db.select({ id: users.id, username: users.username }).from(users).all();
    const customerMap = new Map(customerList.map((c) => [c.id, c.name]));
    const productMap = new Map(productList.map((p) => [p.id, p.name]));
    const userMap = new Map(userList.map((u) => [u.id, u.username]));
    return list.map((d) => ({
      ...d,
      customerName: customerMap.get(d.customerId) || 'غير معروف',
      productName: d.productId ? productMap.get(d.productId) || null : null,
      username: userMap.get(d.userId) || 'غير معروف',
    }));
  });

  // Take a deposit: cash into the open drawer, optionally reserving one unit
  app.post('/deposits', async (req, reply) => {
    const { customerId, productId, amount, notes } = req.body as {
      customerId?: number;
      productId?: number;
      amount?: number;
      notes?: string;
    };

    try {
      requirePositiveInt(customerId, 'customerId');
      requirePositiveInt(amount, 'amount');
      if (productId !== undefined) requirePositiveInt(productId, 'productId');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const customer = app.db.select().from(customers).where(eq(customers.id, customerId!)).get();
    if (!customer) {
      return reply.code(404).send({ error: 'customer_not_found', message: 'العميل غير موجود' });
    }

    const activeShift = getActiveShift(app);
    if (!activeShift) {
      return reply.code(400).send({
        error: 'no_active_shift',
        message: 'استلام عربون يتطلب توكة مفتوحة لتسجيل النقدية في الدرج',
      });
    }

    let product: typeof products.$inferSelect | undefined;
    if (productId) {
      product = app.db.select().from(products).where(eq(products.id, productId)).get();
      if (!product) {
        return reply.code(404).send({ error: 'product_not_found', message: 'المنتج غير موجود' });
      }
      if (product.quantity - product.reservedQuantity < 1) {
        return reply.code(400).send({
          error: 'nothing_to_reserve',
          message: `لا توجد كمية متاحة للحجز من (${product.name}) — المتاح بعد الحجوزات: ${product.quantity - product.reservedQuantity}`,
        });
      }
    }

    const now = new Date().toISOString();
    const result = app.sqlite.transaction(() => {
      if (product) {
        app.db
          .update(products)
          .set({ reservedQuantity: product.reservedQuantity + 1 })
          .where(eq(products.id, product.id))
          .run();
      }

      const insert = app.db
        .insert(deposits)
        .values({
          customerId: customerId!,
          productId: productId || null,
          amount: amount!,
          status: 'held',
          shiftId: activeShift.id,
          userId: req.user!.userId,
          notes: notes || null,
          createdAt: now,
        })
        .run();
      const depositId = Number(insert.lastInsertRowid);

      app.db
        .insert(cashMovements)
        .values({
          shiftId: activeShift.id,
          type: 'deposit',
          amount: amount!,
          referenceId: `عربون ${customer.name} #${depositId}`,
          userId: req.user!.userId,
          createdAt: now,
        })
        .run();

      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'create_deposit',
          details: `استلام عربون من ${customer.name}: ${(amount! / 1000).toFixed(3)} د.ل${product ? ` مع حجز (${product.name})` : ''}`,
          createdAt: now,
        })
        .run();

      return { id: depositId, status: 'held' };
    })();

    return result;
  });

  // Refund a held deposit: cash back out of the open drawer
  app.post('/deposits/:id/refund', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const deposit = app.db.select().from(deposits).where(eq(deposits.id, id)).get();
    if (!deposit) return reply.code(404).send({ error: 'not_found', message: 'العربون غير موجود' });
    if (deposit.status !== 'held') {
      return reply.code(400).send({ error: 'not_held', message: 'لا يمكن استرداد عربون غير قائم' });
    }

    const activeShift = getActiveShift(app);
    if (!activeShift) {
      return reply.code(400).send({
        error: 'no_active_shift',
        message: 'استرداد العربون يتطلب توكة مفتوحة لصرف النقدية من الدرج',
      });
    }

    const now = new Date().toISOString();
    app.sqlite.transaction(() => {
      app.db
        .update(deposits)
        .set({ status: 'refunded', resolvedAt: now })
        .where(eq(deposits.id, id))
        .run();

      if (deposit.productId) {
        const product = app.db
          .select()
          .from(products)
          .where(eq(products.id, deposit.productId))
          .get();
        if (product && product.reservedQuantity > 0) {
          app.db
            .update(products)
            .set({ reservedQuantity: product.reservedQuantity - 1 })
            .where(eq(products.id, product.id))
            .run();
        }
      }

      app.db
        .insert(cashMovements)
        .values({
          shiftId: activeShift.id,
          type: 'withdrawal',
          amount: -deposit.amount,
          referenceId: `استرداد عربون #${deposit.id}`,
          userId: req.user!.userId,
          createdAt: now,
        })
        .run();

      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'refund_deposit',
          details: `استرداد عربون #${deposit.id} بقيمة ${(deposit.amount / 1000).toFixed(3)} د.ل`,
          createdAt: now,
        })
        .run();
    })();

    return { success: true, status: 'refunded' };
  });

  // Forfeit a held deposit (manager only): money stays, reservation released
  app.post('/deposits/:id/forfeit', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'مصادرة العربون متاحة للمدراء فقط' });
    }

    const id = Number((req.params as { id: string }).id);
    const deposit = app.db.select().from(deposits).where(eq(deposits.id, id)).get();
    if (!deposit) return reply.code(404).send({ error: 'not_found', message: 'العربون غير موجود' });
    if (deposit.status !== 'held') {
      return reply.code(400).send({ error: 'not_held', message: 'لا يمكن مصادرة عربون غير قائم' });
    }

    const now = new Date().toISOString();
    app.sqlite.transaction(() => {
      app.db
        .update(deposits)
        .set({ status: 'forfeited', resolvedAt: now })
        .where(eq(deposits.id, id))
        .run();

      if (deposit.productId) {
        const product = app.db
          .select()
          .from(products)
          .where(eq(products.id, deposit.productId))
          .get();
        if (product && product.reservedQuantity > 0) {
          app.db
            .update(products)
            .set({ reservedQuantity: product.reservedQuantity - 1 })
            .where(eq(products.id, product.id))
            .run();
        }
      }

      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'forfeit_deposit',
          details: `مصادرة عربون #${deposit.id} بقيمة ${(deposit.amount / 1000).toFixed(3)} د.ل`,
          createdAt: now,
        })
        .run();
    })();

    return { success: true, status: 'forfeited' };
  });
}
