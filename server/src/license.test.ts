import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { unlinkSync, existsSync } from 'node:fs';
import { buildApp } from './app';
import { openDatabase } from './db/index';
import {
  getMachineCode,
  verifyLicenseString,
  getLicenseFilePath,
  getLicenseInfo,
  activateLicense,
  signLicense,
  VENDOR_PUBLIC_KEY_PEM,
} from './lib/license';

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

  it('rejects a license self-signed with a locally-generated keypair against the real embedded vendor key', () => {
    // Regression test for the fixed vulnerability: the app used to generate
    // its own signing keypair on the customer's machine (getDefaultVendorKeys(),
    // persisted to vendor-keys.json), so anyone could sign their own "valid"
    // license locally. Now the app only ever verifies against the vendor's
    // real public key (VENDOR_PUBLIC_KEY_PEM, embedded at build time) — the
    // matching private key lives exclusively in the external vendor keygen
    // tool. A license forged with any other keypair, even a well-formed one,
    // must fail verification against the real embedded key.
    const machineCode = getMachineCode();
    const forgedLicenseKey = signLicense(
      {
        machineCode,
        customerName: 'ترخيص مزوّر',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        licenseType: 'commercial',
      },
      testPrivateKeyPem // a keypair generated ad-hoc by this test, not the real vendor key
    );

    const res = verifyLicenseString(forgedLicenseKey, machineCode, VENDOR_PUBLIC_KEY_PEM);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('توقيع الترخيص غير صالح');
  });
});
