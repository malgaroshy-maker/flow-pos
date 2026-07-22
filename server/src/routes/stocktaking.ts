import type { FastifyInstance } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import {
  stocktakeSessions,
  stocktakeItems,
  products,
  stockMovements,
  auditLogs,
  users,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { verifyManagerPin } from '../lib/pin.js';

export async function stocktakingRoutes(app: FastifyInstance) {
  // Require valid session for all stocktaking endpoints
  app.addHook('preHandler', authenticateRequest);

  // GET /api/stocktaking — List all sessions
  app.get('/stocktaking', async (req, reply) => {
    const sessions = app.db
      .select()
      .from(stocktakeSessions)
      .orderBy(desc(stocktakeSessions.id))
      .all();

    return sessions;
  });

  // GET /api/stocktaking/:id — Get details of a single session with items
  app.get('/stocktaking/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const session = app.db
      .select()
      .from(stocktakeSessions)
      .where(eq(stocktakeSessions.id, id))
      .get();

    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'جلسة الجرد غير موجودة' });
    }

    const items = app.db
      .select()
      .from(stocktakeItems)
      .where(eq(stocktakeItems.sessionId, id))
      .all();

    // Hide expectedQty for sales role if session is open (blind count)
    const sanitizedItems = items.map((item) => {
      if (req.user?.role === 'sales' && session.status === 'open') {
        return {
          ...item,
          expectedQty: 0,
          variance: 0,
        };
      }
      return item;
    });

    return { ...session, items: sanitizedItems };
  });

  // POST /api/stocktaking — Start a new session
  app.post('/stocktaking', async (req, reply) => {
    const { notes } = (req.body as any) || {};
    const now = new Date().toISOString();

    const result = app.db
      .insert(stocktakeSessions)
      .values({
        status: 'open',
        userId: req.user!.userId,
        username: req.user!.username,
        notes: notes || undefined,
        createdAt: now,
      })
      .run();

    const sessionId = Number(result.lastInsertRowid);
    const session = app.db
      .select()
      .from(stocktakeSessions)
      .where(eq(stocktakeSessions.id, sessionId))
      .get();

    return session;
  });

  // POST /api/stocktaking/:id/count — Record/scan product count
  app.post('/stocktaking/:id/count', async (req, reply) => {
    const sessionId = Number((req.params as any).id);
    const session = app.db
      .select()
      .from(stocktakeSessions)
      .where(eq(stocktakeSessions.id, sessionId))
      .get();

    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'جلسة الجرد غير موجودة' });
    }
    if (session.status !== 'open') {
      return reply
        .code(400)
        .send({ error: 'session_closed', message: 'لا يمكن التعديل على جلسة جرد مغلقة' });
    }

    const { productId, barcode, countedQty } = (req.body as any) || {};

    let product = null;
    if (productId) {
      product = app.db.select().from(products).where(eq(products.id, Number(productId))).get();
    } else if (barcode) {
      product = app.db.select().from(products).where(eq(products.barcode, String(barcode))).get();
    }

    if (!product) {
      return reply.code(404).send({ error: 'product_not_found', message: 'المنتج غير موجود' });
    }

    const now = new Date().toISOString();
    const countVal = Number(countedQty ?? 1);

    const existingItem = app.db
      .select()
      .from(stocktakeItems)
      .where(
        and(eq(stocktakeItems.sessionId, sessionId), eq(stocktakeItems.productId, product.id))
      )
      .get();

    if (existingItem) {
      const newCounted = countVal;
      const variance = newCounted - existingItem.expectedQty;
      app.db
        .update(stocktakeItems)
        .set({
          countedQty: newCounted,
          variance,
          updatedAt: now,
        })
        .where(eq(stocktakeItems.id, existingItem.id))
        .run();
    } else {
      const expected = product.quantity;
      const variance = countVal - expected;
      app.db
        .insert(stocktakeItems)
        .values({
          sessionId,
          productId: product.id,
          productName: product.name,
          barcode: product.barcode || undefined,
          expectedQty: expected,
          countedQty: countVal,
          variance,
          updatedAt: now,
        })
        .run();
    }

    const updatedSession = app.db
      .select()
      .from(stocktakeSessions)
      .where(eq(stocktakeSessions.id, sessionId))
      .get();
    const items = app.db
      .select()
      .from(stocktakeItems)
      .where(eq(stocktakeItems.sessionId, sessionId))
      .all();

    return { ...updatedSession, items };
  });

  // POST /api/stocktaking/:id/close — Close a session
  app.post('/stocktaking/:id/close', async (req, reply) => {
    const sessionId = Number((req.params as any).id);
    const session = app.db
      .select()
      .from(stocktakeSessions)
      .where(eq(stocktakeSessions.id, sessionId))
      .get();

    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'جلسة الجرد غير موجودة' });
    }

    const now = new Date().toISOString();
    app.db
      .update(stocktakeSessions)
      .set({
        status: 'closed',
        closedAt: now,
      })
      .where(eq(stocktakeSessions.id, sessionId))
      .run();

    return { success: true, message: 'تم إغلاق جلسة الجرد بنجاح' };
  });

  // POST /api/stocktaking/:id/apply — Apply inventory variances to stock (Manager only / Manager PIN)
  app.post('/stocktaking/:id/apply', async (req, reply) => {
    const sessionId = Number((req.params as any).id);
    const { overridePin } = (req.body as any) || {};

    let isAuthorized = req.user!.role === 'manager';
    if (!isAuthorized && overridePin) {
      const v = verifyManagerPin(app.db, overridePin, req.ip);
      if (v.success) isAuthorized = true;
    }

    if (!isAuthorized) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'موافقة المدير مطلوبة لتسوية فروقات الجرد والمخزون',
      });
    }

    const session = app.db
      .select()
      .from(stocktakeSessions)
      .where(eq(stocktakeSessions.id, sessionId))
      .get();

    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: 'جلسة الجرد غير موجودة' });
    }
    if (session.status === 'applied') {
      return reply
        .code(400)
        .send({ error: 'already_applied', message: 'تم تطبيق نتائج هذه الجلسة من قبل' });
    }

    const items = app.db
      .select()
      .from(stocktakeItems)
      .where(eq(stocktakeItems.sessionId, sessionId))
      .all();

    const now = new Date().toISOString();

    app.db.transaction((tx) => {
      for (const item of items) {
        if (item.variance !== 0) {
          const product = tx.select().from(products).where(eq(products.id, item.productId)).get();
          if (product) {
            const newQty = Math.max(0, product.quantity + item.variance);
            tx.update(products)
              .set({ quantity: newQty })
              .where(eq(products.id, item.productId))
              .run();

            tx.insert(stockMovements)
              .values({
                productId: item.productId,
                type: 'adjustment',
                quantity: item.variance,
                balanceAfter: newQty,
                reason: `تسوية جرد — جلسة #${session.id}`,
                userId: req.user!.userId,
                createdAt: now,
              })
              .run();
          }
        }
      }

      tx.update(stocktakeSessions)
        .set({
          status: 'applied',
          appliedAt: now,
        })
        .where(eq(stocktakeSessions.id, sessionId))
        .run();

      tx.insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'stocktake_apply',
          details: `اعتماد نتائج جلسة الجرد #${session.id}`,
          createdAt: now,
        })
        .run();
    });

    return { success: true, message: 'تم تسوية المخزون بناءً على نتائج الجرد بنجاح' };
  });
}
