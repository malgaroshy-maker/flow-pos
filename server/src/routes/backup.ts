import type { FastifyInstance } from 'fastify';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openDatabase, resolveDbPath } from '../db/index.js';
import { authenticateRequest, requireManager } from './auth.js';
import { auditLogs } from '../db/schema.js';

export async function backupRoutes(app: FastifyInstance) {
  // Apply authentication
  app.addHook('preHandler', authenticateRequest);

  // Trigger manual backup (manager only)
  app.post('/backup', { preHandler: requireManager }, async (req, reply) => {
    const dbPath = resolveDbPath();
    if (dbPath === ':memory:') {
      return reply.code(400).send({
        error: 'in_memory_db',
        message: 'لا يمكن عمل نسخة احتياطية لقاعدة بيانات في الذاكرة',
      });
    }

    const backupDir = join(dirname(dbPath), 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');

    const backupFile = `pos_backup_${timestamp}.db`;
    const destPath = join(backupDir, backupFile);

    try {
      // better-sqlite3 native safe online backup
      await app.sqlite.backup(destPath);

      // Log in audit log
      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'backup_database',
          details: `نسخ احتياطي يدوي لقاعدة البيانات إلى ${backupFile}`,
          createdAt: new Date().toISOString(),
        })
        .run();

      return { success: true, filename: backupFile };
    } catch (err: any) {
      app.log.error(err);
      return reply
        .code(500)
        .send({ error: 'backup_failed', message: 'فشل إنشاء النسخة الاحتياطية' });
    }
  });

  // Get list of available backups (manager only)
  app.get('/backup/list', { preHandler: requireManager }, async (req, reply) => {
    const dbPath = resolveDbPath();
    if (dbPath === ':memory:') {
      return [];
    }

    const backupDir = join(dirname(dbPath), 'backups');
    if (!existsSync(backupDir)) {
      return [];
    }

    try {
      const files = readdirSync(backupDir)
        .filter((file) => file.startsWith('pos_backup_') && file.endsWith('.db'))
        .sort()
        .reverse(); // Newest first

      return files.map((file) => ({
        filename: file,
        createdAt: file
          .replace('pos_backup_', '')
          .replace('.db', '')
          .replace(/_/g, ' ')
          .replace(/-/g, ':'),
      }));
    } catch (err) {
      return [];
    }
  });

  // Restore database (manager only)
  app.post('/backup/restore', { preHandler: requireManager }, async (req, reply) => {
    const { filename } = req.body as { filename?: string };
    if (!filename) {
      return reply
        .code(400)
        .send({ error: 'missing_fields', message: 'اسم ملف النسخة الاحتياطية مطلوب' });
    }

    // Only bare backup filenames — no path separators or traversal.
    if (!/^pos_backup_[\w.-]+\.db$/.test(filename)) {
      return reply
        .code(400)
        .send({ error: 'invalid_filename', message: 'اسم ملف النسخة الاحتياطية غير صالح' });
    }

    const dbPath = resolveDbPath();
    if (dbPath === ':memory:') {
      return reply
        .code(400)
        .send({ error: 'in_memory_db', message: 'لا يمكن عمل استرجاع لقاعدة بيانات في الذاكرة' });
    }

    const backupFile = join(dirname(dbPath), 'backups', filename);
    if (!existsSync(backupFile)) {
      return reply
        .code(404)
        .send({ error: 'backup_not_found', message: 'ملف النسخة الاحتياطية غير موجود' });
    }

    try {
      // Close the current DB instance
      app.sqlite.close();

      // Copy the backup file to the main database file path
      const restoreSqlite = openDatabase(backupFile);
      // Online backup back into the main file path
      await restoreSqlite.backup(dbPath);
      restoreSqlite.close();

      // Swap the shared connection holder so every route context sees the
      // reopened database (a plain property reassignment would only shadow it
      // in this plugin's encapsulated context, leaving others on the closed handle).
      app.swapDatabase(openDatabase(dbPath));

      app.db
        .insert(auditLogs)
        .values({
          userId: req.user!.userId,
          action: 'restore_database',
          details: `استرجاع قاعدة البيانات من النسخة الاحتياطية ${filename}`,
          createdAt: new Date().toISOString(),
        })
        .run();

      return { success: true };
    } catch (err: any) {
      app.log.error(err);
      return reply
        .code(500)
        .send({ error: 'restore_failed', message: 'فشل استرجاع قاعدة البيانات' });
    }
  });
}
