import type { FastifyInstance } from 'fastify';
import { eq, desc, like } from 'drizzle-orm';
import {
  quotations,
  quotationItems,
  products,
  productUnits,
  customers,
  settings,
  users,
  auditLogs,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { verifyManagerPin } from '../lib/pin.js';
import { applyPermille, lineTotal } from '../lib/money.js';
import { requireNonNegativeInt, requirePositiveInt, ValidationError } from '../lib/validate.js';
import { resolveUnitPrice } from '../lib/pricing.js';

const DEFAULT_VALID_DAYS = 7;

/** Lazily flip active quotations whose validity date has passed. */
function expireStaleQuotations(app: FastifyInstance) {
  const today = new Date().toISOString().slice(0, 10);
  const stale = app.db
    .select({ id: quotations.id, validUntil: quotations.validUntil })
    .from(quotations)
    .where(eq(quotations.status, 'active'))
    .all()
    .filter((q) => q.validUntil < today);
  for (const q of stale) {
    app.db.update(quotations).set({ status: 'expired' }).where(eq(quotations.id, q.id)).run();
  }
}

export async function quotationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // List quotations (newest first)
  app.get('/quotations', async () => {
    expireStaleQuotations(app);
    const list = app.db.select().from(quotations).orderBy(desc(quotations.id)).all();
    const userList = app.db.select({ id: users.id, username: users.username }).from(users).all();
    const userMap = new Map(userList.map((u) => [u.id, u.username]));
    return list.map((q) => ({ ...q, username: userMap.get(q.userId) || 'غير معروف' }));
  });

  // Single quotation with items
  app.get('/quotations/:id', async (req, reply) => {
    expireStaleQuotations(app);
    const id = Number((req.params as { id: string }).id);
    const quotation = app.db.select().from(quotations).where(eq(quotations.id, id)).get();
    if (!quotation) {
      return reply.code(404).send({ error: 'not_found', message: 'عرض السعر غير موجود' });
    }
    const items = app.db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id))
      .all();
    return { ...quotation, items };
  });

  // Create a quotation — never touches stock or cash
  app.post('/quotations', async (req, reply) => {
    const body = req.body as {
      customerId?: number;
      customerName?: string;
      items: Array<{ productId: number; quantity: number; unitPrice: number; unitId?: number }>;
      discount?: number;
      validDays?: number;
      notes?: string;
      overridePin?: string;
    };
    const { customerId, items, discount = 0, overridePin } = body;

    if (!items || items.length === 0) {
      return reply.code(400).send({ error: 'empty_cart', message: 'لا توجد أصناف في عرض السعر' });
    }

    try {
      for (const item of items) {
        requirePositiveInt(item.productId, 'productId');
        requirePositiveInt(item.quantity, 'quantity');
        requireNonNegativeInt(item.unitPrice, 'unitPrice');
        if (item.unitId !== undefined) requirePositiveInt(item.unitId, 'unitId');
      }
      requireNonNegativeInt(discount, 'discount');
      if (body.validDays !== undefined) requirePositiveInt(body.validDays, 'validDays');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    let pinUser: any = null;
    if (overridePin) {
      const v = verifyManagerPin(app.db, overridePin, req.ip);
      if (!v.success || !v.user) {
        return reply
          .code(400)
          .send({ error: 'invalid_override_pin', message: 'رمز PIN الخاص بالمدير غير صحيح' });
      }
      pinUser = v.user;
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += lineTotal(item.unitPrice, item.quantity);
    }
    if (discount > subtotal) {
      return reply
        .code(400)
        .send({ error: 'discount_exceeds_subtotal', message: 'الخصم أكبر من قيمة عرض السعر' });
    }

    const currentSettings = app.db.select().from(settings).where(eq(settings.id, 1)).get();
    const discountCapPercent = currentSettings?.discountCapPercent ?? 10;
    const discountCap = Math.floor((subtotal * discountCapPercent) / 100);
    if (discount > discountCap && req.user!.role !== 'manager' && !pinUser) {
      return reply.code(400).send({
        error: 'discount_limit_exceeded',
        message: `لقد تجاوزت حد الخصم المسموح به (${discountCapPercent}%). يرجى إدخال PIN المدير للموافقة.`,
      });
    }

    try {
      const result = app.sqlite.transaction(() => {
        const now = new Date().toISOString();

        let targetCustomerName = body.customerName || null;
        if (customerId) {
          const cust = app.db.select().from(customers).where(eq(customers.id, customerId)).get();
          if (!cust) throw new Error('customer_not_found');
          targetCustomerName = cust.name;
        }

        // Same price authority as sales: quoted prices must be the resolved
        // price (packaging units quote at their own price) unless a manager
        // (or PIN) approves.
        const resolvedItems: Array<{
          item: (typeof items)[number];
          productName: string;
          unitName: string | null;
          conversionFactor: number;
        }> = [];
        for (const item of items) {
          const product = app.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .get();
          if (!product) throw new Error(`product_not_found:${item.productId}`);

          let authorizedPrice: number;
          let unitName: string | null = null;
          let conversionFactor = 1;
          if (item.unitId) {
            const unit = app.db
              .select()
              .from(productUnits)
              .where(eq(productUnits.id, item.unitId))
              .get();
            if (!unit || unit.productId !== product.id) {
              throw new Error(`unit_not_found:${product.name}`);
            }
            authorizedPrice = unit.price;
            unitName = unit.unitName;
            conversionFactor = unit.conversionFactor;
          } else {
            authorizedPrice = resolveUnitPrice(app.db, customerId, product);
          }
          if (item.unitPrice !== authorizedPrice && !pinUser && req.user!.role !== 'manager') {
            throw new Error(`price_not_allowed:${product.name}`);
          }
          resolvedItems.push({ item, productName: product.name, unitName, conversionFactor });
        }

        const currentYear = new Date().getFullYear();
        const yearPrefix = `QUO-${currentYear}-`;
        const matching = app.db
          .select({ quoteNumber: quotations.quoteNumber })
          .from(quotations)
          .where(like(quotations.quoteNumber, `${yearPrefix}%`))
          .all();
        let maxNum = 0;
        for (const q of matching) {
          const num = parseInt(q.quoteNumber.slice(yearPrefix.length), 10);
          if (Number.isFinite(num) && num > maxNum) maxNum = num;
        }
        const quoteNumber = `${yearPrefix}${String(maxNum + 1).padStart(5, '0')}`;

        const isTaxEnabled = currentSettings?.taxEnabled ?? false;
        const taxRatePermille = currentSettings?.taxRatePermille ?? 0;
        const taxAmount = isTaxEnabled ? applyPermille(subtotal - discount, taxRatePermille) : 0;
        const total = subtotal + taxAmount - discount;

        const validDays = body.validDays ?? DEFAULT_VALID_DAYS;
        const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const insert = app.db
          .insert(quotations)
          .values({
            quoteNumber,
            customerId: customerId || null,
            customerName: targetCustomerName,
            userId: req.user!.userId,
            validUntil,
            status: 'active',
            discount,
            taxAmount,
            total,
            notes: body.notes || null,
            createdAt: now,
          })
          .run();
        const quotationId = Number(insert.lastInsertRowid);

        for (const { item, productName, unitName, conversionFactor } of resolvedItems) {
          app.db
            .insert(quotationItems)
            .values({
              quotationId,
              productId: item.productId,
              productName,
              quantity: item.quantity,
              unitId: item.unitId || null,
              unitName,
              conversionFactor,
              unitPrice: item.unitPrice,
              total: lineTotal(item.unitPrice, item.quantity),
            })
            .run();
        }

        app.db
          .insert(auditLogs)
          .values({
            userId: req.user!.userId,
            action: 'create_quotation',
            details: `إنشاء عرض سعر ${quoteNumber} بقيمة ${(total / 1000).toFixed(3)} د.ل صالح حتى ${validUntil}`,
            createdAt: now,
          })
          .run();

        return { id: quotationId, quoteNumber, total, validUntil };
      })();

      return result;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg === 'customer_not_found') {
        return reply.code(400).send({ error: 'customer_not_found', message: 'العميل غير موجود' });
      }
      if (msg.startsWith('product_not_found:')) {
        return reply
          .code(400)
          .send({ error: 'product_not_found', message: 'أحد المنتجات غير موجود' });
      }
      if (msg.startsWith('price_not_allowed:')) {
        const [, name] = msg.split(':');
        return reply.code(400).send({
          error: 'price_not_allowed',
          message: `تغيير سعر المنتج (${name}) في عرض السعر يتطلب موافقة المدير`,
        });
      }
      if (msg.startsWith('unit_not_found:')) {
        const [, name] = msg.split(':');
        return reply.code(400).send({
          error: 'unit_not_found',
          message: `وحدة التعبئة المحددة للمنتج (${name}) غير موجودة`,
        });
      }
      throw err;
    }
  });

  // Cancel an active quotation (creator or manager)
  app.post('/quotations/:id/cancel', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const quotation = app.db.select().from(quotations).where(eq(quotations.id, id)).get();
    if (!quotation) {
      return reply.code(404).send({ error: 'not_found', message: 'عرض السعر غير موجود' });
    }
    if (quotation.status !== 'active') {
      return reply
        .code(400)
        .send({ error: 'not_active', message: 'لا يمكن إلغاء عرض سعر غير نشط' });
    }
    if (req.user!.role !== 'manager' && quotation.userId !== req.user!.userId) {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'إلغاء عروض الآخرين متاح للمدراء فقط' });
    }

    app.db.update(quotations).set({ status: 'cancelled' }).where(eq(quotations.id, id)).run();
    app.db
      .insert(auditLogs)
      .values({
        userId: req.user!.userId,
        action: 'cancel_quotation',
        details: `إلغاء عرض السعر ${quotation.quoteNumber}`,
        createdAt: new Date().toISOString(),
      })
      .run();
    return { success: true };
  });
}
