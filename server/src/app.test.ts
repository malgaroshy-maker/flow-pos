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
    expect(body.idleLockMinutes).toBe(5);
  });
});

describe('PUT /api/settings — idle lock minutes', () => {
  async function login(username: string, password: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username, password },
    });
    expect(res.statusCode).toBe(200);
    return res.json().token;
  }

  it('accepts a valid idleLockMinutes value and persists it', async () => {
    const managerToken = await login('مدير', 'admin');
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { idleLockMinutes: 15 },
    });
    expect(putRes.statusCode).toBe(200);

    const getRes = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(getRes.json().idleLockMinutes).toBe(15);
  });

  it('rejects an out-of-range idleLockMinutes value', async () => {
    const managerToken = await login('مدير', 'admin');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { idleLockMinutes: 500 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_idleLockMinutes');
  });

  it('rejects the sales role from changing settings', async () => {
    const salesToken = await login('بائع', 'sales');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { authorization: `Bearer ${salesToken}` },
      payload: { idleLockMinutes: 10 },
    });
    expect(res.statusCode).toBe(403);
  });
});
