import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { sessions as sessionsTable } from './db/schema.js';

describe('persisted login sessions survive a simulated process restart', () => {
  it('a session created in one "process" is loaded by loadPersistedSessions() in the next', async () => {
    // Real on-disk DB (not :memory:) — session persistence is only meaningful
    // across restarts, which requires a file the next process can reopen.
    const dir = mkdtempSync(join(tmpdir(), 'flowpos-sessions-'));
    const dbPath = join(dir, 'pos.db');
    try {
      const sqlite = openDatabase(dbPath);
      runMigrations(sqlite);
      seed(sqlite);
      const db = createDb(sqlite);

      // "Process A": log in via the real HTTP route so createSession() runs
      // exactly as it does in production.
      vi.resetModules();
      const appModuleA = await import('./app.js?a');
      const appA = appModuleA.buildApp(sqlite);
      const loginRes = await appA.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'مدير', password: 'admin' },
      });
      expect(loginRes.statusCode).toBe(200);
      const token = loginRes.json().token;
      // Not closing appA here: buildApp()'s onClose hook closes the shared
      // sqlite handle, which this test still needs open to read from below.

      // Confirm the session row actually landed on disk.
      const persisted = db.select().from(sessionsTable).all();
      expect(persisted.some((s) => s.token === token)).toBe(true);

      // "Process B": fresh module graph (empty in-memory sessions Map),
      // rehydrated from the same on-disk file — simulates a real app restart.
      vi.resetModules();
      const authModuleB = await import('./routes/auth.js?b');
      expect(authModuleB.sessions.has(token)).toBe(false); // fresh map, nothing loaded yet

      authModuleB.loadPersistedSessions(db);
      const restored = authModuleB.sessions.get(token);
      expect(restored).toBeDefined();
      expect(restored?.username).toBe('مدير');
      expect(restored?.role).toBe('manager');

      sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadPersistedSessions() drops already-expired rows instead of resurrecting them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'flowpos-sessions-expired-'));
    const dbPath = join(dir, 'pos.db');
    try {
      const sqlite = openDatabase(dbPath);
      runMigrations(sqlite);
      seed(sqlite);
      const db = createDb(sqlite);

      db.insert(sessionsTable)
        .values({
          token: 'expired-token',
          userId: 1,
          username: 'مدير',
          role: 'manager',
          expiresAt: Date.now() - 1000, // already expired
        })
        .run();

      vi.resetModules();
      const authModuleB = await import('./routes/auth.js?expired');
      authModuleB.loadPersistedSessions(db);

      expect(authModuleB.sessions.has('expired-token')).toBe(false);
      const remaining = db.select().from(sessionsTable).all();
      expect(remaining.some((s) => s.token === 'expired-token')).toBe(false);

      sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
