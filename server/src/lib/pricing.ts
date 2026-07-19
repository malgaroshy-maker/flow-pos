import { and, eq } from 'drizzle-orm';
import { customers, customerSpecialPrices } from '../db/schema.js';
import type { Db } from '../db/index.js';

/**
 * Resolve the authoritative unit price for a product and (optional) customer.
 * Precedence (docs/prd.md): customer special price → customer tier → product default.
 * A wholesale price of 0 means "not set" and falls through to retail.
 */
export function resolveUnitPrice(
  db: Db,
  customerId: number | null | undefined,
  product: { id: number; retailPrice: number; wholesalePrice: number },
): number {
  if (customerId) {
    const special = db
      .select()
      .from(customerSpecialPrices)
      .where(
        and(
          eq(customerSpecialPrices.customerId, customerId),
          eq(customerSpecialPrices.productId, product.id),
        ),
      )
      .get();
    if (special) return special.price;

    const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
    if (customer?.tier === 'wholesale' && product.wholesalePrice > 0) {
      return product.wholesalePrice;
    }
  }
  return product.retailPrice;
}
