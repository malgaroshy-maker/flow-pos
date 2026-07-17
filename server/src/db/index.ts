import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));

export function resolveDbPath(): string {
  if (process.env.POS_DB_PATH) return process.env.POS_DB_PATH;
  // server/src/db → server/data/pos.db (works from dist/db too: server/dist/db → server/data)
  return join(here, '..', '..', 'data', 'pos.db');
}

export function openDatabase(dbPath = resolveDbPath()): Database.Database {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  // Power outages are expected (see docs/plan.md): WAL keeps readers unblocked,
  // synchronous=FULL guarantees a committed sale survives a hard power cut.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = FULL');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

export function createDb(sqlite: Database.Database) {
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;
