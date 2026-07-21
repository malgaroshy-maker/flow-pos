import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { settings } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { runDailyBackupIfNeeded } from './lib/autoBackup.js';

describe('automatic daily backup', () => {
  let dir: string;

  afterEach(() => {
    delete process.env.POS_DB_PATH;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function setupDb() {
    dir = mkdtempSync(join(tmpdir(), 'flowpos-autobackup-'));
    const dbPath = join(dir, 'pos.db');
    process.env.POS_DB_PATH = dbPath;
    const sqlite = openDatabase(dbPath);
    runMigrations(sqlite);
    seed(sqlite);
    const db = createDb(sqlite);
    return { sqlite, db, dbPath };
  }

  it('creates one daily backup and is idempotent on repeated calls', async () => {
    const { sqlite, db, dbPath } = setupDb();
    await runDailyBackupIfNeeded(sqlite, db);
    const backupDir = join(dir, 'backups');
    expect(existsSync(backupDir)).toBe(true);
    const files = readdirSync(backupDir).filter((f) => f.startsWith('pos_backup_auto_daily_'));
    expect(files.length).toBe(1);

    // Calling again the same day must not create a second file.
    await runDailyBackupIfNeeded(sqlite, db);
    const filesAfter = readdirSync(backupDir).filter((f) => f.startsWith('pos_backup_auto_daily_'));
    expect(filesAfter.length).toBe(1);
    sqlite.close();
  });

  it('does nothing when backupRetentionDays is 0', async () => {
    const { sqlite, db } = setupDb();
    db.update(settings).set({ backupRetentionDays: 0 }).where(eq(settings.id, 1)).run();
    await runDailyBackupIfNeeded(sqlite, db);
    const backupDir = join(dir, 'backups');
    expect(existsSync(backupDir)).toBe(false);
    sqlite.close();
  });

  it('prunes daily backups beyond the retention count, leaving other backup types untouched', async () => {
    const { sqlite, db } = setupDb();
    db.update(settings).set({ backupRetentionDays: 2 }).where(eq(settings.id, 1)).run();

    const backupDir = join(dir, 'backups');
    await runDailyBackupIfNeeded(sqlite, db); // creates today's backup, dir now exists

    // Simulate 3 older daily backups plus one manual and one shift backup.
    for (const day of ['2026-01-01', '2026-01-02', '2026-01-03']) {
      writeFileSync(join(backupDir, `pos_backup_auto_daily_${day}.db`), '');
    }
    writeFileSync(join(backupDir, 'pos_backup_2026-01-01_00-00-00.db'), '');
    writeFileSync(join(backupDir, 'pos_backup_auto_shift_1_2026-01-01_00-00-00.db'), '');

    await runDailyBackupIfNeeded(sqlite, db);

    const files = readdirSync(backupDir);
    const dailyFiles = files.filter((f) => f.startsWith('pos_backup_auto_daily_'));
    expect(dailyFiles.length).toBe(2); // retention = 2, oldest pruned

    expect(files).toContain('pos_backup_2026-01-01_00-00-00.db');
    expect(files).toContain('pos_backup_auto_shift_1_2026-01-01_00-00-00.db');
    sqlite.close();
  });
});
