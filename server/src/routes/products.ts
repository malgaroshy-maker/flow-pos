import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  products,
  productUnits,
  productComponents,
  stockMovements,
  auditLogs,
} from '../db/schema.js';
import { resolveDbPath } from '../db/index.js';
import { authenticateRequest } from './auth.js';
import { normalizeArabic } from '../lib/arabic.js';
import { requireNonNegativeInt, requirePositiveInt, ValidationError } from '../lib/validate.js';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function productRoutes(app: FastifyInstance) {
  // All product routes require a session — GETs included, since the list
  // exposes cost prices (margins) and must not be readable by anyone on the WiFi.
  app.addHook('preHandler', authenticateRequest);

  // Get products list with optional search (packaging units and bundle
  // components attached; bundles report a computed available quantity)
  app.get('/products', async (req, reply) => {
    const { search } = req.query as { search?: string };
    const allProducts = app.db.select().from(products).orderBy(desc(products.id)).all();
    const allUnits = app.db.select().from(productUnits).all();
    const allComponents = app.db.select().from(productComponents).all();
    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const unitsByProduct = new Map<number, typeof allUnits>();
    for (const u of allUnits) {
      const list = unitsByProduct.get(u.productId) ?? [];
      list.push(u);
      unitsByProduct.set(u.productId, list);
    }
    const componentsByProduct = new Map<number, typeof allComponents>();
    for (const c of allComponents) {
      const list = componentsByProduct.get(c.productId) ?? [];
      list.push(c);
      componentsByProduct.set(c.productId, list);
    }

    const enriched = allProducts.map((p) => {
      const components = (componentsByProduct.get(p.id) ?? []).map((c) => ({
        ...c,
        componentName: productById.get(c.componentProductId)?.name ?? null,
      }));
      // Bundles can be assembled as many times as the scarcest component allows
      let bundleAvailable: number | null = null;
      if (components.length > 0) {
        bundleAvailable = Math.min(
          ...components.map((c) => {
            const comp = productById.get(c.componentProductId);
            return comp ? Math.floor((comp.quantity - comp.reservedQuantity) / c.quantity) : 0;
          }),
        );
      }
      return {
        ...p,
        units: unitsByProduct.get(p.id) ?? [],
        components,
        bundleAvailable,
      };
    });

    if (!search) {
      return enriched;
    }

    const normalizedSearch = normalizeArabic(search);
    return enriched.filter((p) => {
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

  // Get product by barcode
  app.get('/products/barcode/:barcode', async (req, reply) => {
    const { barcode } = req.params as { barcode: string };
    const product = app.db.select().from(products).where(eq(products.barcode, barcode)).get();
    if (!product) {
      return reply
        .code(404)
        .send({ error: 'not_found', message: 'المنتج غير موجود بهذا الباركود' });
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
      return reply.code(400).send({
        error: 'missing_fields',
        message: 'الاسم، النوع، التصنيف، والوحدة الأساسية حقول مطلوبة',
      });
    }

    try {
      requireNonNegativeInt(Number(costPrice || 0), 'costPrice');
      requireNonNegativeInt(Number(retailPrice || 0), 'retailPrice');
      requireNonNegativeInt(Number(wholesalePrice || 0), 'wholesalePrice');
      requireNonNegativeInt(Number(quantity || 0), 'quantity');
      requireNonNegativeInt(Number(reorderPoint || 0), 'reorderPoint');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
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
        taxExempt: Boolean(body.taxExempt),
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

    const createdProduct = app.db
      .select()
      .from(products)
      .where(eq(products.id, newProductId))
      .get();

    return createdProduct;
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

    try {
      if (body.costPrice !== undefined) requireNonNegativeInt(Number(body.costPrice), 'costPrice');
      if (body.retailPrice !== undefined)
        requireNonNegativeInt(Number(body.retailPrice), 'retailPrice');
      if (body.wholesalePrice !== undefined)
        requireNonNegativeInt(Number(body.wholesalePrice), 'wholesalePrice');
      if (body.reorderPoint !== undefined)
        requireNonNegativeInt(Number(body.reorderPoint), 'reorderPoint');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
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
        taxExempt: body.taxExempt !== undefined ? Boolean(body.taxExempt) : existing.taxExempt,
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

    if (typeof adjustmentQuantity !== 'number' || !Number.isSafeInteger(adjustmentQuantity)) {
      return reply
        .code(400)
        .send({ error: 'invalid_quantity', message: 'كمية التسوية يجب أن تكون عدداً صحيحاً' });
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

  // Replace a product's packaging units (manager only, full-list replace).
  // Stock stays in the base unit; each packaging unit sells at its own price.
  app.put('/products/:id/units', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'إدارة وحدات التعبئة متاحة للمدراء فقط' });
    }

    const productId = Number((req.params as { id: string }).id);
    const product = app.db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) {
      return reply.code(404).send({ error: 'not_found', message: 'المنتج غير موجود' });
    }

    const { units } = req.body as {
      units?: Array<{ unitName?: string; conversionFactor?: number; price?: number }>;
    };
    if (!Array.isArray(units)) {
      return reply.code(400).send({ error: 'missing_units', message: 'قائمة الوحدات مطلوبة' });
    }

    for (const u of units) {
      if (!u.unitName || !u.unitName.trim()) {
        return reply.code(400).send({ error: 'invalid_unitName', message: 'اسم الوحدة مطلوب' });
      }
      if (
        typeof u.conversionFactor !== 'number' ||
        !Number.isSafeInteger(u.conversionFactor) ||
        u.conversionFactor < 2
      ) {
        return reply.code(400).send({
          error: 'invalid_conversionFactor',
          message: 'معامل التحويل يجب أن يكون عدداً صحيحاً أكبر من 1 (كم وحدة أساسية في الوحدة)',
        });
      }
      try {
        requireNonNegativeInt(u.price, 'price');
      } catch (err) {
        if (err instanceof ValidationError) {
          return reply.code(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }

    const now = new Date().toISOString();
    app.sqlite.transaction(() => {
      app.db.delete(productUnits).where(eq(productUnits.productId, productId)).run();
      for (const u of units) {
        app.db
          .insert(productUnits)
          .values({
            productId,
            unitName: u.unitName!.trim(),
            conversionFactor: u.conversionFactor!,
            price: u.price!,
            createdAt: now,
          })
          .run();
      }
      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'set_product_units',
          details: `تحديث وحدات التعبئة للمنتج ${product.name}: ${units.length} وحدة`,
          createdAt: now,
        })
        .run();
    })();

    const saved = app.db
      .select()
      .from(productUnits)
      .where(eq(productUnits.productId, productId))
      .all();
    return { success: true, units: saved };
  });

  // Replace a bundle's components (manager only, full-list replace).
  // A product with components sells as a bundle: its own stock is unused and
  // every sale deducts the components.
  app.put('/products/:id/components', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'إدارة مكونات الباقات متاحة للمدراء فقط' });
    }

    const productId = Number((req.params as { id: string }).id);
    const product = app.db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) {
      return reply.code(404).send({ error: 'not_found', message: 'المنتج غير موجود' });
    }

    const { components } = req.body as {
      components?: Array<{ componentProductId?: number; quantity?: number }>;
    };
    if (!Array.isArray(components)) {
      return reply
        .code(400)
        .send({ error: 'missing_components', message: 'قائمة المكونات مطلوبة' });
    }

    for (const c of components) {
      try {
        requirePositiveInt(c.componentProductId, 'componentProductId');
        requirePositiveInt(c.quantity, 'quantity');
      } catch (err) {
        if (err instanceof ValidationError) {
          return reply.code(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
      if (c.componentProductId === productId) {
        return reply
          .code(400)
          .send({ error: 'self_component', message: 'لا يمكن إضافة الباقة كمكون لنفسها' });
      }
      const comp = app.db
        .select()
        .from(products)
        .where(eq(products.id, c.componentProductId!))
        .get();
      if (!comp) {
        return reply
          .code(404)
          .send({ error: 'component_not_found', message: 'أحد المكونات غير موجود' });
      }
      // No nested bundles: a component may not itself have components.
      const nested = app.db
        .select()
        .from(productComponents)
        .where(eq(productComponents.productId, c.componentProductId!))
        .get();
      if (nested) {
        return reply.code(400).send({
          error: 'nested_bundle',
          message: `المكون (${comp.name}) هو باقة بدوره — الباقات المتداخلة غير مدعومة`,
        });
      }
    }

    const now = new Date().toISOString();
    app.sqlite.transaction(() => {
      app.db.delete(productComponents).where(eq(productComponents.productId, productId)).run();
      for (const c of components) {
        app.db
          .insert(productComponents)
          .values({
            productId,
            componentProductId: c.componentProductId!,
            quantity: c.quantity!,
          })
          .run();
      }
      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'set_product_components',
          details: `تحديث مكونات الباقة ${product.name}: ${components.length} مكون`,
          createdAt: now,
        })
        .run();
    })();

    return { success: true };
  });

  // Upload/replace a product image (manager only)
  app.post('/products/:id/image', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'رفع صور المنتجات متاح للمدراء فقط' });
    }

    const productId = Number((req.params as { id: string }).id);
    const product = app.db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) {
      return reply.code(404).send({ error: 'not_found', message: 'المنتج غير موجود' });
    }

    const file = await req.file();
    if (!file) {
      return reply.code(400).send({ error: 'missing_file', message: 'ملف الصورة مطلوب' });
    }

    const ext = IMAGE_TYPES[file.mimetype];
    if (!ext) {
      return reply
        .code(400)
        .send({ error: 'invalid_type', message: 'صيغة الصورة يجب أن تكون JPG أو PNG أو WebP' });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      return reply
        .code(400)
        .send({ error: 'file_too_large', message: 'حجم الصورة يتجاوز الحد المسموح (2 ميجابايت)' });
    }

    const uploadsDir = join(dirname(resolveDbPath()), 'uploads');
    mkdirSync(uploadsDir, { recursive: true });

    // Drop any previous image with a different extension
    for (const oldExt of Object.values(IMAGE_TYPES)) {
      const oldPath = join(uploadsDir, `product-${productId}.${oldExt}`);
      if (oldExt !== ext && existsSync(oldPath)) unlinkSync(oldPath);
    }

    const filename = `product-${productId}.${ext}`;
    writeFileSync(join(uploadsDir, filename), buffer);

    // Cache-busting query so replacing an image shows up without a hard refresh
    const imageUrl = `/uploads/${filename}?v=${Date.now()}`;
    app.db.update(products).set({ imageUrl }).where(eq(products.id, productId)).run();

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user.userId,
        action: 'upload_product_image',
        details: `رفع صورة للمنتج ${product.name} (معرف: ${productId})`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { success: true, imageUrl };
  });

  // Remove a product image (manager only)
  app.delete('/products/:id/image', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'حذف صور المنتجات متاح للمدراء فقط' });
    }

    const productId = Number((req.params as { id: string }).id);
    const product = app.db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) {
      return reply.code(404).send({ error: 'not_found', message: 'المنتج غير موجود' });
    }

    const uploadsDir = join(dirname(resolveDbPath()), 'uploads');
    for (const ext of Object.values(IMAGE_TYPES)) {
      const path = join(uploadsDir, `product-${productId}.${ext}`);
      if (existsSync(path)) unlinkSync(path);
    }
    app.db.update(products).set({ imageUrl: null }).where(eq(products.id, productId)).run();

    return { success: true };
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
