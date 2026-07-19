/**
 * Money = integer milli-LYD (amount × 1000). 3 decimal places, no floats, ever.
 * Mirror of server/src/lib/money.ts — parsing is done on the string so values
 * like "1.005" never round through floating point (1.005*1000 === 1004.999…).
 */

/**
 * Parse a user-entered decimal string ("12", "12.5", "12.505") into milli-LYD.
 * Returns null for anything that is not a valid non-negative amount.
 */
export function parseLYDInput(input: string): number | null {
  const trimmed = (input ?? '').trim();
  if (trimmed === '') return null;
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  const millis = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  return Number.isSafeInteger(millis) ? millis : null;
}

/** Like parseLYDInput but empty/invalid input becomes 0 (for optional fields). */
export function parseLYDOrZero(input: string): number {
  return parseLYDInput(input) ?? 0;
}

/** Format milli-LYD as "1,067.750" (Western digits, thousands separator, 3 decimals). */
export function formatLYD(millis: number): string {
  const sign = millis < 0 ? '-' : '';
  const abs = Math.abs(millis);
  const whole = Math.floor(abs / 1000)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % 1000).toString().padStart(3, '0');
  return `${sign}${whole}.${fraction}`;
}

/** Format milli-LYD as a plain input value ("12.500") without separators. */
export function millisToInput(millis: number): string {
  const sign = millis < 0 ? '-' : '';
  const abs = Math.abs(millis);
  return `${sign}${Math.floor(abs / 1000)}.${(abs % 1000).toString().padStart(3, '0')}`;
}
