import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type Database from 'better-sqlite3';
import { createDb, openDatabase } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));

export function runMigrations(sqlite: Database.Database) {
  const db = createDb(sqlite);
  migrate(db, { migrationsFolder: join(here, '..', '..', 'drizzle') });
}

// Run directly: npm run db:migrate
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sqlite = openDatabase();
  runMigrations(sqlite);
  console.log('Migrations applied.');
  sqlite.close();
}
