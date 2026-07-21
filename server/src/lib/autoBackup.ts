import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';
import { resolveDbPath, type Db } from '../db/index.js';
import { settings } from '../db/schema.js';

const DAILY_PREFIX = 'pos_backup_auto_daily_';

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, lexicographically sortable
}

/**
 * Creates one backup per calendar day (idempotent — a no-op if today's file
 * already exists) and prunes daily backups beyond the configured retention
 * count. Never touches manual (`pos_backup_<timestamp>.db`) or shift-close
 * (`pos_backup_auto_shift_*.db`) backups — only its own `_auto_daily_` files.
 * Safe to call repeatedly (e.g. on an hourly timer): cheap when nothing to do.
 */
export async function runDailyBackupIfNeeded(sqlite: Database.Database, db: Db): Promise<void> {
  const dbPath = resolveDbPath();
  if (dbPath === ':memory:') return;

  const row = db.select().from(settings).limit(1).all()[0];
  const retentionCount = row?.backupRetentionDays ?? 14;
  if (!retentionCount || retentionCount <= 0) return; // disabled via Settings

  const backupDir = join(dirname(dbPath), 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const todayFile = `${DAILY_PREFIX}${todayStamp()}.db`;
  const todayPath = join(backupDir, todayFile);
  if (!existsSync(todayPath)) {
    await sqlite.backup(todayPath);
  }

  const dailyFiles = readdirSync(backupDir)
    .filter((f) => f.startsWith(DAILY_PREFIX) && f.endsWith('.db'))
    .sort()
    .reverse(); // newest first (YYYY-MM-DD sorts lexicographically)

  for (const f of dailyFiles.slice(retentionCount)) {
    try {
      unlinkSync(join(backupDir, f));
    } catch {
      // best-effort pruning — a locked/already-gone file shouldn't crash this
    }
  }
}
