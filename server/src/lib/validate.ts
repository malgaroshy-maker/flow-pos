/**
 * Request-input validation helpers. Money amounts arrive as integer milli-LYD
 * and quantities as integers — anything else (floats, strings, NaN, negatives
 * where not allowed) is rejected before it can reach the database.
 */

export class ValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** A safe integer ≥ 0 (money amounts, opening cash, non-negative counters). */
export function requireNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(
      'invalid_' + field,
      `قيمة غير صالحة للحقل ${field}: يجب أن تكون عدداً صحيحاً غير سالب`,
    );
  }
  return value;
}

/** A safe integer ≥ 1 (quantities, payment amounts). */
export function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError(
      'invalid_' + field,
      `قيمة غير صالحة للحقل ${field}: يجب أن تكون عدداً صحيحاً موجباً`,
    );
  }
  return value;
}
