import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  const sqlite = openDatabase(':memory:');
  runMigrations(sqlite);
  seed(sqlite);
  app = buildApp(sqlite);
});

afterEach(async () => {
  await app.close();
});

describe('GET /api/health', () => {
  it('reports ok with the server time', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(new Date(body.serverTime).getTime()).not.toBeNaN();
  });
});

describe('GET /api/settings', () => {
  it('returns the seeded default settings', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.currency).toBe('LYD');
    expect(body.taxEnabled).toBe(false);
    expect(body.businessName).toBeTruthy();
  });
});
