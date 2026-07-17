import { pathToFileURL } from 'node:url';
import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { createDb, openDatabase } from './index.js';
import { runMigrations } from './migrate.js';
import { settings, users } from './schema.js';

export function seed(sqlite: Database.Database) {
  const db = createDb(sqlite);

  // 1. Seed default settings
  const existingSettings = db.select().from(settings).limit(1).all();
  if (existingSettings.length === 0) {
    db.insert(settings).values({ id: 1 }).run();
  }

  // 2. Seed default users
  const existingUsers = db.select().from(users).limit(1).all();
  if (existingUsers.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin', salt);
    const salesHash = bcrypt.hashSync('sales', salt);
    const now = new Date().toISOString();

    db.insert(users)
      .values([
        {
          id: 1,
          username: 'مدير',
          passwordHash: adminHash,
          pin: '1111',
          role: 'manager',
          active: true,
          createdAt: now,
        },
        {
          id: 2,
          username: 'بائع',
          passwordHash: salesHash,
          pin: '2222',
          role: 'sales',
          active: true,
          createdAt: now,
        },
      ])
      .run();
    return true;
  }
  return false;
}

// Run directly: npm run db:seed
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sqlite = openDatabase();
  runMigrations(sqlite);
  const inserted = seed(sqlite);
  console.log(inserted ? 'Seeded default settings and users.' : 'Already seeded — nothing to do.');
  sqlite.close();
}
