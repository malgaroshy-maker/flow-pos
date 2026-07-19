import type { FastifyInstance } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveDbPath } from '../db/index.js';
import { shifts, cashMovements, expenses, auditLogs, users } from '../db/schema.js';
import { authenticateRequest } from './auth.js';

export async function shiftRoutes(app: FastifyInstance) {
  // Apply authentication to all shift and expense routes
  app.addHook('preHandler', authenticateRequest);

  // Get active shift
  app.get('/shifts/active', async (req, reply) => {
    const active = app.db.select().from(shifts).where(eq(shifts.status, 'open')).limit(1).get();

    if (!active) {
      return { active: null };
    }

    // Also fetch the opening user details
    const openingUser = app.db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, active.openedByUserId))
      .get();

    return {
      active: {
        ...active,
        openedByUsername: openingUser?.username || 'غير معروف',
      },
    };
  });

  // Open a new shift
  app.post('/shifts/open', async (req, reply) => {
    const { openingCash } = req.body as { openingCash?: number };

    if (openingCash === undefined || openingCash < 0) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'مبلغ الرصيد الافتتاحي مطلوب وغير سالب' });
    }

    // Check if there is already an open shift
    const existing = app.db.select().from(shifts).where(eq(shifts.status, 'open')).limit(1).get();

    if (existing) {
      return reply.code(400).send({
        error: 'shift_already_open',
        message: 'هناك توكة مفتوحة بالفعل. يرجى إغلاقها أولاً',
      });
    }

    const now = new Date().toISOString();
    const result = app.db
      .insert(shifts)
      .values({
        openedByUserId: req.user!.userId,
        openedAt: now,
        openingCash: Number(openingCash),
        expectedCash: Number(openingCash),
        status: 'open',
      })
      .run();

    const newShiftId = Number(result.lastInsertRowid);

    // Create initial cash movement for opening cash
    app.db
      .insert(cashMovements)
      .values({
        shiftId: newShiftId,
        type: 'deposit',
        amount: Number(openingCash),
        referenceId: 'OPENING_CASH',
        userId: req.user!.userId,
        createdAt: now,
      })
      .run();

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user!.userId,
        action: 'open_shift',
        details: `فتح توكة جديدة (معرف: ${newShiftId}) برصيد افتتاحي: ${openingCash}`,
        createdAt: now,
      })
      .run();

    return { id: newShiftId, success: true };
  });

  // Close active shift
  app.post('/shifts/close', async (req, reply) => {
    const { actualCash } = req.body as { actualCash?: number };

    if (actualCash === undefined || actualCash < 0) {
      return reply.code(400).send({ error: 'missing_fields', message: 'مبلغ الجرد الفعلي مطلوب' });
    }

    const active = app.db.select().from(shifts).where(eq(shifts.status, 'open')).limit(1).get();

    if (!active) {
      return reply
        .code(400)
        .send({ error: 'no_active_shift', message: 'لا توجد توكة مفتوحة لإغلاقها' });
    }

    // Execute inside transaction for strict calculation and locking
    const result = app.sqlite.transaction(() => {
      // Calculate expected cash = opening cash + all cash movements
      const movements = app.db
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.shiftId, active.id))
        .all();

      let cashSum = 0;
      for (const m of movements) {
        // Note: opening cash was already added to movements as a 'deposit'
        // But let's check: did we add opening cash as deposit? Yes.
        // So expectedCash is simply the sum of all movements!
        cashSum += m.amount;
      }

      const expected = cashSum;
      const variance = Number(actualCash) - expected;
      const now = new Date().toISOString();

      app.db
        .update(shifts)
        .set({
          closedByUserId: req.user!.userId,
          closedAt: now,
          expectedCash: expected,
          actualCash: Number(actualCash),
          variance: variance,
          status: 'closed',
        })
        .where(eq(shifts.id, active.id))
        .run();

      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'close_shift',
          details: `إغلاق التوكة ${active.id}: المتوقع ${expected}، الفعلي ${actualCash}، الفارق ${variance}`,
          createdAt: now,
        })
        .run();

      return {
        id: active.id,
        expectedCash: expected,
        actualCash: Number(actualCash),
        variance: variance,
        status: 'closed',
      };
    })();

    // Trigger automated backup outside transaction
    const dbPath = resolveDbPath();
    if (dbPath !== ':memory:') {
      try {
        const backupDir = join(dirname(dbPath), 'backups');
        if (!existsSync(backupDir)) {
          mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date()
          .toISOString()
          .replace(/T/, '_')
          .replace(/\..+/, '')
          .replace(/:/g, '-');
        const backupFile = `pos_backup_auto_shift_${active.id}_${timestamp}.db`;
        const destPath = join(backupDir, backupFile);
        await app.sqlite.backup(destPath);

        app.db
          .insert(auditLogs)
          .values({
            userId: req.user!.userId,
            action: 'backup_database',
            details: `نسخ احتياطي تلقائي عند إغلاق التوكة ${active.id} إلى ${backupFile}`,
            createdAt: new Date().toISOString(),
          })
          .run();
      } catch (backupErr) {
        app.log.error(backupErr, 'Automated backup failed on shift close');
      }
    }

    return result;
  });

  // Get shifts history (manager only)
  app.get('/shifts', async (req, reply) => {
    if (req.user!.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'هذا التقرير متاح للمدراء فقط' });
    }

    const list = app.db.select().from(shifts).orderBy(desc(shifts.id)).all();

    // Fetch users for context
    const userList = app.db.select({ id: users.id, username: users.username }).from(users).all();
    const userMap = new Map(userList.map((u) => [u.id, u.username]));

    return list.map((s) => ({
      ...s,
      openedByUsername: userMap.get(s.openedByUserId) || 'غير معروف',
      closedByUsername: s.closedByUserId ? userMap.get(s.closedByUserId) || 'غير معروف' : null,
    }));
  });

  // Get cash movements for a shift
  app.get('/shifts/:id/movements', async (req, reply) => {
    const { id } = req.params as { id: string };
    const movements = app.db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, Number(id)))
      .orderBy(desc(cashMovements.id))
      .all();
    return movements;
  });

  // Record daily cash expense
  app.post('/expenses', async (req, reply) => {
    const { amount, reason, category } = req.body as {
      amount?: number;
      reason?: string;
      category?: string;
    };

    if (!amount || !reason || !category) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'المبلغ، السبب، والتصنيف حقول مطلوبة' });
    }

    const active = app.db.select().from(shifts).where(eq(shifts.status, 'open')).limit(1).get();

    if (!active) {
      return reply
        .code(400)
        .send({ error: 'no_active_shift', message: 'لا يمكن تسجيل مصروفات بدون توكة مفتوحة' });
    }

    const now = new Date().toISOString();

    const result = app.sqlite.transaction(() => {
      // 1. Insert expense record
      const expInsert = app.db
        .insert(expenses)
        .values({
          shiftId: active.id,
          amount: Number(amount),
          reason,
          category,
          userId: req.user!.userId,
          createdAt: now,
        })
        .run();

      const expenseId = Number(expInsert.lastInsertRowid);

      // 2. Insert cash movement record (negative amount for cash going out)
      app.db
        .insert(cashMovements)
        .values({
          shiftId: active.id,
          type: 'expense',
          amount: -Number(amount),
          referenceId: `EXPENSE_${expenseId}`,
          userId: req.user!.userId,
          createdAt: now,
        })
        .run();

      // 3. Log audit
      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'create_expense',
          details: `تسجيل مصروف بقيمة ${amount} د.ل في التوكة ${active.id}. السبب: ${reason} (التصنيف: ${category})`,
          createdAt: now,
        })
        .run();

      return { id: expenseId, success: true };
    })();

    return result;
  });

  // Get expenses list (optional shiftId filter)
  app.get('/expenses', async (req, reply) => {
    const { shiftId } = req.query as { shiftId?: string };

    let query = app.db.select().from(expenses);

    if (shiftId) {
      const list = app.db
        .select()
        .from(expenses)
        .where(eq(expenses.shiftId, Number(shiftId)))
        .orderBy(desc(expenses.id))
        .all();
      return list;
    }

    return app.db.select().from(expenses).orderBy(desc(expenses.id)).all();
  });
}
