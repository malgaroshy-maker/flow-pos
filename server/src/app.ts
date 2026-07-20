import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { createDb, resolveDbPath, type Db } from './db/index.js';
import { settingsRoutes } from './routes/settings.js';
import { authRoutes } from './routes/auth.js';
import { productRoutes } from './routes/products.js';
import { shiftRoutes } from './routes/shifts.js';
import { saleRoutes } from './routes/sales.js';
import { backupRoutes } from './routes/backup.js';
import { customerRoutes } from './routes/customers.js';
import { supplierRoutes } from './routes/suppliers.js';
import { purchaseRoutes } from './routes/purchases.js';
import { quotationRoutes } from './routes/quotations.js';
import { depositRoutes } from './routes/deposits.js';
import { stocktakingRoutes } from './routes/stocktaking.js';
import { reportRoutes } from './routes/reports.js';
import { notificationRoutes } from './routes/notifications.js';
import { warrantyRoutes } from './routes/warranties.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    sqlite: Database.Database;
    swapDatabase: (next: Database.Database) => void;
  }
}

const here = dirname(fileURLToPath(import.meta.url));

export function buildApp(sqlite: Database.Database) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  // Single mutable holder read through getters, so a backup restore can swap
  // the connection and every route (each in its own encapsulated Fastify
  // context) sees the new handle instead of a closed one.
  const holder = { sqlite, db: createDb(sqlite) };
  app.decorate('sqlite', {
    getter: () => holder.sqlite,
  });
  app.decorate('db', {
    getter: () => holder.db,
  });
  app.decorate('swapDatabase', (next: Database.Database) => {
    holder.sqlite = next;
    holder.db = createDb(next);
  });
  app.addHook('onClose', async () => {
    holder.sqlite.close();
  });

  // Product image uploads (2 MB cap, single file per request)
  app.register(fastifyMultipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

  // Serve uploaded product images from <data dir>/uploads
  const uploadsDir = join(dirname(resolveDbPath()), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/', decorateReply: false });

  app.get('/api/health', async () => ({
    status: 'ok',
    // Server clock is the only clock (docs/plan.md) — clients read time from here.
    serverTime: new Date().toISOString(),
  }));

  app.register(settingsRoutes, { prefix: '/api' });
  app.register(authRoutes, { prefix: '/api' });
  app.register(productRoutes, { prefix: '/api' });
  app.register(shiftRoutes, { prefix: '/api' });
  app.register(saleRoutes, { prefix: '/api' });
  app.register(backupRoutes, { prefix: '/api' });
  app.register(customerRoutes, { prefix: '/api' });
  app.register(supplierRoutes, { prefix: '/api' });
  app.register(purchaseRoutes, { prefix: '/api' });
  app.register(quotationRoutes, { prefix: '/api' });
  app.register(depositRoutes, { prefix: '/api' });
  app.register(stocktakingRoutes, { prefix: '/api' });
  app.register(reportRoutes, { prefix: '/api' });
  app.register(notificationRoutes, { prefix: '/api' });
  app.register(warrantyRoutes, { prefix: '/api' });

  // In production the server serves the built SPA; in dev, Vite serves it with a proxy.
  const webDist = join(here, '..', '..', 'web', 'dist');
  if (existsSync(webDist)) {
    app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api/')) {
        reply.code(404).send({ error: 'not_found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}
