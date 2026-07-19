import type { FastifyInstance } from 'fastify';
import { and, eq, desc } from 'drizzle-orm';
import {
  customers,
  customerSpecialPrices,
  products,
  sales,
  auditLogs,
  shifts,
  cashMovements,
  customerPayments,
} from '../db/schema.js';
import { authenticateRequest } from './auth.js';
import { requireNonNegativeInt, requirePositiveInt, ValidationError } from '../lib/validate.js';

const TIERS = ['retail', 'wholesale'] as const;
type Tier = (typeof TIERS)[number];

function parseTier(value: unknown): Tier | null {
  return TIERS.includes(value as Tier) ? (value as Tier) : null;
}

export async function customerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateRequest);

  // List all customers
  app.get('/customers', async (_req, _reply) => {
    return app.db.select().from(customers).orderBy(desc(customers.id)).all();
  });

  // Get single customer
  app.get('/customers/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const customer = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!customer) return reply.code(404).send({ error: 'not_found', message: 'العميل غير موجود' });
    return customer;
  });

  // Create customer (manager & sales)
  app.post('/customers', async (req, reply) => {
    const { name, phone, address, notes, tier, creditLimit } = req.body as any;
    if (!name)
      return reply.code(400).send({ error: 'missing_fields', message: 'اسم العميل مطلوب' });

    if (tier !== undefined && !parseTier(tier)) {
      return reply
        .code(400)
        .send({ error: 'invalid_tier', message: 'فئة التسعير يجب أن تكون تجزئة أو جملة' });
    }

    try {
      if (creditLimit !== undefined) requireNonNegativeInt(creditLimit, 'creditLimit');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const now = new Date().toISOString();
    const result = app.db
      .insert(customers)
      .values({
        name,
        phone: phone || null,
        address: address || null,
        tier: parseTier(tier) ?? 'retail',
        creditLimit: creditLimit ?? 0,
        notes: notes || null,
        createdAt: now,
      })
      .run();
    const newId = Number(result.lastInsertRowid);

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user!.userId,
        action: 'create_customer',
        details: `إضافة عميل: ${name}`,
        createdAt: now,
      })
      .run();

    const newCustomer = app.db.select().from(customers).where(eq(customers.id, newId)).get();
    return newCustomer;
  });

  // Update customer
  app.put('/customers/:id', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تعديل العملاء متاح للمدراء فقط' });
    }
    const id = Number((req.params as any).id);
    const existing = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!existing) return reply.code(404).send({ error: 'not_found' });

    const { name, phone, address, notes, tier, creditLimit } = req.body as any;
    if (tier !== undefined && !parseTier(tier)) {
      return reply
        .code(400)
        .send({ error: 'invalid_tier', message: 'فئة التسعير يجب أن تكون تجزئة أو جملة' });
    }

    try {
      if (creditLimit !== undefined) requireNonNegativeInt(creditLimit, 'creditLimit');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    app.db
      .update(customers)
      .set({
        name: name ?? existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        address: address !== undefined ? address : existing.address,
        tier: tier !== undefined ? parseTier(tier)! : existing.tier,
        creditLimit: creditLimit !== undefined ? creditLimit : existing.creditLimit,
        notes: notes !== undefined ? notes : existing.notes,
      })
      .where(eq(customers.id, id))
      .run();

    return { success: true };
  });

  // ── Special prices (highest pricing precedence) ─────────────────────────────

  // List a customer's special prices with product context
  app.get('/customers/:id/special-prices', async (req, reply) => {
    const id = Number((req.params as any).id);
    const customer = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!customer) return reply.code(404).send({ error: 'not_found', message: 'العميل غير موجود' });

    return app.db
      .select({
        id: customerSpecialPrices.id,
        productId: customerSpecialPrices.productId,
        price: customerSpecialPrices.price,
        createdAt: customerSpecialPrices.createdAt,
        productName: products.name,
        retailPrice: products.retailPrice,
        wholesalePrice: products.wholesalePrice,
      })
      .from(customerSpecialPrices)
      .leftJoin(products, eq(customerSpecialPrices.productId, products.id))
      .where(eq(customerSpecialPrices.customerId, id))
      .orderBy(desc(customerSpecialPrices.id))
      .all();
  });

  // Set/update a special price (manager only)
  app.put('/customers/:id/special-prices', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تحديد الأسعار الخاصة متاح للمدراء فقط' });
    }

    const id = Number((req.params as any).id);
    const { productId, price } = req.body as { productId?: number; price?: number };

    try {
      requirePositiveInt(productId, 'productId');
      requireNonNegativeInt(price, 'price');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const customer = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!customer) return reply.code(404).send({ error: 'not_found', message: 'العميل غير موجود' });

    const product = app.db.select().from(products).where(eq(products.id, productId!)).get();
    if (!product)
      return reply.code(404).send({ error: 'product_not_found', message: 'المنتج غير موجود' });

    const now = new Date().toISOString();
    const existing = app.db
      .select()
      .from(customerSpecialPrices)
      .where(
        and(
          eq(customerSpecialPrices.customerId, id),
          eq(customerSpecialPrices.productId, productId!),
        ),
      )
      .get();

    if (existing) {
      app.db
        .update(customerSpecialPrices)
        .set({ price: price! })
        .where(eq(customerSpecialPrices.id, existing.id))
        .run();
    } else {
      app.db
        .insert(customerSpecialPrices)
        .values({ customerId: id, productId: productId!, price: price!, createdAt: now })
        .run();
    }

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user!.userId,
        action: 'set_special_price',
        details: `سعر خاص للعميل ${customer.name} على ${product.name}: ${(price! / 1000).toFixed(3)} د.ل`,
        createdAt: now,
      })
      .run();

    return { success: true };
  });

  // Remove a special price (manager only)
  app.delete('/customers/:id/special-prices/:productId', async (req, reply) => {
    if (req.user?.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: 'تحديد الأسعار الخاصة متاح للمدراء فقط' });
    }

    const id = Number((req.params as any).id);
    const productId = Number((req.params as any).productId);

    app.db
      .delete(customerSpecialPrices)
      .where(
        and(
          eq(customerSpecialPrices.customerId, id),
          eq(customerSpecialPrices.productId, productId),
        ),
      )
      .run();

    app.db
      .insert(auditLogs)
      .values({
        userId: req.user!.userId,
        action: 'remove_special_price',
        details: `حذف سعر خاص للعميل ${id} على المنتج ${productId}`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { success: true };
  });

  // Record a payment from customer (reduce credit balance)
  const handleCustomerPayment = async (req: any, reply: any) => {
    const id = Number((req.params as any).id);
    const { amount, notes } = req.body as { amount: number; notes?: string };
    try {
      requirePositiveInt(amount, 'amount');
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    const customer = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!customer) return reply.code(404).send({ error: 'not_found' });

    // Cash entering the drawer must be tied to an open shift.
    const activeShift = app.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, 'open'))
      .limit(1)
      .get();

    if (!activeShift) {
      return reply.code(400).send({
        error: 'no_active_shift',
        message: 'استلام نقدية من العميل يتطلب توكة مفتوحة لتسجيلها في الدرج',
      });
    }

    if (amount > customer.creditBalance) {
      return reply.code(400).send({
        error: 'overpayment',
        message: `المبلغ المدفوع أكبر من الدين المستحق (${(customer.creditBalance / 1000).toFixed(3)} د.ل)`,
      });
    }

    const now = new Date().toISOString();
    const newBalance = app.sqlite.transaction(() => {
      const balance = customer.creditBalance - amount;
      app.db.update(customers).set({ creditBalance: balance }).where(eq(customers.id, id)).run();

      app.db
        .insert(customerPayments)
        .values({
          customerId: id,
          shiftId: activeShift.id,
          amount: amount,
          userId: req.user.userId,
          notes: notes || null,
          createdAt: now,
        })
        .run();

      app.db
        .insert(cashMovements)
        .values({
          shiftId: activeShift.id,
          type: 'deposit',
          amount: amount,
          referenceId: `سداد عميل ${customer.name}`,
          userId: req.user.userId,
          createdAt: now,
        })
        .run();

      app.db
        .insert(auditLogs)
        .values({
          userId: req.user.userId,
          action: 'customer_payment',
          details: `سداد عميل ${customer.name}: ${(amount / 1000).toFixed(3)} د.ل. الرصيد الجديد: ${(balance / 1000).toFixed(3)} د.ل`,
          createdAt: now,
        })
        .run();

      return balance;
    })();

    return { success: true, newCreditBalance: newBalance };
  };

  app.post('/customers/:id/payment', handleCustomerPayment);
  app.post('/customers/:id/payments', handleCustomerPayment);

  // Get customer's sales history
  app.get('/customers/:id/sales', async (req, _reply) => {
    const id = Number((req.params as any).id);
    return app.db
      .select()
      .from(sales)
      .where(eq(sales.customerId, id))
      .orderBy(desc(sales.id))
      .all();
  });

  // Get Customer Account Statement (كشف حساب التفصيلي للزبون)
  app.get('/customers/:id/statement', async (req, reply) => {
    const id = Number((req.params as any).id);
    const customer = app.db.select().from(customers).where(eq(customers.id, id)).get();
    if (!customer) return reply.code(404).send({ error: 'not_found', message: 'العميل غير موجود' });

    // Fetch all sales for this customer
    const customerSales = app.db.select().from(sales).where(eq(sales.customerId, id)).all();

    // Fetch payments recorded in customer_payments table
    const payments = app.db
      .select()
      .from(customerPayments)
      .where(eq(customerPayments.customerId, id))
      .all();

    // Combine transactions into single array
    const transactions: Array<{
      id: string;
      date: string;
      type: 'sale_credit' | 'sale_cash' | 'payment';
      typeLabel: string;
      reference: string;
      debit: number; // milli-LYD
      credit: number; // milli-LYD
      notes?: string;
    }> = [];

    customerSales.forEach((s) => {
      if (s.status === 'cancelled') return;
      const isCredit = s.paymentType === 'credit';
      transactions.push({
        id: `sale-${s.id}`,
        date: s.createdAt,
        type: isCredit ? 'sale_credit' : 'sale_cash',
        typeLabel: isCredit ? 'فاتورة مبيعات (آجل)' : 'فاتورة مبيعات (نقدي)',
        reference: s.invoiceNumber,
        debit: isCredit ? s.total : 0, // credit sales add to debt
        credit: 0,
        notes: `طريقة الدفع: ${s.paymentMethod}`,
      });
    });

    payments.forEach((p) => {
      transactions.push({
        id: `pay-${p.id}`,
        date: p.createdAt,
        type: 'payment',
        typeLabel: 'سداد دفعة نقدية (دفع)',
        reference: `REC-${p.id}`,
        debit: 0,
        credit: p.amount, // payment reduces debt
        notes: p.notes || 'سداد نقدي لحساب الدين',
      });
    });

    // Sort transactions chronologically
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance and totals
    let runningBalance = 0;
    let totalPurchases = 0;
    let totalPaid = 0;

    const statementRows = transactions.map((tx) => {
      totalPurchases += tx.debit;
      totalPaid += tx.credit;
      runningBalance += tx.debit - tx.credit;
      // Negative running balance is meaningful: it is credit we owe the customer.
      return {
        ...tx,
        runningBalance,
      };
    });

    return {
      customer,
      summary: {
        totalPurchases,
        totalPaid,
        currentBalance: customer.creditBalance,
        calculatedBalance: runningBalance,
      },
      statement: statementRows,
    };
  });
}
