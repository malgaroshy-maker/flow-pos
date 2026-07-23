import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { Db } from '../db/index.js';
import { users, auditLogs, sessions as sessionsTable } from '../db/schema.js';

export interface UserSession {
  userId: number;
  username: string;
  role: 'manager' | 'sales';
  expiresAt: number; // epoch ms; refreshed on each authenticated request
}

// Sessions idle out after 12 hours without a request (shop runs one shift a day).
const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;

// In-memory session store (hot path — every authenticated request reads
// this, never the DB). Persisted to the `sessions` table so cashier devices
// survive a desktop-app restart mid-shift instead of every device silently
// logging out; loadPersistedSessions() rehydrates this map at boot.
export const sessions = new Map<string, UserSession>();

function createSession(
  db: Db,
  user: { id: number; username: string; role: 'manager' | 'sales' }
): {
  token: string;
  session: UserSession;
} {
  const token = randomBytes(32).toString('hex');
  const session: UserSession = {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + SESSION_IDLE_MS,
  };
  sessions.set(token, session);
  db.insert(sessionsTable)
    .values({
      token,
      userId: session.userId,
      username: session.username,
      role: session.role,
      expiresAt: session.expiresAt,
    })
    .run();
  return { token, session };
}

/**
 * Rehydrates the in-memory session map from disk at boot — called once from
 * index.ts (never from buildApp(), so the ~20 test files that build an app
 * per test are unaffected and always start with a clean session map).
 * Expired rows are dropped here rather than carried forward.
 */
export function loadPersistedSessions(db: Db): void {
  const now = Date.now();
  db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, now)).run();
  const rows = db.select().from(sessionsTable).all();
  for (const row of rows) {
    sessions.set(row.token, {
      userId: row.userId,
      username: row.username,
      role: row.role,
      expiresAt: row.expiresAt,
    });
  }
}

import {
  verifyPin,
  verifyManagerPin,
  isLockedOut,
  recordAuthFailure,
  clearAuthFailures,
  LOCKOUT_MESSAGE,
  hashPin,
} from '../lib/pin.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserSession;
  }
}

export async function authRoutes(app: FastifyInstance) {
  // Login with username and password
  app.post('/auth/login', async (req, reply) => {
    if (isLockedOut(req.ip)) {
      return reply.code(429).send({ error: 'too_many_attempts', message: LOCKOUT_MESSAGE });
    }

    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const user = app.db.select().from(users).where(eq(users.username, username)).get();
    if (!user || !user.active) {
      recordAuthFailure(req.ip);
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const matches = bcrypt.compareSync(password, user.passwordHash);
    if (!matches) {
      recordAuthFailure(req.ip);
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    clearAuthFailures(req.ip);
    const { token, session: sessionData } = createSession(app.db, user);

    // Audit log
    app.db
      .insert(auditLogs)
      .values({
        userId: user.id,
        action: 'login',
        details: `تسجيل الدخول للمستخدم ${user.username}`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { token, user: sessionData };
  });

  // Fast PIN switch (shared device workflow)
  app.post('/auth/pin-switch', async (req, reply) => {
    const { pin } = req.body as { pin?: string };
    if (!pin) {
      return reply.code(400).send({ error: 'missing_pin', message: 'رمز PIN مطلوب' });
    }

    const verification = verifyPin(app.db, pin, req.ip);
    if (!verification.success || !verification.user) {
      const statusCode = verification.error === 'too_many_attempts' ? 429 : 401;
      return reply.code(statusCode).send({ error: verification.error, message: verification.message });
    }

    const user = verification.user;
    const { token, session: sessionData } = createSession(app.db, user);

    // Audit log
    app.db
      .insert(auditLogs)
      .values({
        userId: user.id,
        action: 'pin_switch',
        details: `تبديل سريع للمستخدم ${user.username}`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { token, user: sessionData };
  });

  // Manager PIN override validation
  app.post('/auth/manager-override', async (req, reply) => {
    const { pin, reason } = req.body as { pin?: string; reason?: string };
    if (!pin) {
      return reply.code(400).send({ error: 'missing_pin', message: 'رمز PIN مطلوب للموافقة' });
    }

    const verification = verifyManagerPin(app.db, pin, req.ip);
    if (!verification.success || !verification.user) {
      const statusCode = verification.error === 'too_many_attempts' ? 429 : verification.error === 'forbidden' ? 403 : 401;
      return reply.code(statusCode).send({ error: verification.error, message: verification.message });
    }

    const user = verification.user;

    // Audit log of override
    app.db
      .insert(auditLogs)
      .values({
        userId: user.id,
        action: 'manager_override',
        details: `موافقة المدير ${user.username}: ${reason || 'بدون سبب محدد'}`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { success: true, managerName: user.username, managerId: user.id };
  });

  // Logout: invalidate the current session token
  app.post('/auth/logout', { preHandler: authenticateRequest }, async (req, reply) => {
    const authHeader = req.headers.authorization!;
    const token = authHeader.substring(7);
    sessions.delete(token);
    app.db.delete(sessionsTable).where(eq(sessionsTable.token, token)).run();
    return { success: true };
  });

  // Get active users for switching
  app.get('/users', { preHandler: authenticateRequest }, async (req, reply) => {
    const allUsers = app.db
      .select({ id: users.id, username: users.username, role: users.role, active: users.active })
      .from(users)
      .all();
    return allUsers;
  });

  // Create new user (manager only)
  app.post('/users', { preHandler: authenticateRequest }, async (req, reply) => {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'هذا الإجراء متاح للمدراء فقط' });
    }

    const { username, password, pin, role } = req.body as {
      username?: string;
      password?: string;
      pin?: string;
      role?: 'manager' | 'sales';
    };

    if (!username || !password || !role) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'اسم المستخدم وكلمة المرور والصلاحية مطلوبة' });
    }

    const existing = app.db.select().from(users).where(eq(users.username, username)).get();
    if (existing) {
      return reply.code(400).send({ error: 'username_taken', message: 'اسم المستخدم مسجل مسبقاً' });
    }

    if (pin) {
      const existingPin = app.db.select().from(users).where(eq(users.pin, pin)).get();
      if (existingPin) {
        return reply.code(400).send({ error: 'pin_taken', message: 'رمز PIN مستخدم بالفعل' });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    app.db
      .insert(users)
      .values({
        username,
        passwordHash: hash,
        pin: pin || null,
        role,
        active: true,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { success: true };
  });

  // Update user details (password, pin, role, active status) - manager only
  app.put('/users/:id', { preHandler: authenticateRequest }, async (req, reply) => {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'هذا الإجراء متاح للمدراء فقط' });
    }

    const { id } = req.params as { id: string };
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return reply.code(400).send({ error: 'invalid_id', message: 'معرف المستخدم غير صحيح' });
    }

    const { password, pin, role, active } = req.body as {
      password?: string;
      pin?: string;
      role?: 'manager' | 'sales';
      active?: boolean;
    };

    const targetUser = app.db.select().from(users).where(eq(users.id, userId)).get();
    if (!targetUser) {
      return reply.code(404).send({ error: 'user_not_found', message: 'المستخدم غير موجود' });
    }

    // Prepare updates
    const updates: any = {};

    if (password !== undefined && password.trim() !== '') {
      const salt = bcrypt.genSaltSync(10);
      updates.passwordHash = bcrypt.hashSync(password, salt);
    }

    if (pin !== undefined) {
      const trimmedPin = pin.trim() === '' ? null : pin.trim();
      if (trimmedPin) {
        // Check uniqueness of PIN (excluding targetUser itself)
        const pinInUse = app.db.select().from(users).where(eq(users.pin, trimmedPin)).get();
        if (pinInUse && pinInUse.id !== targetUser.id) {
          return reply
            .code(400)
            .send({ error: 'pin_taken', message: 'رمز PIN مستخدم بالفعل لمستخدم آخر' });
        }
      }
      updates.pin = trimmedPin;
    }

    if (role !== undefined) {
      updates.role = role;
    }

    if (active !== undefined) {
      // Prevent manager from deactivating themselves
      if (targetUser.id === currentUser.userId && !active) {
        return reply
          .code(400)
          .send({ error: 'cannot_deactivate_self', message: 'لا يمكنك إلغاء تنشيط حسابك الخاص' });
      }
      updates.active = active;
    }

    if (Object.keys(updates).length > 0) {
      app.db.update(users).set(updates).where(eq(users.id, targetUser.id)).run();

      // Audit log of update
      app.db
        .insert(auditLogs)
        .values({
          userId: currentUser.userId,
          action: 'update_user',
          details: `تحديث بيانات المستخدم ${targetUser.username}: ${Object.keys(updates).join(', ')}`,
          createdAt: new Date().toISOString(),
        })
        .run();
    }

    return { success: true };
  });
}

// Request authentication hook
export async function authenticateRequest(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'unauthorized', message: 'يجب تسجيل الدخول أولاً' });
  }

  const token = authHeader.substring(7);
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      sessions.delete(token);
      req.server.db.delete(sessionsTable).where(eq(sessionsTable.token, token)).run();
    }
    return reply.code(401).send({ error: 'unauthorized', message: 'انتهت صلاحية الجلسة' });
  }

  session.expiresAt = Date.now() + SESSION_IDLE_MS;
  req.user = session;
  // Keep the persisted copy's idle-expiry in sync so a desktop-app restart
  // mid-shift doesn't log the device out — WAL mode + local single-process
  // SQLite makes a write per request cheap at this app's request volume.
  req.server.db
    .update(sessionsTable)
    .set({ expiresAt: session.expiresAt })
    .where(eq(sessionsTable.token, token))
    .run();
}

import { hasPermission } from '../lib/permissions.js';

// Authentication + manager-role hook for manager-only routes
export async function requireManager(req: FastifyRequest, reply: FastifyReply) {
  await authenticateRequest(req, reply);
  if (reply.sent) return reply;
  if (!hasPermission(req.user?.role, 'MANAGE_SETTINGS')) {
    return reply.code(403).send({ error: 'forbidden', message: 'هذا الإجراء متاح للمدراء فقط' });
  }
}
