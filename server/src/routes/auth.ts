import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { users, auditLogs } from '../db/schema.js';

export interface UserSession {
  userId: number;
  username: string;
  role: 'manager' | 'sales';
}

// In-memory session store (simple and offline-safe)
export const sessions = new Map<string, UserSession>();

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserSession;
  }
}

export async function authRoutes(app: FastifyInstance) {
  // Login with username and password
  app.post('/auth/login', async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const user = app.db.select().from(users).where(eq(users.username, username)).get();
    if (!user || !user.active) {
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const matches = bcrypt.compareSync(password, user.passwordHash);
    if (!matches) {
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const sessionData: UserSession = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    sessions.set(token, sessionData);

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

    const user = app.db.select().from(users).where(eq(users.pin, pin)).get();
    if (!user || !user.active) {
      return reply
        .code(401)
        .send({ error: 'invalid_pin', message: 'رمز PIN غير صحيح أو المستخدم غير نشط' });
    }

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const sessionData: UserSession = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    sessions.set(token, sessionData);

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

    const user = app.db.select().from(users).where(eq(users.pin, pin)).get();
    if (!user || !user.active) {
      return reply.code(401).send({ error: 'invalid_pin', message: 'رمز PIN غير صحيح' });
    }

    if (user.role !== 'manager') {
      return reply
        .code(403)
        .send({ error: 'not_authorized', message: 'الموافقة تتطلب صلاحية مدير' });
    }

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
  if (!session) {
    return reply.code(401).send({ error: 'unauthorized', message: 'انتهت صلاحية الجلسة' });
  }

  req.user = session;
}
