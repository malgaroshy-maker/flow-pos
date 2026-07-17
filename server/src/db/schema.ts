import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Money rule: all amounts are stored as integer milli-LYD (value × 1000).
// Tax rate is stored in basis points ×10 (per-mille of a percent avoided):
// tax_rate_permille = 13 means 1.3%. Never floats.

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  businessName: text('business_name').notNull().default('اسم النشاط التجاري'),
  businessPhone: text('business_phone'),
  businessAddress: text('business_address'),
  logoPath: text('logo_path'),
  taxEnabled: integer('tax_enabled', { mode: 'boolean' }).notNull().default(false),
  taxRatePermille: integer('tax_rate_permille').notNull().default(0),
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

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceNumber: text('invoice_number').notNull().unique(), // INV-YYYY-NNNNN
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  shiftId: integer('shift_id')
    .notNull()
    .references(() => shifts.id),
  paymentType: text('payment_type', { enum: ['cash', 'credit'] })
    .notNull()
    .default('cash'),
  paymentMethod: text('payment_method', { enum: ['cash', 'card'] })
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
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(), // milli-LYD
  total: integer('total').notNull(), // milli-LYD
});

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: text('created_at').notNull(),
});
