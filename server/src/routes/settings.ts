import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { settings, auditLogs, users } from '../db/schema.js';
import { authenticateRequest } from './auth.js';

import os from 'node:os';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/network/info', async (_req, reply) => {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    const port = process.env.PORT || 3001;
    return {
      ips,
      port: Number(port),
      urls: ips.map((ip) => `http://${ip}:${port}`),
    };
  });

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
      businessSubtitle?: string;
      businessPhone?: string;
      businessPhone2?: string;
      businessAddress?: string;
      warrantyTerms?: string;
      stampTitle?: string;
      taxEnabled?: boolean;
      taxRatePermille?: number;
      discountCapPercent?: number;
    };

    if (
      body.taxRatePermille !== undefined &&
      (!Number.isSafeInteger(body.taxRatePermille) ||
        body.taxRatePermille < 0 ||
        body.taxRatePermille > 1000)
    ) {
      return reply.code(400).send({
        error: 'invalid_taxRatePermille',
        message: 'نسبة الضريبة يجب أن تكون عدداً صحيحاً بين 0 و 1000 (بالميل ×10)',
      });
    }

    if (
      body.discountCapPercent !== undefined &&
      (!Number.isSafeInteger(body.discountCapPercent) ||
        body.discountCapPercent < 0 ||
        body.discountCapPercent > 100)
    ) {
      return reply.code(400).send({
        error: 'invalid_discountCapPercent',
        message: 'حد الخصم يجب أن يكون نسبة مئوية صحيحة بين 0 و 100',
      });
    }

    const row = app.db.select().from(settings).limit(1).all()[0];
    if (!row) {
      return reply.code(404).send({ error: 'settings_not_seeded' });
    }

    app.db
      .update(settings)
      .set({
        businessName: body.businessName !== undefined ? body.businessName : row.businessName,
        businessSubtitle:
          body.businessSubtitle !== undefined ? body.businessSubtitle : row.businessSubtitle,
        businessPhone: body.businessPhone !== undefined ? body.businessPhone : row.businessPhone,
        businessPhone2:
          body.businessPhone2 !== undefined ? body.businessPhone2 : row.businessPhone2,
        businessAddress:
          body.businessAddress !== undefined ? body.businessAddress : row.businessAddress,
        warrantyTerms: body.warrantyTerms !== undefined ? body.warrantyTerms : row.warrantyTerms,
        stampTitle: body.stampTitle !== undefined ? body.stampTitle : row.stampTitle,
        taxEnabled: body.taxEnabled !== undefined ? body.taxEnabled : row.taxEnabled,
        taxRatePermille:
          body.taxRatePermille !== undefined ? body.taxRatePermille : row.taxRatePermille,
        discountCapPercent:
          body.discountCapPercent !== undefined ? body.discountCapPercent : row.discountCapPercent,
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
