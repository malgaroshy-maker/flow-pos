import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { products, stockMovements, auditLogs } from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { normalizeArabic } from '../lib/arabic.js';

export async function productRoutes(app: FastifyInstance) {
  // Apply authentication to all product mutation routes
  app.addHook('preHandler', async (req, reply) => {
    // GET requests don't require authentication for viewing, but mutations do.
    if (req.method !== 'GET') {
      await authenticateRequest(req, reply);
    }
  });

  // Get products list with optional search
  app.get('/products', async (req, reply) => {
    const { search } = req.query as { search?: string };
    const allProducts = app.db.select().from(products).orderBy(desc(products.id)).all();

    if (!search) {
      return allProducts;
    }

    const normalizedSearch = normalizeArabic(search);
    return allProducts.filter((p) => {
      const nameMatch = normalizeArabic(p.name).includes(normalizedSearch);
      const barcodeMatch = p.barcode && p.barcode.includes(search);
      const serialMatch =
        p.serialNumber && p.serialNumber.toLowerCase().includes(search.toLowerCase());
      return nameMatch || barcodeMatch || serialMatch;
    });
  });

  // Get single product
  app.get('/products/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const product = app.db
      .select()
      .from(products)
      .where(eq(products.id, Number(id)))
      .get();
    if (!product) {
      return reply.code(404).send({ error: 'not_found', message: 'المنتج غير موجود' });
    }
    return product;
  });

  // Create product (manager only)
  app.post('/products', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'إضافة المنتجات متاحة للمدراء فقط' });
    }

    const body = req.body as any;
    const {
      name,
      type,
      category,
      baseUnit,
      barcode,
      costPrice,
      retailPrice,
      wholesalePrice,
      quantity,
      reorderPoint,
    } = body;

    if (!name || !type || !category || !baseUnit) {
      return reply
        .code(400)
        .send({
          error: 'missing_fields',
          message: 'الاسم، النوع، التصنيف، والوحدة الأساسية حقول مطلوبة',
        });
    }

    // Insert product
    const now = new Date().toISOString();
    const result = app.db
      .insert(products)
      .values({
        name,
        type,
        category,
        baseUnit,
        barcode: barcode || null,
        costPrice: Number(costPrice || 0),
        retailPrice: Number(retailPrice || 0),
        wholesalePrice: Number(wholesalePrice || 0),
        quantity: Number(quantity || 0),
        reorderPoint: Number(reorderPoint || 0),
        serialNumber: type === 'equipment' ? body.serialNumber || null : null,
        warrantyMonths: type === 'equipment' ? Number(body.warrantyMonths || 0) : null,
        batchNo: type === 'consumable' ? body.batchNo || null : null,
        expiryDate: type === 'consumable' ? body.expiryDate || null : null,
        createdAt: now,
      })
      .run();

    const newProductId = Number(result.lastInsertRowid);

    // If initial quantity is greater than 0, create a stock movement record
    const initialQty = Number(quantity || 0);
    if (initialQty > 0) {
      app.db
        .insert(stockMovements)
        .values({
          productId: newProductId,
          type: 'adjustment',
          quantity: initialQty,
          balanceAfter: initialQty,
          reason: 'رصيد أول المدة عند إنشاء المنتج',
          userId: req.user.userId,
          createdAt: now,
        })
        .run();
    }

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user.userId,
        action: 'create_product',
        details: `تم إضافة منتج جديد: ${name} (معرف: ${newProductId}) برصيد ${initialQty}`,
        createdAt: now,
      })
      .run();

    return { id: newProductId, success: true };
  });

  // Update product (manager only)
  app.put('/products/:id', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تعديل المنتجات متاح للمدراء فقط' });
    }

    const { id } = req.params as { id: string };
    const productId = Number(id);
    const body = req.body as any;

    const existing = app.db.select().from(products).where(eq(products.id, productId)).get();
    if (!existing) {
      return reply.code(404).send({ error: 'not_found', message: 'المنتج غير موجود' });
    }

    const {
      name,
      category,
      baseUnit,
      barcode,
      costPrice,
      retailPrice,
      wholesalePrice,
      reorderPoint,
    } = body;

    app.db
      .update(products)
      .set({
        name: name ?? existing.name,
        category: category ?? existing.category,
        baseUnit: baseUnit ?? existing.baseUnit,
        barcode: barcode !== undefined ? barcode : existing.barcode,
        costPrice: costPrice !== undefined ? Number(costPrice) : existing.costPrice,
        retailPrice: retailPrice !== undefined ? Number(retailPrice) : existing.retailPrice,
        wholesalePrice:
          wholesalePrice !== undefined ? Number(wholesalePrice) : existing.wholesalePrice,
        reorderPoint: reorderPoint !== undefined ? Number(reorderPoint) : existing.reorderPoint,
        serialNumber:
          existing.type === 'equipment'
            ? body.serialNumber !== undefined
              ? body.serialNumber
              : existing.serialNumber
            : null,
        warrantyMonths:
          existing.type === 'equipment'
            ? body.warrantyMonths !== undefined
              ? Number(body.warrantyMonths)
              : existing.warrantyMonths
            : null,
        batchNo:
          existing.type === 'consumable'
            ? body.batchNo !== undefined
              ? body.batchNo
              : existing.batchNo
            : null,
        expiryDate:
          existing.type === 'consumable'
            ? body.expiryDate !== undefined
              ? body.expiryDate
              : existing.expiryDate
            : null,
      })
      .where(eq(products.id, productId))
      .run();

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user.userId,
        action: 'update_product',
        details: `تحديث بيانات المنتج: ${name || existing.name} (معرف: ${productId})`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { success: true };
  });

  // Manual stock adjustment (manager only)
  app.post('/products/:id/adjust', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تسوية المخزون متاحة للمدراء فقط' });
    }

    const { id } = req.params as { id: string };
    const productId = Number(id);
    const { adjustmentQuantity, reason } = req.body as {
      adjustmentQuantity?: number;
      reason?: string;
    };

    if (adjustmentQuantity === undefined || !reason) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'الكمية وسبب التسوية مطلوبان' });
    }

    // Must execute inside a transaction to ensure integrity
    const result = app.sqlite.transaction(() => {
      const product = app.db.select().from(products).where(eq(products.id, productId)).get();
      if (!product) {
        throw new Error('product_not_found');
      }

      const newQty = product.quantity + adjustmentQuantity;
      if (newQty < 0) {
        throw new Error('negative_stock');
      }

      // Update quantity
      app.db.update(products).set({ quantity: newQty }).where(eq(products.id, productId)).run();

      // Log movement
      app.db
        .insert(stockMovements)
        .values({
          productId,
          type: 'adjustment',
          quantity: adjustmentQuantity,
          balanceAfter: newQty,
          reason,
          userId: req.user!.userId,
          createdAt: new Date().toISOString(),
        })
        .run();

      // Log audit
      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'adjust_stock',
          details: `تسوية مخزون للمنتج ${product.name} (المعرف: ${productId}): تعديل بـ ${adjustmentQuantity}، الرصيد الجديد: ${newQty}. السبب: ${reason}`,
          createdAt: new Date().toISOString(),
        })
        .run();

      return { success: true, newQuantity: newQty };
    })();

    return result;
  });

  // Get stock movements ledger for a product
  app.get('/products/:id/movements', async (req, reply) => {
    const { id } = req.params as { id: string };
    const productId = Number(id);

    const movements = app.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId))
      .orderBy(desc(stockMovements.id))
      .all();

    return movements;
  });
}
