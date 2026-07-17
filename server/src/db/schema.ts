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
