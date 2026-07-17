/**
 * Money = integer milli-LYD (amount × 1000). 3 decimal places, no floats, ever.
 * All arithmetic happens on these integers; formatting is display-only.
 */

export type Millis = number;

const FRACTION = 1000;

export function assertMillis(value: number): asserts value is Millis {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Money amount must be an integer of milli-LYD, got: ${value}`);
  }
}

/** Parse a user-entered decimal string ("12", "12.5", "12.505") into milli-LYD. */
export function parseLYD(input: string): Millis {
  const trimmed = input.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) throw new TypeError(`Not a valid LYD amount: "${input}"`);
  const [, sign, whole, fraction = ''] = match;
  const millis = Number(whole) * FRACTION + Number(fraction.padEnd(3, '0'));
  assertMillis(millis);
  return sign === '-' ? -millis : millis;
}

/** Format milli-LYD as "1,067.750" (Western digits, thousands separator, exactly 3 decimals). */
export function formatLYD(millis: Millis): string {
  assertMillis(millis);
  const sign = millis < 0 ? '-' : '';
  const abs = Math.abs(millis);
  const whole = Math.floor(abs / FRACTION)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % FRACTION).toString().padStart(3, '0');
  return `${sign}${whole}.${fraction}`;
}

/** Format with the currency suffix for display: "1,067.750 د.ل". */
export function formatLYDWithCurrency(millis: Millis): string {
  return `${formatLYD(millis)} د.ل`;
}

/** Multiply a unit price by a quantity (quantity may be fractional only via explicit permille). */
export function lineTotal(unitPriceMillis: Millis, quantity: number): Millis {
  assertMillis(unitPriceMillis);
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new TypeError(`Quantity must be a non-negative integer, got: ${quantity}`);
  }
  const total = unitPriceMillis * quantity;
  assertMillis(total);
  return total;
}

/**
 * Apply a permille rate (e.g. tax_rate_permille = 13 → 1.3%) to an amount.
 * Rounds half away from zero to the nearest milli-LYD.
 */
export function applyPermille(amountMillis: Millis, permille: number): Millis {
  assertMillis(amountMillis);
  if (!Number.isSafeInteger(permille)) {
    throw new TypeError(`Permille rate must be an integer, got: ${permille}`);
  }
  const product = amountMillis * permille;
  const rounded = Math.sign(product) * Math.round(Math.abs(product) / 1000);
  assertMillis(rounded);
  return rounded;
}
