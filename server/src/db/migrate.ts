import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type Database from 'better-sqlite3';
import { createDb, openDatabase } from './index.js';

import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));

export function resolveMigrationsFolder(): string {
  // Bundled with server.js: dist/drizzle
  const sameDirPath = join(here, 'drizzle');
  if (existsSync(sameDirPath)) return sameDirPath;
  // Production compiled bundle: server/dist → server/drizzle
  const prodPath = join(here, '..', 'drizzle');
  if (existsSync(prodPath)) return prodPath;
  // Dev mode: server/src/db → server/drizzle
  return join(here, '..', '..', 'drizzle');
}

export function runMigrations(sqlite: Database.Database) {
  const db = createDb(sqlite);
  migrate(db, { migrationsFolder: resolveMigrationsFolder() });
}

// Run directly: npm run db:migrate
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sqlite = openDatabase();
  runMigrations(sqlite);
  console.log('Migrations applied.');
  sqlite.close();
}
