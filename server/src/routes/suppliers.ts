import type { FastifyInstance } from 'fastify';
import { eq, desc, gte, lte, and } from 'drizzle-orm';
import { suppliers, supplierPayments, supplierReturns, purchases, auditLogs, shifts, cashMovements } from '../db/schema.js';
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
    const { amount, notes } = req.body as { amount: number; notes?: string };
    try {
      requirePositiveInt(amount, 'amount');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const supplier = app.db.select().from(suppliers).where(eq(suppliers.id, id)).get();
    if (!supplier) return reply.code(404).send({ error: 'not_found', message: 'المورد غير موجود' });

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
        .insert(supplierPayments)
        .values({
          supplierId: id,
          shiftId: activeShift.id,
          amount,
          userId: req.user!.userId,
          notes: notes || null,
          createdAt: now,
        })
        .run();

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

  // Get Supplier Account Statement (كشف حساب المورد)
  app.get('/suppliers/:id/statement', async (req, reply) => {
    const id = Number((req.params as any).id);
    const { from, to } = req.query as { from?: string; to?: string };

    const supplier = app.db.select().from(suppliers).where(eq(suppliers.id, id)).get();
    if (!supplier) return reply.code(404).send({ error: 'not_found', message: 'المورد غير موجود' });

    // Fetch purchases from this supplier
    const supplierPurchases = app.db
      .select()
      .from(purchases)
      .where(eq(purchases.supplierId, id))
      .all();

    // Fetch supplier payments
    const payments = app.db
      .select()
      .from(supplierPayments)
      .where(eq(supplierPayments.supplierId, id))
      .all();

    // Fetch supplier returns (debt refund method only affects statement)
    const returns = app.db
      .select()
      .from(supplierReturns)
      .where(eq(supplierReturns.supplierId, id))
      .all();

    const transactions: Array<{
      id: string;
      date: string;
      type: 'purchase' | 'payment' | 'return';
      typeLabel: string;
      reference: string;
      debit: number; // milli-LYD (raises debt we owe supplier)
      credit: number; // milli-LYD (reduces debt we owe supplier)
      notes?: string;
    }> = [];

    supplierPurchases.forEach((p) => {
      const unpaid = p.total - p.paid;
      const label =
        p.paid === 0
          ? 'فاتورة مشتريات (آجل)'
          : p.paid < p.total
            ? 'فاتورة مشتريات (جزئي)'
            : 'فاتورة مشتريات (نقدي)';
      transactions.push({
        id: `pur-${p.id}`,
        date: p.createdAt,
        type: 'purchase',
        typeLabel: label,
        reference: p.invoiceNumber,
        debit: unpaid,
        credit: 0,
        notes: p.notes || `إجمالي الفاتورة: ${(p.total / 1000).toFixed(3)} د.ل - مدفوع: ${(p.paid / 1000).toFixed(3)} د.ل`,
      });
    });

    payments.forEach((pay) => {
      transactions.push({
        id: `pay-${pay.id}`,
        date: pay.createdAt,
        type: 'payment',
        typeLabel: 'سداد دفعة للمورد (دفع)',
        reference: `PAY-${pay.id}`,
        debit: 0,
        credit: pay.amount,
        notes: pay.notes || 'سداد نقدي للمورد',
      });
    });

    returns.forEach((ret) => {
      if (ret.refundMethod !== 'debt') return; // cash returns do not alter debt
      transactions.push({
        id: `ret-${ret.id}`,
        date: ret.createdAt,
        type: 'return',
        typeLabel: 'مرتجع مشتريات (خصم دين)',
        reference: `RET-${ret.id}`,
        debit: 0,
        credit: ret.amount,
        notes: 'إرجاع أصناف وخصم من رصيد المورد',
      });
    });

    // Sort transactions chronologically
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter by date range if provided
    let fromDateStr = from ? (from.includes('T') ? from : `${from}T00:00:00.000Z`) : null;
    let toDateStr = to ? (to.includes('T') ? to : `${to}T23:59:59.999Z`) : null;

    let openingBalance = 0;
    const filteredTransactions: typeof transactions = [];

    transactions.forEach((tx) => {
      if (fromDateStr && tx.date < fromDateStr) {
        openingBalance += tx.debit - tx.credit;
      } else if (toDateStr && tx.date > toDateStr) {
        // After range, ignore
      } else {
        filteredTransactions.push(tx);
      }
    });

    let runningBalance = openingBalance;
    let totalPurchases = 0;
    let totalPaid = 0;

    const statementRows = filteredTransactions.map((tx) => {
      totalPurchases += tx.debit;
      totalPaid += tx.credit;
      runningBalance += tx.debit - tx.credit;
      return {
        ...tx,
        runningBalance,
      };
    });

    // If no date range filter was applied, calculated balance matches running balance
    const overallCalculatedBalance = transactions.reduce((acc, tx) => acc + (tx.debit - tx.credit), 0);

    return {
      supplier,
      summary: {
        totalPurchases,
        totalPaid,
        openingBalance,
        currentBalance: supplier.debtBalance,
        calculatedBalance: overallCalculatedBalance,
      },
      statement: statementRows,
    };
  });
}

