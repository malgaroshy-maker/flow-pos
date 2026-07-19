import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildApp } from './app.js';
import { openDatabase, resolveDbPath } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

let app: ReturnType<typeof buildApp>;
let managerToken: string;
let salesToken: string;
const cleanupFiles: string[] = [];

async function login(username: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token;
}

function multipartBody(filename: string, mimetype: string, content: Buffer) {
  const boundary = '----vitestboundary42';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

beforeEach(async () => {
  const sqlite = openDatabase(':memory:');
  runMigrations(sqlite);
  seed(sqlite);
  app = buildApp(sqlite);
  managerToken = await login('مدير', 'admin');
  salesToken = await login('بائع', 'sales');
});

afterEach(async () => {
  await app.close();
  for (const f of cleanupFiles.splice(0)) {
    if (existsSync(f)) unlinkSync(f);
  }
});

describe('product image upload', () => {
  async function createProduct() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'منتج بصورة',
        type: 'consumable',
        category: 'اختبار',
        baseUnit: 'قطعة',
        costPrice: 1000,
        retailPrice: 2000,
        wholesalePrice: 0,
        quantity: 1,
        reorderPoint: 0,
      },
    });
    return res.json();
  }

  it('stores the image, serves it, and records image_url on the product', async () => {
    const product = await createProduct();
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const { body, contentType } = multipartBody('photo.png', 'image/png', png);

    const upload = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/image`,
      headers: { authorization: `Bearer ${managerToken}`, 'content-type': contentType },
      payload: body,
    });
    expect(upload.statusCode).toBe(200);
    const { imageUrl } = upload.json();
    expect(imageUrl).toMatch(new RegExp(`^/uploads/product-${product.id}\\.png`));
    cleanupFiles.push(join(dirname(resolveDbPath()), 'uploads', `product-${product.id}.png`));

    const detail = await app.inject({
      method: 'GET',
      url: `/api/products/${product.id}`,
      headers: { authorization: `Bearer ${salesToken}` },
    });
    expect(detail.json().imageUrl).toBe(imageUrl);

    const served = await app.inject({ method: 'GET', url: imageUrl.split('?')[0] });
    expect(served.statusCode).toBe(200);
    expect(served.rawPayload.equals(png)).toBe(true);
  });

  it('rejects non-managers and non-image types', async () => {
    const product = await createProduct();
    const png = Buffer.from('89504e47', 'hex');

    const bySales = multipartBody('photo.png', 'image/png', png);
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/image`,
      headers: { authorization: `Bearer ${salesToken}`, 'content-type': bySales.contentType },
      payload: bySales.body,
    });
    expect(forbidden.statusCode).toBe(403);

    const asText = multipartBody('notes.txt', 'text/plain', Buffer.from('hello'));
    const badType = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/image`,
      headers: { authorization: `Bearer ${managerToken}`, 'content-type': asText.contentType },
      payload: asText.body,
    });
    expect(badType.statusCode).toBe(400);
    expect(badType.json().error).toBe('invalid_type');
  });
});
