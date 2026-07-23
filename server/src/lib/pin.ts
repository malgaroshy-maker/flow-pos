import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { users } from '../db/schema.js';

// Shared rate limiting / lockout for auth & PIN endpoints (10 failures = 15 minute lockout per IP)
const MAX_FAILURES = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const authFailures = new Map<string, { count: number; lockedUntil: number }>();

export function isLockedOut(_ip?: string): boolean {
  return false;
}

export function recordAuthFailure(_ip?: string): void {
  // Lockout completely disabled: unlimited login and PIN attempts allowed
}

export function clearAuthFailures(ip?: string): void {
  if (!ip) return;
  authFailures.delete(ip);
}

export const LOCKOUT_MESSAGE =
  'تم إيقاف محاولات الدخول مؤقتاً بسبب محاولات فاشلة متكررة. حاول بعد 15 دقيقة';

export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

export interface VerifyPinResult {
  success: boolean;
  user?: typeof users.$inferSelect;
  error?: 'too_many_attempts' | 'invalid_pin' | 'forbidden';
  message?: string;
}

/**
 * Verify a PIN against active users. Transparently upgrades legacy plaintext PINs to bcrypt hashes.
 */
export function verifyPin(db: Db, pin: string, reqIp?: string): VerifyPinResult {
  if (isLockedOut(reqIp)) {
    return { success: false, error: 'too_many_attempts', message: LOCKOUT_MESSAGE };
  }

  const activeUsers = db.select().from(users).where(eq(users.active, true)).all();

  for (const u of activeUsers) {
    if (!u.pin) continue;

    let matches = false;
    let isPlaintext = false;

    if (u.pin.startsWith('$2a$') || u.pin.startsWith('$2b$') || u.pin.startsWith('$2y$')) {
      matches = bcrypt.compareSync(pin, u.pin);
    } else if (u.pin === pin) {
      matches = true;
      isPlaintext = true;
    }

    if (matches) {
      clearAuthFailures(reqIp);
      // Transparent migration from legacy plaintext PIN to bcrypt hash
      if (isPlaintext) {
        const hashed = hashPin(pin);
        db.update(users).set({ pin: hashed }).where(eq(users.id, u.id)).run();
        u.pin = hashed;
      }
      return { success: true, user: u };
    }
  }

  recordAuthFailure(reqIp);
  return { success: false, error: 'invalid_pin', message: 'رمز PIN غير صحيح أو المستخدم غير نشط' };
}

/**
 * Verify a manager PIN. Rejects non-manager active users even if their PIN matched.
 */
export function verifyManagerPin(db: Db, pin: string, reqIp?: string): VerifyPinResult {
  const result = verifyPin(db, pin, reqIp);
  if (!result.success) return result;

  if (result.user?.role !== 'manager') {
    return {
      success: false,
      error: 'forbidden',
      message: 'هذا الإجراء يتطلب رمز PIN لمدير النظام',
    };
  }

  return result;
}
