import type { FastifyInstance } from 'fastify';
import { eq, desc, like } from 'drizzle-orm';
import {
  sales,
  saleItems,
  saleReturns,
  saleReturnItems,
  products,
  stockMovements,
  cashMovements,
  auditLogs,
  shifts,
  settings,
  users,
  customers,
  quotations,
  productUnits,
  productComponents,
  deposits,
  warranties,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { verifyManagerPin } from '../lib/pin.js';
import { applyPermille, lineTotal } from '../lib/money.js';
import { requireNonNegativeInt, requirePositiveInt, ValidationError } from '../lib/validate.js';
import { resolveUnitPrice } from '../lib/pricing.js';

export async function saleRoutes(app: FastifyInstance) {
  // Apply authentication to all sales routes
  app.addHook('preHandler', authenticateRequest);

  // List recent sales
  app.get('/sales', async (req, reply) => {
    const list = app.db.select().from(sales).orderBy(desc(sales.id)).all();

    // Fetch users for username mapping
    const userList = app.db.select({ id: users.id, username: users.username }).from(users).all();
    const userMap = new Map(userList.map((u) => [u.id, u.username]));

    return list.map((s) => ({
      ...s,
      username: userMap.get(s.userId) || 'غير معروف',
    }));
  });

  // Get single sale details with items
  app.get('/sales/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const saleId = Number(id);

    const sale = app.db.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) {
      return reply.code(404).send({ error: 'not_found', message: 'الفاتورة غير موجودة' });
    }

    const items = app.db
      .select({
        id: saleItems.id,
        productId: saleItems.productId,
        quantity: saleItems.quantity,
        unitName: saleItems.unitName,
        conversionFactor: saleItems.conversionFactor,
        unitPrice: saleItems.unitPrice,
        total: saleItems.total,
        productName: products.name,
        productType: products.type,
        baseUnit: products.baseUnit,
        serialNumber: saleItems.serialNumber,
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, saleId))
      .all();

    return { ...sale, items };
  });

  // Create a new cash/credit sale
  app.post('/sales', async (req, reply) => {
    const body = req.body as {
      customerId?: number;
      customerName?: string;
      items: Array<{
        productId: number;
        quantity: number;
        unitPrice: number;
        unitId?: number; // packaging unit; absent = base unit
        serialNumber?: string;
      }>;
      discount: number; // in milli-LYD
      paymentType?: 'cash' | 'credit';
      paymentMethod?: 'cash' | 'card' | 'transfer';
      overridePin?: string;
      quotationId?: number; // converting a quotation: marked atomically with the sale
      depositId?: number; // applying a held customer deposit against this invoice
    };

    const {
      customerId,
      customerName,
      items,
      discount = 0,
      paymentType = 'cash',
      paymentMethod = 'cash',
      overridePin,
      quotationId,
      depositId,
    } = body;

    if (!items || items.length === 0) {
      return reply.code(400).send({ error: 'empty_cart', message: 'السلة فارغة' });
    }

    try {
      for (const item of items) {
        requirePositiveInt(item.productId, 'productId');
        requirePositiveInt(item.quantity, 'quantity');
        requireNonNegativeInt(item.unitPrice, 'unitPrice');
        if (item.unitId !== undefined) requirePositiveInt(item.unitId, 'unitId');
      }
      requireNonNegativeInt(discount, 'discount');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    if (paymentType === 'credit' && !customerId) {
      return reply.code(400).send({
        error: 'customer_required',
        message: 'يجب اختيار العميل لتسجيل فاتورة بيع آجل (دين)',
      });
    }

    // 1. Must check for active shift
    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (!activeShift) {
      return reply
        .code(400)
        .send({ error: 'no_active_shift', message: 'لا توجد توكة مفتوحة لتسجيل المبيعات' });
    }

    // Load active settings for tax calculation
    const currentSettings = app.db.select().from(settings).where(eq(settings.id, 1)).get();
    const isTaxEnabled = currentSettings?.taxEnabled ?? false;
    const taxRatePermille = currentSettings?.taxRatePermille ?? 0;
    const discountCapPercent = currentSettings?.discountCapPercent ?? 10;

    // Check discount cap
    let subtotal = 0;
    for (const item of items) {
      subtotal += lineTotal(item.unitPrice, item.quantity);
    }

    if (discount > subtotal) {
      return reply
        .code(400)
        .send({ error: 'discount_exceeds_subtotal', message: 'الخصم أكبر من قيمة الفاتورة' });
    }

    const discountCap = Math.floor((subtotal * discountCapPercent) / 100);
    const isOverDiscountCap = discount > discountCap;

    // 2. Perform overrides or permission check
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

    if (isOverDiscountCap && req.user!.role !== 'manager' && !pinUser) {
      return reply.code(400).send({
        error: 'discount_limit_exceeded',
        message: `لقد تجاوزت حد الخصم المسموح به (${discountCapPercent}%). يرجى إدخال PIN المدير للموافقة.`,
      });
    }

    // 3. Stock availability verification + Sale Execution inside SQLite Transaction
    try {
      const result = app.sqlite.transaction(() => {
        const now = new Date().toISOString();

        // Converting a quotation: it must still be active and within validity.
        // Marked converted inside this transaction so it can never convert twice.
        let quotation: typeof quotations.$inferSelect | undefined;
        if (quotationId) {
          quotation = app.db.select().from(quotations).where(eq(quotations.id, quotationId)).get();
          if (!quotation) throw new Error('quotation_not_found');
          if (quotation.status !== 'active') throw new Error('quotation_not_active');
          if (quotation.validUntil < now.slice(0, 10)) {
            app.db
              .update(quotations)
              .set({ status: 'expired' })
              .where(eq(quotations.id, quotation.id))
              .run();
            throw new Error('quotation_expired');
          }
        }

        // Check customer existence if customerId provided
        let targetCustomerName = customerName || null;
        if (customerId) {
          const cust = app.db.select().from(customers).where(eq(customers.id, customerId)).get();
          if (!cust) {
            throw new Error(`customer_not_found:${customerId}`);
          }
          targetCustomerName = cust.name;
        }

        // Applying a customer deposit: must be held and belong to this
        // customer; its value comes off the cash due / credit added.
        let appliedDeposit: typeof deposits.$inferSelect | undefined;
        if (depositId) {
          appliedDeposit = app.db.select().from(deposits).where(eq(deposits.id, depositId)).get();
          if (!appliedDeposit) throw new Error('deposit_not_found');
          if (appliedDeposit.status !== 'held') throw new Error('deposit_not_held');
          if (!customerId || appliedDeposit.customerId !== customerId) {
            throw new Error('deposit_customer_mismatch');
          }
        }

        // Verification step inside transaction. Prices are server-authoritative:
        // base units resolve special→tier→retail; packaging units sell at
        // their own configured price. Stock is always checked in base units,
        // net of deposit reservations (this sale's own reservation is freed).
        const stockOverrides: string[] = [];
        const priceOverrides: string[] = [];
        const resolvedItems: Array<{
          item: (typeof items)[number];
          product: typeof products.$inferSelect;
          unitName: string | null;
          conversionFactor: number;
          baseQuantity: number;
          components: Array<{ componentProductId: number; quantity: number }>;
        }> = [];
        let taxableSubtotal = 0;
        const reservationRelease = new Map<number, number>();
        if (appliedDeposit?.productId) {
          reservationRelease.set(appliedDeposit.productId, 1);
        }
        const availableOf = (p: typeof products.$inferSelect) =>
          p.quantity - p.reservedQuantity + (reservationRelease.get(p.id) ?? 0);

        for (const item of items) {
          const product = app.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .get();
          if (!product) {
            throw new Error(`product_not_found:${item.productId}`);
          }

          const components = app.db
            .select()
            .from(productComponents)
            .where(eq(productComponents.productId, product.id))
            .all();
          const isBundle = components.length > 0;
          if (isBundle && item.unitId) {
            throw new Error(`unit_not_found:${product.name}`);
          }

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

          if (item.unitPrice !== authorizedPrice) {
            if (!pinUser && req.user!.role !== 'manager') {
              throw new Error(`price_not_allowed:${product.name}`);
            }
            priceOverrides.push(`${product.name}: ${item.unitPrice} بدلاً من ${authorizedPrice}`);
          }

          const baseQuantity = item.quantity * conversionFactor;
          if (!Number.isSafeInteger(baseQuantity)) {
            throw new Error(`product_not_found:${item.productId}`);
          }

          if (isBundle) {
            // A bundle sells at its own price and consumes its components.
            for (const comp of components) {
              const compProduct = app.db
                .select()
                .from(products)
                .where(eq(products.id, comp.componentProductId))
                .get();
              if (!compProduct) throw new Error(`product_not_found:${comp.componentProductId}`);
              const needed = comp.quantity * item.quantity;
              if (availableOf(compProduct) < needed) {
                if (!pinUser && req.user!.role !== 'manager') {
                  throw new Error(
                    `insufficient_stock:${compProduct.name}:${availableOf(compProduct)}`,
                  );
                }
                stockOverrides.push(
                  `${compProduct.name} ضمن الباقة ${product.name} (المتاح: ${availableOf(compProduct)}, المطلوب: ${needed})`,
                );
              }
            }
          } else if (availableOf(product) < baseQuantity) {
            if (!pinUser && req.user!.role !== 'manager') {
              throw new Error(`insufficient_stock:${product.name}:${availableOf(product)}`);
            }
            stockOverrides.push(
              `${product.name} (المتاح: ${availableOf(product)}, المباع: ${baseQuantity})`,
            );
          }

          if (!product.taxExempt) {
            taxableSubtotal += lineTotal(item.unitPrice, item.quantity);
          }
          resolvedItems.push({
            item,
            product,
            unitName,
            conversionFactor,
            baseQuantity,
            components,
          });
        }

        // Generate gap-free sequential invoice number: INV-YYYY-NNNNN.
        // Uses max(existing)+1 within the year so it stays correct even if
        // historical rows are ever purged; cancelled invoices keep their number.
        const currentYear = new Date().getFullYear();
        const yearPrefix = `INV-${currentYear}-`;
        const matchingSales = app.db
          .select({ invoiceNumber: sales.invoiceNumber })
          .from(sales)
          .where(like(sales.invoiceNumber, `${yearPrefix}%`))
          .all();

        let maxNum = 0;
        for (const s of matchingSales) {
          const num = parseInt(s.invoiceNumber.slice(yearPrefix.length), 10);
          if (Number.isFinite(num) && num > maxNum) maxNum = num;
        }
        const invoiceNumber = `${yearPrefix}${String(maxNum + 1).padStart(5, '0')}`;

        // Compute Tax & Totals. Tax applies only to non-exempt lines; the
        // invoice discount reduces the taxable base proportionally.
        const taxableDiscountShare =
          subtotal > 0 ? Math.floor((discount * taxableSubtotal) / subtotal) : 0;
        const taxAmount = isTaxEnabled
          ? applyPermille(taxableSubtotal - taxableDiscountShare, taxRatePermille)
          : 0;
        const total = subtotal + taxAmount - discount;

        // The applied deposit comes off what is due now — it can never exceed
        // the invoice total (refund the difference first).
        const depositAmount = appliedDeposit ? appliedDeposit.amount : 0;
        if (depositAmount > total) {
          throw new Error('deposit_exceeds_total');
        }

        // Credit limit: exceeding it blocks the credit sale unless a manager
        // (or PIN) approves — approved overshoots are audit-flagged below.
        let creditLimitOverride: string | null = null;
        if (paymentType === 'credit' && customerId) {
          const cust = app.db.select().from(customers).where(eq(customers.id, customerId)).get()!;
          if (cust.creditLimit > 0 && cust.creditBalance + total > cust.creditLimit) {
            if (!pinUser && req.user!.role !== 'manager') {
              throw new Error(
                `credit_limit_exceeded:${cust.name}:${cust.creditLimit}:${cust.creditBalance}`,
              );
            }
            creditLimitOverride = `${cust.name}: الرصيد ${cust.creditBalance + total} يتجاوز السقف ${cust.creditLimit}`;
          }
        }

        // Create Sales record
        const saleInsert = app.db
          .insert(sales)
          .values({
            invoiceNumber,
            customerId: customerId || null,
            customerName: targetCustomerName,
            userId: req.user!.userId,
            shiftId: activeShift.id,
            paymentType,
            paymentMethod,
            taxAmount,
            discount,
            qrRef: invoiceNumber,
            total,
            status: 'completed',
            createdAt: now,
          })
          .run();

        const saleId = Number(saleInsert.lastInsertRowid);

        // Update customer debt balance if credit sale (net of applied deposit)
        if (paymentType === 'credit' && customerId) {
          const cust = app.db.select().from(customers).where(eq(customers.id, customerId)).get()!;
          app.db
            .update(customers)
            .set({ creditBalance: cust.creditBalance + total - depositAmount })
            .where(eq(customers.id, customerId))
            .run();
        }

        // Consume the deposit: applied, linked, reservation released
        if (appliedDeposit) {
          app.db
            .update(deposits)
            .set({ status: 'applied', saleId, resolvedAt: now })
            .where(eq(deposits.id, appliedDeposit.id))
            .run();
          if (appliedDeposit.productId) {
            const reservedProduct = app.db
              .select()
              .from(products)
              .where(eq(products.id, appliedDeposit.productId))
              .get();
            if (reservedProduct && reservedProduct.reservedQuantity > 0) {
              app.db
                .update(products)
                .set({ reservedQuantity: reservedProduct.reservedQuantity - 1 })
                .where(eq(products.id, reservedProduct.id))
                .run();
            }
          }
          app.db
            .insert(auditLogs)
            .values({
              userId: req.user!.userId,
              action: 'apply_deposit',
              details: `خصم عربون #${appliedDeposit.id} بقيمة ${(depositAmount / 1000).toFixed(3)} د.ل من الفاتورة ${invoiceNumber}`,
              createdAt: now,
            })
            .run();
        }

        // Process each item — stock always mutates in base units. Bundles
        // deduct every component; the bundle parent's own stock is untouched.
        for (const {
          item,
          unitName,
          conversionFactor,
          baseQuantity,
          components,
        } of resolvedItems) {
          if (components.length > 0) {
            for (const comp of components) {
              const compProduct = app.db
                .select()
                .from(products)
                .where(eq(products.id, comp.componentProductId))
                .get()!;
              const deduct = comp.quantity * item.quantity;
              const newQty = compProduct.quantity - deduct;
              app.db
                .update(products)
                .set({ quantity: newQty })
                .where(eq(products.id, compProduct.id))
                .run();
              app.db
                .insert(stockMovements)
                .values({
                  productId: compProduct.id,
                  type: 'sale',
                  quantity: -deduct,
                  balanceAfter: newQty,
                  reason: `مبيعات فاتورة رقم ${invoiceNumber}`,
                  userId: req.user!.userId,
                  createdAt: now,
                })
                .run();
            }
          } else {
            const product = app.db
              .select()
              .from(products)
              .where(eq(products.id, item.productId))
              .get()!;
            const newQty = product.quantity - baseQuantity;

            // Update stock
            app.db
              .update(products)
              .set({ quantity: newQty })
              .where(eq(products.id, item.productId))
              .run();

            // Create stock movement ledger (base units)
            app.db
              .insert(stockMovements)
              .values({
                productId: item.productId,
                type: 'sale',
                quantity: -baseQuantity,
                balanceAfter: newQty,
                reason: `مبيعات فاتورة رقم ${invoiceNumber}`,
                userId: req.user!.userId,
                createdAt: now,
              })
              .run();
          }

          // Create sale items (quantity in the sold unit + unit snapshot)
          const insertedItem = app.db
            .insert(saleItems)
            .values({
              saleId,
              productId: item.productId,
              quantity: item.quantity,
              unitName,
              conversionFactor,
              unitPrice: item.unitPrice,
              total: lineTotal(item.unitPrice, item.quantity),
              serialNumber: item.serialNumber || null,
            })
            .run();

          // Auto-create warranty record for equipment items with serial number
          const itemProduct = app.db.select().from(products).where(eq(products.id, item.productId)).get();
          if (itemProduct && itemProduct.type === 'equipment' && item.serialNumber) {
            const months = itemProduct.warrantyMonths || 12;
            const startDate = now.slice(0, 10);
            const endDateObj = new Date(now);
            endDateObj.setMonth(endDateObj.getMonth() + months);
            const endDate = endDateObj.toISOString().slice(0, 10);

            app.db
              .insert(warranties)
              .values({
                saleItemId: Number(insertedItem.lastInsertRowid),
                saleId,
                serialNumber: item.serialNumber,
                productName: itemProduct.name,
                startDate,
                months,
                endDate,
                createdAt: now,
              })
              .run();
          }
        }

        // Cash flow movement (only for cash payments; net of applied deposit
        // — that cash entered the drawer when the deposit was taken)
        if (paymentType === 'cash' && paymentMethod === 'cash' && total - depositAmount > 0) {
          app.db
            .insert(cashMovements)
            .values({
              shiftId: activeShift.id,
              type: 'sale',
              amount: total - depositAmount,
              referenceId: invoiceNumber,
              userId: req.user!.userId,
              createdAt: now,
            })
            .run();
        }

        // Audit override if active
        if (pinUser) {
          app.db
            .insert(auditLogs)
            .values({
              userId: pinUser.id,
              action: 'manager_override_sale',
              details: `موافقة المدير ${pinUser.username} لتخطي الحدود لفاتورة ${invoiceNumber}`,
              createdAt: now,
            })
            .run();
        }

        // Flag every stock/price override in the audit log — including a
        // manager acting on their own account, per the domain rules.
        if (stockOverrides.length > 0) {
          app.db
            .insert(auditLogs)
            .values({
              userId: (pinUser ? pinUser.id : req.user!.userId) as number,
              action: 'stock_override_sale',
              details: `بيع بكمية تتجاوز المخزون في الفاتورة ${invoiceNumber}: ${stockOverrides.join('، ')}`,
              createdAt: now,
            })
            .run();
        }
        if (priceOverrides.length > 0) {
          app.db
            .insert(auditLogs)
            .values({
              userId: (pinUser ? pinUser.id : req.user!.userId) as number,
              action: 'price_override_sale',
              details: `بيع بسعر مخصص في الفاتورة ${invoiceNumber}: ${priceOverrides.join('، ')}`,
              createdAt: now,
            })
            .run();
        }
        if (creditLimitOverride) {
          app.db
            .insert(auditLogs)
            .values({
              userId: (pinUser ? pinUser.id : req.user!.userId) as number,
              action: 'credit_limit_override_sale',
              details: `تجاوز سقف الائتمان في الفاتورة ${invoiceNumber}: ${creditLimitOverride}`,
              createdAt: now,
            })
            .run();
        }

        // Mark the quotation converted, linked to this sale
        if (quotation) {
          app.db
            .update(quotations)
            .set({ status: 'converted', convertedSaleId: saleId })
            .where(eq(quotations.id, quotation.id))
            .run();
          app.db
            .insert(auditLogs)
            .values({
              userId: req.user!.userId,
              action: 'convert_quotation',
              details: `تحويل عرض السعر ${quotation.quoteNumber} إلى فاتورة ${invoiceNumber}`,
              createdAt: now,
            })
            .run();
        }

        // Audit sale
        app.db
          .insert(auditLogs)
          .values({
            userId: req.user!.userId,
            action: 'create_sale',
            details: `إنشاء فاتورة مبيعات ${invoiceNumber} بمبلغ إجمالي ${total} د.ل`,
            createdAt: now,
          })
          .run();

        return { id: saleId, invoiceNumber, total };
      })();

      return result;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.startsWith('product_not_found:')) {
        return reply.code(400).send({
          error: 'product_not_found',
          message: 'أحد المنتجات في السلة غير موجود في قاعدة البيانات',
        });
      }
      if (msg.startsWith('insufficient_stock:')) {
        const [, name, qty] = msg.split(':');
        return reply.code(400).send({
          error: 'insufficient_stock',
          message: `المخزون غير كافٍ للمنتج (${name})، الكمية المتاحة: ${qty}. يرجى طلب موافقة المدير لتجاوز الرصيد.`,
        });
      }
      if (msg.startsWith('price_not_allowed:')) {
        const [, name] = msg.split(':');
        return reply.code(400).send({
          error: 'price_not_allowed',
          message: `تغيير سعر المنتج (${name}) يتطلب موافقة المدير أو إدخال رمز PIN`,
        });
      }
      if (msg.startsWith('unit_not_found:')) {
        const [, name] = msg.split(':');
        return reply.code(400).send({
          error: 'unit_not_found',
          message: `وحدة التعبئة المحددة للمنتج (${name}) غير موجودة`,
        });
      }
      if (msg.startsWith('credit_limit_exceeded:')) {
        const [, name, limit] = msg.split(':');
        return reply.code(400).send({
          error: 'credit_limit_exceeded',
          message: `هذه الفاتورة تتجاوز سقف الائتمان للعميل (${name}) البالغ ${(Number(limit) / 1000).toFixed(3)} د.ل — يتطلب موافقة المدير`,
        });
      }
      if (msg === 'deposit_not_found') {
        return reply.code(400).send({ error: 'deposit_not_found', message: 'العربون غير موجود' });
      }
      if (msg === 'deposit_not_held') {
        return reply
          .code(400)
          .send({ error: 'deposit_not_held', message: 'العربون تم استخدامه أو تسويته مسبقاً' });
      }
      if (msg === 'deposit_customer_mismatch') {
        return reply.code(400).send({
          error: 'deposit_customer_mismatch',
          message: 'العربون يخص عميلاً آخر — اختر نفس العميل على الفاتورة',
        });
      }
      if (msg === 'deposit_exceeds_total') {
        return reply.code(400).send({
          error: 'deposit_exceeds_total',
          message: 'قيمة العربون أكبر من إجمالي الفاتورة — استرد الفرق نقداً أولاً',
        });
      }
      if (msg === 'quotation_not_found') {
        return reply
          .code(400)
          .send({ error: 'quotation_not_found', message: 'عرض السعر غير موجود' });
      }
      if (msg === 'quotation_not_active') {
        return reply.code(400).send({
          error: 'quotation_not_active',
          message: 'عرض السعر تم تحويله أو إلغاؤه مسبقاً',
        });
      }
      if (msg === 'quotation_expired') {
        return reply
          .code(400)
          .send({ error: 'quotation_expired', message: 'انتهت صلاحية عرض السعر' });
      }
      throw err;
    }
  });

  // Cancel / Refund sale invoice (manager only or manager PIN override required)
  app.post('/sales/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const saleId = Number(id);
    const { overridePin } = (req.body as { overridePin?: string }) || {};

    let overrideUser: any = null;
    if (overridePin) {
      const v = verifyManagerPin(app.db, overridePin, req.ip);
      if (!v.success || !v.user) {
        return reply
          .code(400)
          .send({ error: 'invalid_override_pin', message: 'رمز PIN الخاص بالمدير غير صحيح' });
      }
      overrideUser = v.user;
    }

    if (req.user!.role !== 'manager' && !overrideUser) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'إلغاء الفواتير يتطلب صلاحية مدير أو إدخال رمز PIN للمدير',
      });
    }

    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (!activeShift) {
      return reply
        .code(400)
        .send({ error: 'no_active_shift', message: 'يجب فتح توكة أولاً لإجراء عملية الإرجاع' });
    }

    try {
      const result = app.sqlite.transaction(() => {
        const sale = app.db.select().from(sales).where(eq(sales.id, saleId)).get();
        if (!sale) {
          throw new Error('sale_not_found');
        }
        if (sale.status === 'cancelled') {
          throw new Error('already_cancelled');
        }

        const now = new Date().toISOString();
        const actorId = overrideUser ? overrideUser.id : req.user!.userId;

        // Cancel sale
        app.db.update(sales).set({ status: 'cancelled' }).where(eq(sales.id, saleId)).run();

        // Check any previous partial returns on this sale to avoid double-restoration
        const existingReturns = app.db
          .select()
          .from(saleReturns)
          .where(eq(saleReturns.saleId, saleId))
          .all();
        const alreadyReturnedAmount = existingReturns.reduce((sum, r) => sum + r.amount, 0);

        // Reverse stock movements for remaining unreturned items only
        const lines = app.db
          .select()
          .from(saleItems)
          .where(eq(saleItems.saleId, saleId))
          .all();

        for (const line of lines) {
          const unreturnedQty = line.quantity - line.returnedQuantity;
          if (unreturnedQty <= 0) continue;

          const conversionFactor = line.conversionFactor || 1;
          const baseUnitsToRestore = unreturnedQty * conversionFactor;

          const components = app.db
            .select()
            .from(productComponents)
            .where(eq(productComponents.productId, line.productId))
            .all();

          if (components.length > 0) {
            for (const comp of components) {
              const compProduct = app.db
                .select()
                .from(products)
                .where(eq(products.id, comp.componentProductId))
                .get();
              if (!compProduct) continue;
              const restoreCompQty = unreturnedQty * comp.quantity;
              const newQty = compProduct.quantity + restoreCompQty;

              app.db
                .update(products)
                .set({ quantity: newQty })
                .where(eq(products.id, compProduct.id))
                .run();

              app.db
                .insert(stockMovements)
                .values({
                  productId: compProduct.id,
                  type: 'return',
                  quantity: restoreCompQty,
                  balanceAfter: newQty,
                  reason: `مرتجع مبيعات (إلغاء تجميعة) فاتورة رقم ${sale.invoiceNumber}`,
                  userId: actorId,
                  createdAt: now,
                })
                .run();
            }
          } else {
            const product = app.db
              .select()
              .from(products)
              .where(eq(products.id, line.productId))
              .get();
            if (product) {
              const newQty = product.quantity + baseUnitsToRestore;
              app.db
                .update(products)
                .set({ quantity: newQty })
                .where(eq(products.id, product.id))
                .run();

              app.db
                .insert(stockMovements)
                .values({
                  productId: product.id,
                  type: 'return',
                  quantity: baseUnitsToRestore,
                  balanceAfter: newQty,
                  reason: `مرتجع مبيعات فاتورة رقم ${sale.invoiceNumber}`,
                  userId: actorId,
                  createdAt: now,
                })
                .run();
            }
          }
        }

        // A deposit applied to this sale goes back to "held"
        const appliedDeposit = app.db
          .select()
          .from(deposits)
          .where(eq(deposits.saleId, saleId))
          .get();
        const depositAmount = appliedDeposit?.status === 'applied' ? appliedDeposit.amount : 0;
        if (appliedDeposit && appliedDeposit.status === 'applied') {
          app.db
            .update(deposits)
            .set({ status: 'held', saleId: null, resolvedAt: null })
            .where(eq(deposits.id, appliedDeposit.id))
            .run();
          if (appliedDeposit.productId) {
            const reservedProduct = app.db
              .select()
              .from(products)
              .where(eq(products.id, appliedDeposit.productId))
              .get();
            if (reservedProduct) {
              app.db
                .update(products)
                .set({ reservedQuantity: reservedProduct.reservedQuantity + 1 })
                .where(eq(products.id, reservedProduct.id))
                .run();
            }
          }
        }

        // Net remaining cash or credit to refund (net of deposit & previous partial returns)
        const netSaleAmount = Math.max(0, sale.total - depositAmount);
        const remainingToRefund = Math.max(0, netSaleAmount - alreadyReturnedAmount);

        if (sale.paymentType === 'credit' && sale.customerId && remainingToRefund > 0) {
          const cust = app.db
            .select()
            .from(customers)
            .where(eq(customers.id, sale.customerId))
            .get();
          if (cust) {
            const newBal = cust.creditBalance - remainingToRefund;
            app.db
              .update(customers)
              .set({ creditBalance: newBal })
              .where(eq(customers.id, sale.customerId))
              .run();
          }
        }

        if (
          sale.paymentType === 'cash' &&
          sale.paymentMethod === 'cash' &&
          remainingToRefund > 0
        ) {
          app.db
            .insert(cashMovements)
            .values({
              shiftId: activeShift.id,
              type: 'refund',
              amount: -remainingToRefund,
              referenceId: sale.invoiceNumber,
              userId: actorId,
              createdAt: now,
            })
            .run();
        }

        // Log audit
        app.db
          .insert(auditLogs)
          .values({
            userId: actorId,
            action: 'cancel_sale',
            details: `إلغاء فاتورة مبيعات ${sale.invoiceNumber} بقيمة مرتجعة ${sale.total} د.ل`,
            createdAt: now,
          })
          .run();

        return { success: true, status: 'cancelled' };
      })();

      return result;
    } catch (err: any) {
      if (err.message === 'sale_not_found') {
        return reply.code(404).send({ error: 'sale_not_found', message: 'الفاتورة غير موجودة' });
      }
      if (err.message === 'already_cancelled') {
        return reply
          .code(400)
          .send({ error: 'already_cancelled', message: 'الفاتورة ملغاة بالفعل' });
      }
      throw err;
    }
  });

  // Partial customer sale return (مرتجع مبيعات): unlike /cancel, this reverses
  // only specific lines, after the day of sale, without touching the rest of
  // the invoice. Never edits the original sale — a reversing document.
  app.get('/sales/:id/returns', async (req, reply) => {
    const saleId = Number((req.params as { id: string }).id);
    const sale = app.db.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) return reply.code(404).send({ error: 'sale_not_found', message: 'الفاتورة غير موجودة' });

    const returns = app.db.select().from(saleReturns).where(eq(saleReturns.saleId, saleId)).all();
    const withItems = returns.map((r) => ({
      ...r,
      items: app.db
        .select()
        .from(saleReturnItems)
        .where(eq(saleReturnItems.saleReturnId, r.id))
        .all(),
    }));
    return withItems;
  });

  app.post('/sales/:id/return', async (req, reply) => {
    const saleId = Number((req.params as { id: string }).id);
    const { overridePin } = req.body as { overridePin?: string };

    let overrideUser: any = null;
    if (overridePin) {
      const v = verifyManagerPin(app.db, overridePin, req.ip);
      if (!v.success || !v.user) {
        return reply
          .code(400)
          .send({ error: 'invalid_override_pin', message: 'رمز PIN الخاص بالمدير غير صحيح' });
      }
      overrideUser = v.user;
    }

    if (req.user!.role !== 'manager' && !overrideUser) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'مرتجع المبيعات يتطلب صلاحية مدير أو إدخال رمز PIN للمدير',
      });
    }

    const body = req.body as {
      items?: Array<{ saleItemId: number; quantity: number }>;
    };
    if (!body.items || body.items.length === 0) {
      return reply
        .code(400)
        .send({ error: 'missing_items', message: 'حدد الأصناف والكميات المرتجعة' });
    }

    try {
      for (const item of body.items) {
        requirePositiveInt(item.saleItemId, 'saleItemId');
        requirePositiveInt(item.quantity, 'quantity');
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const sale = app.db.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) {
      return reply.code(404).send({ error: 'sale_not_found', message: 'الفاتورة غير موجودة' });
    }
    if (sale.status === 'cancelled') {
      return reply
        .code(400)
        .send({ error: 'sale_cancelled', message: 'الفاتورة ملغاة بالكامل بالفعل — لا يمكن إرجاع أصناف منها' });
    }

    const needsCashDrawer = sale.paymentType === 'cash' && sale.paymentMethod === 'cash';
    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (needsCashDrawer && !activeShift) {
      return reply
        .code(400)
        .send({ error: 'no_active_shift', message: 'يجب فتح توكة أولاً لإجراء عملية الإرجاع النقدي' });
    }

    try {
      const result = app.sqlite.transaction(() => {
        const now = new Date().toISOString();
        const actorId = overrideUser ? overrideUser.id : req.user!.userId;

        // subtotal reconstructed from the immutable invoice total (never
        // recomputed from current prices): total = subtotal + tax - discount.
        const subtotal = sale.total - sale.taxAmount + sale.discount;

        let returnValue = 0;
        const returnedLines: Array<{ saleItemId: number; productId: number; quantity: number }> = [];

        for (const item of body.items!) {
          const line = app.db.select().from(saleItems).where(eq(saleItems.id, item.saleItemId)).get();
          if (!line || line.saleId !== saleId) {
            throw new Error(`item_not_in_sale:${item.saleItemId}`);
          }
          const returnable = line.quantity - line.returnedQuantity;
          if (item.quantity > returnable) {
            throw new Error(`over_return:${line.productId}:${returnable}`);
          }

          const components = app.db
            .select()
            .from(productComponents)
            .where(eq(productComponents.productId, line.productId))
            .all();
          const isBundle = components.length > 0;

          if (isBundle) {
            for (const comp of components) {
              const compProduct = app.db
                .select()
                .from(products)
                .where(eq(products.id, comp.componentProductId))
                .get();
              if (!compProduct) continue;
              const restoreQty = comp.quantity * item.quantity;
              const newQty = compProduct.quantity + restoreQty;
              app.db
                .update(products)
                .set({ quantity: newQty })
                .where(eq(products.id, comp.componentProductId))
                .run();
              app.db
                .insert(stockMovements)
                .values({
                  productId: comp.componentProductId,
                  type: 'return',
                  quantity: restoreQty,
                  balanceAfter: newQty,
                  reason: `مرتجع مبيعات فاتورة رقم ${sale.invoiceNumber} (ضمن باقة)`,
                  userId: actorId,
                  createdAt: now,
                })
                .run();
            }
          } else {
            const product = app.db.select().from(products).where(eq(products.id, line.productId)).get();
            if (!product) throw new Error(`item_not_in_sale:${item.saleItemId}`);
            const restoreBaseQty = item.quantity * line.conversionFactor;
            const newQty = product.quantity + restoreBaseQty;
            app.db.update(products).set({ quantity: newQty }).where(eq(products.id, product.id)).run();
            app.db
              .insert(stockMovements)
              .values({
                productId: product.id,
                type: 'return',
                quantity: restoreBaseQty,
                balanceAfter: newQty,
                reason: `مرتجع مبيعات فاتورة رقم ${sale.invoiceNumber}`,
                userId: actorId,
                createdAt: now,
              })
              .run();
          }

          app.db
            .update(saleItems)
            .set({ returnedQuantity: line.returnedQuantity + item.quantity })
            .where(eq(saleItems.id, line.id))
            .run();

          const grossReturned = lineTotal(line.unitPrice, item.quantity);
          returnValue += subtotal > 0 ? Math.round((grossReturned / subtotal) * sale.total) : 0;
          returnedLines.push({ saleItemId: line.id, productId: line.productId, quantity: item.quantity });
        }

        // Refund method is derived from how the sale was originally paid —
        // never a free choice, so the reversal always matches reality.
        let refundMethod: 'cash' | 'debt' | 'none' = 'none';
        if (needsCashDrawer) {
          refundMethod = 'cash';
          app.db
            .insert(cashMovements)
            .values({
              shiftId: activeShift!.id,
              type: 'refund',
              amount: -returnValue,
              referenceId: `مرتجع مبيعات ${sale.invoiceNumber}`,
              userId: actorId,
              createdAt: now,
            })
            .run();
        } else if (sale.paymentType === 'credit' && sale.customerId) {
          refundMethod = 'debt';
          const cust = app.db.select().from(customers).where(eq(customers.id, sale.customerId)).get();
          if (cust) {
            app.db
              .update(customers)
              .set({ creditBalance: cust.creditBalance - returnValue })
              .where(eq(customers.id, sale.customerId))
              .run();
          }
        }

        // Gap-free sequential return numbers, same max+1-within-year pattern as invoices.
        const currentYear = new Date().getFullYear();
        const yearPrefix = `RET-${currentYear}-`;
        const matchingReturns = app.db
          .select({ returnNumber: saleReturns.returnNumber })
          .from(saleReturns)
          .where(like(saleReturns.returnNumber, `${yearPrefix}%`))
          .all();
        let maxNum = 0;
        for (const r of matchingReturns) {
          const num = parseInt(r.returnNumber.slice(yearPrefix.length), 10);
          if (Number.isFinite(num) && num > maxNum) maxNum = num;
        }
        const returnNumber = `${yearPrefix}${String(maxNum + 1).padStart(5, '0')}`;

        const returnResult = app.db
          .insert(saleReturns)
          .values({
            returnNumber,
            saleId,
            customerId: sale.customerId,
            amount: returnValue,
            refundMethod,
            userId: actorId,
            createdAt: now,
          })
          .run();
        const saleReturnId = Number(returnResult.lastInsertRowid);

        for (const line of returnedLines) {
          app.db
            .insert(saleReturnItems)
            .values({
              saleReturnId,
              saleItemId: line.saleItemId,
              productId: line.productId,
              quantity: line.quantity,
            })
            .run();
        }

        app.db
          .insert(auditLogs)
          .values({
            userId: actorId,
            action: 'sale_return',
            details: `مرتجع مبيعات ${returnNumber} على الفاتورة ${sale.invoiceNumber} بقيمة ${(returnValue / 1000).toFixed(3)} د.ل (${refundMethod === 'cash' ? 'استرداد نقدي للدرج' : refundMethod === 'debt' ? 'خصم من رصيد العميل' : 'بدون تسوية نقدية'})`,
            createdAt: now,
          })
          .run();

        return { success: true, returnNumber, returnValue, refundMethod };
      })();

      return result;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.startsWith('item_not_in_sale:')) {
        return reply.code(400).send({
          error: 'item_not_in_sale',
          message: 'أحد الأصناف غير موجود في الفاتورة الأصلية',
        });
      }
      if (msg.startsWith('over_return:')) {
        const [, , returnable] = msg.split(':');
        return reply.code(400).send({
          error: 'over_return',
          message: `الكمية المرتجعة لأحد الأصناف تتجاوز المتاح للإرجاع (${returnable})`,
        });
      }
      throw err;
    }
  });
}
