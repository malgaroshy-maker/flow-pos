import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { suppliers, auditLogs, shifts, cashMovements } from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { requirePositiveInt, ValidationError } from '../lib/validate.js';

export async function supplierRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // List all suppliers
  app.get('/suppliers', async (_req, _reply) => {
    return app.db.select().from(suppliers).orderBy(desc(suppliers.id)).all();
  });

  // Create supplier (manager only)
  app.post('/suppliers', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'إضافة الموردين متاحة للمدراء فقط' });
    }
    const { name, phone, address, notes } = req.body as any;
    if (!name)
      return reply.code(400).send({ error: 'missing_fields', message: 'اسم المورد مطلوب' });

    const now = new Date().toISOString();
    const result = app.db
      .insert(suppliers)
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
        action: 'create_supplier',
        details: `إضافة مورد: ${name}`,
        createdAt: now,
      })
      .run();
    return { success: true, id: newId };
  });

  // Update supplier
  app.put('/suppliers/:id', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تعديل الموردين متاح للمدراء فقط' });
    }
    const id = Number((req.params as any).id);
    const existing = app.db.select().from(suppliers).where(eq(suppliers.id, id)).get();
    if (!existing) return reply.code(404).send({ error: 'not_found' });

    const { name, phone, address, notes } = req.body as any;
    app.db
      .update(suppliers)
      .set({
        name: name ?? existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        address: address !== undefined ? address : existing.address,
        notes: notes !== undefined ? notes : existing.notes,
      })
      .where(eq(suppliers.id, id))
      .run();

    return { success: true };
  });

  // Record a payment to supplier (reduce our debt balance)
  app.post('/suppliers/:id/payment', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'تسجيل المدفوعات للمدراء فقط' });
    }
    const id = Number((req.params as any).id);
    const { amount } = req.body as { amount: number };
    try {
      requirePositiveInt(amount, 'amount');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const supplier = app.db.select().from(suppliers).where(eq(suppliers.id, id)).get();
    if (!supplier) return reply.code(404).send({ error: 'not_found' });

    if (amount > supplier.debtBalance) {
      return reply.code(400).send({
        error: 'overpayment',
        message: `المبلغ المدفوع أكبر من الدين المستحق للمورد (${(supplier.debtBalance / 1000).toFixed(3)} د.ل)`,
      });
    }

    // Cash leaving the drawer must be tied to an open shift.
    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (!activeShift) {
      return reply.code(400).send({
        error: 'no_active_shift',
        message: 'دفع نقدية للمورد يتطلب توكة مفتوحة لتسجيلها في الدرج',
      });
    }

    const now = new Date().toISOString();
    const newDebt = app.sqlite.transaction(() => {
      const debt = supplier.debtBalance - amount;
      app.db.update(suppliers).set({ debtBalance: debt }).where(eq(suppliers.id, id)).run();

      app.db
        .insert(cashMovements)
        .values({
          shiftId: activeShift.id,
          type: 'withdrawal',
          amount: -amount,
          referenceId: `سداد مورد ${supplier.name}`,
          userId: req.user!.userId,
          createdAt: now,
        })
        .run();

      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'supplier_payment',
          details: `سداد للمورد ${supplier.name}: ${(amount / 1000).toFixed(3)} د.ل. الدين المتبقي: ${(debt / 1000).toFixed(3)} د.ل`,
          createdAt: now,
        })
        .run();

      return debt;
    })();

    return { success: true, newDebtBalance: newDebt };
  });
}
