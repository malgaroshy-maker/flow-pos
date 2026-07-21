import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Money rule: all amounts are stored as integer milli-LYD (value × 1000).
// Tax rate is stored in basis points ×10 (per-mille of a percent avoided):
// tax_rate_permille = 13 means 1.3%. Never floats.

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  businessName: text('business_name').notNull().default('اسم النشاط التجاري'),
  businessSubtitle: text('business_subtitle'),
  businessPhone: text('business_phone'),
  businessPhone2: text('business_phone2'),
  businessAddress: text('business_address'),
  warrantyTerms: text('warranty_terms'),
  stampTitle: text('stamp_title'),
  logoPath: text('logo_path'),
  taxEnabled: integer('tax_enabled', { mode: 'boolean' }).notNull().default(false),
  taxRatePermille: integer('tax_rate_permille').notNull().default(0),
  // Max discount % of subtotal the sales role may apply without a manager PIN.
  discountCapPercent: integer('discount_cap_percent').notNull().default(10),
  // Minutes of inactivity before the UI locks to the PIN screen; 0 = disabled.
  idleLockMinutes: integer('idle_lock_minutes').notNull().default(5),
  currency: text('currency').notNull().default('LYD'),
  themeDefault: text('theme_default', { enum: ['light', 'dark'] })
    .notNull()
    .default('light'),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  pin: text('pin'), // 4-digit PIN for quick switch
  role: text('role', { enum: ['manager', 'sales'] })
    .notNull()
    .default('sales'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['equipment', 'consumable'] }).notNull(),
  category: text('category').notNull(),
  baseUnit: text('base_unit').notNull().default('piece'),
  imageUrl: text('image_url'),
  barcode: text('barcode'),
  costPrice: integer('cost_price').notNull().default(0), // in milli-LYD
  retailPrice: integer('retail_price').notNull().default(0), // in milli-LYD
  wholesalePrice: integer('wholesale_price').notNull().default(0), // in milli-LYD
  quantity: integer('quantity').notNull().default(0), // in baseUnit
  reorderPoint: integer('reorder_point').notNull().default(0),
  // Equipment-specific fields
  serialNumber: text('serial_number'),
  warrantyMonths: integer('warranty_months'),
  // Consumable-specific fields
  batchNo: text('batch_no'),
  expiryDate: text('expiry_date'),
  // Exempt from sales tax even when the tax engine is enabled
  taxExempt: integer('tax_exempt', { mode: 'boolean' }).notNull().default(false),
  // Units held by customer deposits — available stock = quantity - reserved.
  reservedQuantity: integer('reserved_quantity').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

// Setup bundles: a product with components sells at its own price and deducts
// every component's stock; the parent's own quantity is never used.
export const productComponents = sqliteTable('product_components', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id), // the bundle parent
  componentProductId: integer('component_product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(), // base units of the component per bundle
});

// Optional packaging units per product (multi-unit is opt-in). Stock is always
// tracked in the base unit; selling one packaging unit deducts
// conversion_factor base units. Each unit carries its own price.
export const productUnits = sqliteTable('product_units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  unitName: text('unit_name').notNull(), // e.g. "كرتونة"
  conversionFactor: integer('conversion_factor').notNull(), // base units per this unit (> 1)
  price: integer('price').notNull(), // milli-LYD per this unit
  createdAt: text('created_at').notNull(),
});

export const stockMovements = sqliteTable('stock_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  type: text('type', {
    enum: ['sale', 'purchase', 'adjustment', 'return', 'supplier_return'],
  }).notNull(),
  quantity: integer('quantity').notNull(), // negative for reduction, positive for addition
  balanceAfter: integer('balance_after').notNull(),
  reason: text('reason'),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const shifts = sqliteTable('shifts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  openedByUserId: integer('opened_by_user_id')
    .notNull()
    .references(() => users.id),
  closedByUserId: integer('closed_by_user_id').references(() => users.id),
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at'),
  openingCash: integer('opening_cash').notNull().default(0), // milli-LYD
  expectedCash: integer('expected_cash').notNull().default(0), // milli-LYD
  actualCash: integer('actual_cash'), // milli-LYD
  variance: integer('variance'), // milli-LYD
  status: text('status', { enum: ['open', 'closed'] })
    .notNull()
    .default('open'),
});

export const cashMovements = sqliteTable('cash_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id),
  type: text('type', { enum: ['sale', 'expense', 'withdrawal', 'deposit', 'refund'] }).notNull(),
  amount: integer('amount').notNull(), // positive for cash in, negative for cash out (milli-LYD)
  referenceId: text('reference_id'), // e.g. sale invoiceNumber or expense id
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id),
  amount: integer('amount').notNull(), // milli-LYD
  reason: text('reason').notNull(),
  category: text('category').notNull(), // e.g. supplies, cleaning, maintenance, other
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
});

// ── Phase 2 tables (customers, suppliers, purchases) ──────────────────────────

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  // Pricing tier: wholesale customers get the product's wholesale price by default.
  tier: text('tier', { enum: ['retail', 'wholesale'] })
    .notNull()
    .default('retail'),
  // Max open credit in milli-LYD; 0 = unlimited. Exceeding it blocks the
  // credit sale unless a manager (or PIN) overrides.
  creditLimit: integer('credit_limit').notNull().default(0),
  creditBalance: integer('credit_balance').notNull().default(0), // milli-LYD owed to us
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// Per-customer special prices — highest pricing precedence:
// special price → customer tier → product default (docs/prd.md).
export const customerSpecialPrices = sqliteTable(
  'customer_special_prices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    price: integer('price').notNull(), // milli-LYD
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('csp_customer_product_unique').on(t.customerId, t.productId)],
);

export const customerPayments = sqliteTable('customer_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  shiftId: integer('shift_id').references(() => shifts.id),
  amount: integer('amount').notNull(), // milli-LYD
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  debtBalance: integer('debt_balance').notNull().default(0), // milli-LYD we owe them
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const supplierPayments = sqliteTable('supplier_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  shiftId: integer('shift_id').references(() => shifts.id),
  amount: integer('amount').notNull(), // milli-LYD
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceNumber: text('invoice_number').notNull().unique(), // INV-YYYY-NNNNN
  customerId: integer('customer_id').references(() => customers.id),
  customerName: text('customer_name'), // snapshot
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id),
  paymentType: text('payment_type', { enum: ['cash', 'credit'] })
    .notNull()
    .default('cash'),
  paymentMethod: text('payment_method', { enum: ['cash', 'card', 'transfer'] })
    .notNull()
    .default('cash'),
  taxAmount: integer('tax_amount').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  qrRef: text('qr_ref'),
  total: integer('total').notNull(), // net total (subtotal + tax - discount) in milli-LYD
  status: text('status', { enum: ['completed', 'cancelled'] })
    .notNull()
    .default('completed'),
  createdAt: text('created_at').notNull(),
});

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(), // in the sold unit (below), not base units
  // Snapshot of the sold unit: base unit ⇒ null name, factor 1.
  unitName: text('unit_name'),
  conversionFactor: integer('conversion_factor').notNull().default(1),
  unitPrice: integer('unit_price').notNull(), // milli-LYD per sold unit
  total: integer('total').notNull(), // milli-LYD
  serialNumber: text('serial_number'),
  returnedQuantity: integer('returned_quantity').notNull().default(0), // partial sale returns against this line
});

// Partial customer sale returns (after the day of sale, unlike full cancellation):
// restores stock per line, refunds cash from the current shift for cash sales or
// reduces the customer's credit balance for credit sales. Never edits the original
// sale — a reversing document, same principle as supplier returns.
export const saleReturns = sqliteTable('sale_returns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  returnNumber: text('return_number').notNull().unique(), // RET-YYYY-NNNNN
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id),
  customerId: integer('customer_id').references(() => customers.id),
  amount: integer('amount').notNull(), // milli-LYD refunded/credited, proportional to the invoice total
  refundMethod: text('refund_method', { enum: ['cash', 'debt', 'none'] }).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const saleReturnItems = sqliteTable('sale_return_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleReturnId: integer('sale_return_id')
    .notNull()
    .references(() => saleReturns.id),
  saleItemId: integer('sale_item_id')
    .notNull()
    .references(() => saleItems.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(), // in the sold unit, same as the sale item
});

export const purchases = sqliteTable('purchases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceNumber: text('invoice_number').notNull().unique(), // PUR-YYYY-NNNNN
  supplierId: integer('supplier_id').references(() => suppliers.id),
  supplierName: text('supplier_name'), // snapshot
  total: integer('total').notNull().default(0), // milli-LYD
  paid: integer('paid').notNull().default(0), // milli-LYD
  status: text('status', { enum: ['pending', 'partial', 'paid'] })
    .notNull()
    .default('pending'),
  notes: text('notes'),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const purchaseItems = sqliteTable('purchase_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchaseId: integer('purchase_id')
    .notNull()
    .references(() => purchases.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  productName: text('product_name').notNull(), // snapshot
  quantity: integer('quantity').notNull(),
  returnedQuantity: integer('returned_quantity').notNull().default(0), // supplier returns against this line
  unitCost: integer('unit_cost').notNull(), // milli-LYD
  total: integer('total').notNull(), // milli-LYD
});

export const supplierReturns = sqliteTable('supplier_returns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchaseId: integer('purchase_id')
    .notNull()
    .references(() => purchases.id),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  amount: integer('amount').notNull(), // milli-LYD
  refundMethod: text('refund_method', { enum: ['debt', 'cash'] }).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
});

// Quotations never touch stock or cash; converting one applies all normal
// sale side-effects atomically (POST /sales with quotationId).
export const quotations = sqliteTable('quotations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quoteNumber: text('quote_number').notNull().unique(), // QUO-YYYY-NNNNN
  customerId: integer('customer_id').references(() => customers.id),
  customerName: text('customer_name'), // snapshot
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  validUntil: text('valid_until').notNull(), // ISO date; past this the quote expires
  status: text('status', { enum: ['active', 'converted', 'expired', 'cancelled'] })
    .notNull()
    .default('active'),
  discount: integer('discount').notNull().default(0), // milli-LYD
  taxAmount: integer('tax_amount').notNull().default(0), // milli-LYD
  total: integer('total').notNull(), // milli-LYD
  convertedSaleId: integer('converted_sale_id').references(() => sales.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const quotationItems = sqliteTable('quotation_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quotationId: integer('quotation_id')
    .notNull()
    .references(() => quotations.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  productName: text('product_name').notNull(), // snapshot
  quantity: integer('quantity').notNull(), // in the quoted unit
  unitId: integer('unit_id').references(() => productUnits.id), // null = base unit
  unitName: text('unit_name'),
  conversionFactor: integer('conversion_factor').notNull().default(1),
  unitPrice: integer('unit_price').notNull(), // milli-LYD per quoted unit
  total: integer('total').notNull(), // milli-LYD
});

// Customer deposits (عربون): cash held against a future invoice, optionally
// reserving one unit of a product. held → applied/refunded/forfeited.
export const deposits = sqliteTable('deposits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  productId: integer('product_id').references(() => products.id), // reserved equipment
  amount: integer('amount').notNull(), // milli-LYD
  status: text('status', { enum: ['held', 'applied', 'refunded', 'forfeited'] })
    .notNull()
    .default('held'),
  saleId: integer('sale_id').references(() => sales.id), // set when applied
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: text('created_at').notNull(),
});

export const stocktakeSessions = sqliteTable('stocktake_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  status: text('status', { enum: ['open', 'closed', 'applied'] })
    .notNull()
    .default('open'),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  username: text('username').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  closedAt: text('closed_at'),
  appliedAt: text('applied_at'),
});

export const stocktakeItems = sqliteTable('stocktake_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => stocktakeSessions.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  productName: text('product_name').notNull(),
  barcode: text('barcode'),
  expectedQty: integer('expected_qty').notNull(),
  countedQty: integer('counted_qty').notNull(),
  variance: integer('variance').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const warranties = sqliteTable('warranties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleItemId: integer('sale_item_id').references(() => saleItems.id),
  saleId: integer('sale_id').references(() => sales.id),
  serialNumber: text('serial_number').notNull(),
  productName: text('product_name').notNull(),
  startDate: text('start_date').notNull(),
  months: integer('months').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').notNull(),
});

export const serviceTickets = sqliteTable('service_tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticketNumber: text('ticket_number').notNull().unique(), // SRV-YYYY-NNNNN
  warrantyId: integer('warranty_id').references(() => warranties.id),
  serialNumber: text('serial_number').notNull(),
  productName: text('product_name').notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  faultDescription: text('fault_description').notNull(),
  diagnosis: text('diagnosis'),
  parts: text('parts'),
  inWarranty: integer('in_warranty', { mode: 'boolean' }).notNull().default(true),
  laborCost: integer('labor_cost').notNull().default(0), // milli-LYD
  partsCost: integer('parts_cost').notNull().default(0), // milli-LYD
  totalCost: integer('total_cost').notNull().default(0), // milli-LYD
  status: text('status', { enum: ['open', 'repairing', 'done', 'delivered'] })
    .notNull()
    .default('open'),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});


