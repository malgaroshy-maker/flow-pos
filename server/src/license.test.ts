import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { unlinkSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from './app';
import { openDatabase } from './db/index';
import {
  getMachineCode,
  verifyLicenseString,
  getLicenseFilePath,
  getLicenseInfo,
  activateLicense,
} from './lib/license';
import { signLicense } from '../scripts/keygen';

describe('offline hardware licensing system', () => {
  let sqlite: ReturnType<typeof openDatabase>;
  let app: ReturnType<typeof buildApp>;

  // Generate test Ed25519 keypair for test assertions
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const testPublicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const testPrivateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  beforeEach(() => {
    // Remove test license file if exists
    const licPath = getLicenseFilePath();
    if (existsSync(licPath)) {
      try {
        unlinkSync(licPath);
      } catch {}
    }

    sqlite = openDatabase(':memory:');
    app = buildApp(sqlite);
  });

  afterEach(() => {
    const licPath = getLicenseFilePath();
    if (existsSync(licPath)) {
      try {
        unlinkSync(licPath);
      } catch {}
    }
  });

  it('generates a 16-character deterministic machine code', () => {
    const code1 = getMachineCode();
    const code2 = getMachineCode();

    expect(code1).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(code1).toBe(code2);
  });

  it('validates a correctly signed license matching the machine code', () => {
    const machineCode = getMachineCode();
    const licenseKey = signLicense(
      {
        machineCode,
        customerName: 'شركة ليبيا للمقاهي',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        licenseType: 'commercial',
      },
      testPrivateKeyPem
    );

    const res = verifyLicenseString(licenseKey, machineCode, testPublicKeyPem);
    expect(res.valid).toBe(true);
    expect(res.payload?.customerName).toBe('شركة ليبيا للمقاهي');
    expect(res.payload?.machineCode).toBe(machineCode);
  });

  it('rejects a license key issued for a different machine code', () => {
    const licenseKey = signLicense(
      {
        machineCode: 'AAAA-BBBB-CCCC-DDDD',
        customerName: 'مقهى التجربة',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        licenseType: 'commercial',
      },
      testPrivateKeyPem
    );

    const res = verifyLicenseString(licenseKey, 'XXXX-YYYY-ZZZZ-1111', testPublicKeyPem);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('غير مطابق');
  });

  it('rejects an expired license', () => {
    const machineCode = getMachineCode();
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const licenseKey = signLicense(
      {
        machineCode,
        customerName: 'محل المنار',
        issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: expiredDate,
        licenseType: 'demo',
      },
      testPrivateKeyPem
    );

    const res = verifyLicenseString(licenseKey, machineCode, testPublicKeyPem);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('انتهت صلاحية');
  });

  it('activates and reads license via API endpoints', async () => {
    const machineCode = getMachineCode();
    const licenseKey = signLicense(
      {
        machineCode,
        customerName: 'مقاهي الفجر التضامنية',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        licenseType: 'commercial',
      },
      testPrivateKeyPem
    );

    // Test GET /api/license/info
    const infoRes = await app.inject({
      method: 'GET',
      url: '/api/license/info',
    });
    expect(infoRes.statusCode).toBe(200);
    const infoData = JSON.parse(infoRes.payload);
    expect(infoData.machineCode).toBe(machineCode);

    // Test POST /api/license/activate with invalid key
    const badActivate = await app.inject({
      method: 'POST',
      url: '/api/license/activate',
      payload: { licenseKey: 'invalid.key' },
    });
    expect(badActivate.statusCode).toBe(400);

    // Test POST /api/license/activate with valid key (using test keys via activateLicense)
    const actRes = activateLicense(licenseKey, testPublicKeyPem);
    expect(actRes.success).toBe(true);
    expect(actRes.info?.customerName).toBe('مقاهي الفجر التضامنية');
  });

  it('persists the default vendor keypair to disk so a license survives a process restart', async () => {
    // Regression test: getDefaultVendorKeys() used to cache its keypair only
    // in memory, so every fresh process (every real app restart) generated a
    // brand-new random key and could never verify a license signed by the
    // previous process's key — the app appeared to "forget" activation on
    // every restart. vi.resetModules() + a fresh dynamic import simulates a
    // separate process loading the same on-disk key file.
    const dir = mkdtempSync(join(tmpdir(), 'flowpos-vendor-keys-'));
    const keysPath = join(dir, 'vendor-keys.json');
    process.env.POS_VENDOR_KEYS_PATH = keysPath;
    try {
      vi.resetModules();
      const licenseModuleA = await import('./lib/license?a');
      const keysA = licenseModuleA.getDefaultVendorKeys();
      expect(existsSync(keysPath)).toBe(true);

      vi.resetModules();
      const licenseModuleB = await import('./lib/license?b');
      const keysB = licenseModuleB.getDefaultVendorKeys();

      // Same keypair across the simulated restart — a license signed under
      // module A's key must still verify under module B's key.
      expect(keysB.publicKeyPem).toBe(keysA.publicKeyPem);

      const machineCode = licenseModuleB.getMachineCode();
      const licenseKey = licenseModuleA.signLicense(
        {
          machineCode,
          customerName: 'محل الاختبار',
          issuedAt: new Date().toISOString(),
          expiresAt: null,
          licenseType: 'commercial',
        },
        keysA.privateKeyPem
      );
      const verified = licenseModuleB.verifyLicenseString(licenseKey, machineCode, keysB.publicKeyPem);
      expect(verified.valid).toBe(true);
    } finally {
      delete process.env.POS_VENDOR_KEYS_PATH;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
