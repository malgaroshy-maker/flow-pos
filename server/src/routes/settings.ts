import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { settings, auditLogs, users } from '../db/schema.js';
import { authenticateRequest } from './auth.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings', async (_req, reply) => {
    const row = app.db.select().from(settings).limit(1).all()[0];
    if (!row) return reply.code(404).send({ error: 'settings_not_seeded' });
    return row;
  });

  app.put('/settings', { preHandler: authenticateRequest }, async (req, reply) => {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'هذا الإجراء متاح للمدراء فقط' });
    }

    const body = req.body as {
      businessName?: string;
      businessPhone?: string;
      businessAddress?: string;
      taxEnabled?: boolean;
      taxRatePermille?: number;
    };

    const row = app.db.select().from(settings).limit(1).all()[0];
    if (!row) {
      return reply.code(404).send({ error: 'settings_not_seeded' });
    }

    app.db
      .update(settings)
      .set({
        businessName: body.businessName !== undefined ? body.businessName : row.businessName,
        businessPhone: body.businessPhone !== undefined ? body.businessPhone : row.businessPhone,
        businessAddress:
          body.businessAddress !== undefined ? body.businessAddress : row.businessAddress,
        taxEnabled: body.taxEnabled !== undefined ? body.taxEnabled : row.taxEnabled,
        taxRatePermille:
          body.taxRatePermille !== undefined ? body.taxRatePermille : row.taxRatePermille,
      })
      .where(eq(settings.id, row.id))
      .run();

    // Audit log
    app.db
      .insert(auditLogs)
      .values({
        userId: currentUser.userId,
        action: 'update_settings',
        details: `تحديث الإعدادات العامة للنشاط بواسطة ${currentUser.username}`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { success: true };
  });

  app.get('/audit-logs', { preHandler: authenticateRequest }, async (req, reply) => {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'هذا الإجراء متاح للمدراء فقط' });
    }

    const logs = app.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        username: users.username,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .all();

    return logs.sort((a, b) => b.id - a.id);
  });
}
