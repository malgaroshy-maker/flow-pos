import type { FastifyInstance } from 'fastify';
import { settings } from '../db/schema.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings', async (_req, reply) => {
    const row = app.db.select().from(settings).limit(1).all()[0];
    if (!row) return reply.code(404).send({ error: 'settings_not_seeded' });
    return row;
  });
}
