import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { createDb, type Db } from './db/index.js';
import { settingsRoutes } from './routes/settings.js';
import { authRoutes } from './routes/auth.js';
import { productRoutes } from './routes/products.js';
import { shiftRoutes } from './routes/shifts.js';
import { saleRoutes } from './routes/sales.js';
import { backupRoutes } from './routes/backup.js';
import { customerRoutes } from './routes/customers.js';
import { supplierRoutes } from './routes/suppliers.js';
import { purchaseRoutes } from './routes/purchases.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    sqlite: Database.Database;
  }
}

const here = dirname(fileURLToPath(import.meta.url));

export function buildApp(sqlite: Database.Database) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.decorate('sqlite', sqlite);
  app.decorate('db', createDb(sqlite));
  app.addHook('onClose', async () => {
    sqlite.close();
  });

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
