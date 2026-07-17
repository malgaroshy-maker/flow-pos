import { pathToFileURL } from 'node:url';
import type Database from 'better-sqlite3';
import { createDb, openDatabase } from './index.js';
import { runMigrations } from './migrate.js';
import { settings } from './schema.js';

export function seed(sqlite: Database.Database) {
  const db = createDb(sqlite);
  const existing = db.select().from(settings).limit(1).all();
  if (existing.length === 0) {
    db.insert(settings).values({ id: 1 }).run();
    return true;
  }
  return false;
}

// Run directly: npm run db:seed
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sqlite = openDatabase();
  runMigrations(sqlite);
  const inserted = seed(sqlite);
  console.log(inserted ? 'Seeded default settings.' : 'Already seeded — nothing to do.');
  sqlite.close();
}
