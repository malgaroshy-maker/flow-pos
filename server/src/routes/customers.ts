import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { customers, sales, auditLogs } from '../db/schema.js';
import { authenticateRequest } from './auth.js';

export async function customerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // List all customers
  app.get('/customers', async (_req, _reply) => {
    return app.db.select().from(customers).orderBy(desc(customers.id)).all();
  });

  // Create customer (manager only)
  app.post('/customers', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'إضافة العملاء متاحة للمدراء فقط' });
    }
    const { name, phone, address, notes } = req.body as any;
    if (!name)
      return reply.code(400).send({ error: 'missing_fields', message: 'اسم العميل مطلوب' });

    const now = new Date().toISOString();
    const result = app.db
      .insert(customers)
      .values({
        name,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        createdAt: now,
      })
      .run();
    const newId = Number(result.lastInsertRowid);

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user.userId,
        action: 'create_customer',
        details: `إضافة عميل: ${name}`,
        createdAt: now,
      })
      .run();
    return { success: true, id: newId };
  });

  // Update customer
  app.put('/customers/:id', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تعديل العملاء متاح للمدراء فقط' });
    }
    const id = Number((req.params as any).id);
    const existing = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!existing) return reply.code(404).send({ error: 'not_found' });

    const { name, phone, address, notes } = req.body as any;
    app.db
      .update(customers)
      .set({
        name: name ?? existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        address: address !== undefined ? address : existing.address,
        notes: notes !== undefined ? notes : existing.notes,
      })
      .where(eq(customers.id, id))
      .run();

    return { success: true };
  });

  // Record a payment from customer (reduce credit balance)
  app.post('/customers/:id/payment', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'تسجيل المدفوعات للمدراء فقط' });
    }
    const id = Number((req.params as any).id);
    const { amount } = req.body as { amount: number };
    if (!amount || amount <= 0) return reply.code(400).send({ error: 'invalid_amount' });

    const customer = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!customer) return reply.code(404).send({ error: 'not_found' });

    const newBalance = Math.max(0, customer.creditBalance - amount);
    app.db.update(customers).set({ creditBalance: newBalance }).where(eq(customers.id, id)).run();

    const now = new Date().toISOString();
    app.db
      .insert(auditLogs)
      .values({
        userId: req.user.userId,
        action: 'customer_payment',
        details: `سداد عميل ${customer.name}: ${(amount / 1000).toFixed(3)} د.ل. الرصيد الجديد: ${(newBalance / 1000).toFixed(3)} د.ل`,
        createdAt: now,
      })
      .run();

    return { success: true, newCreditBalance: newBalance };
  });

  // Get customer's sales history
  app.get('/customers/:id/sales', async (req, _reply) => {
    const id = Number((req.params as any).id);
    return app.db
      .select()
      .from(sales)
      .where(eq(sales.customerId, id))
      .orderBy(desc(sales.id))
      .all();
  });
}
