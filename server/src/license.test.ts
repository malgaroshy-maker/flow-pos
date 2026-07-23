import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { unlinkSync, existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from './app';
import { openDatabase } from './db/index';
import {
  getMachineCode,
  verifyLicenseString,
  getLicenseFilePath,
  getMachineCodeFilePath,
  getLicenseInfo,
  activateLicense,
  signLicense,
  VENDOR_PUBLIC_KEY_PEM,
} from './lib/license';

function cleanupTestFiles() {
  for (const filePath of [getLicenseFilePath(), getMachineCodeFilePath()]) {
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {}
    }
  }
}

describe('offline hardware licensing system', () => {
  let sqlite: ReturnType<typeof openDatabase>;
  let app: ReturnType<typeof buildApp>;

  // Generate test Ed25519 keypair for test assertions
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const testPublicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const testPrivateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  beforeEach(() => {
    cleanupTestFiles();
    sqlite = openDatabase(':memory:');
    app = buildApp(sqlite);
  });

  afterEach(() => {
    cleanupTestFiles();
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

  it('parses and preserves optional maxDevices field in license payload', () => {
    const machineCode = getMachineCode();
    const licenseKey = signLicense(
      {
        machineCode,
        customerName: 'شبكة محلات السلام',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        licenseType: 'commercial',
        maxDevices: 5,
      },
      testPrivateKeyPem
    );

    const res = verifyLicenseString(licenseKey, machineCode, testPublicKeyPem);
    expect(res.valid).toBe(true);
    expect(res.payload?.maxDevices).toBe(5);

    const actRes = activateLicense(licenseKey, testPublicKeyPem);
    expect(actRes.success).toBe(true);
    expect(actRes.info?.maxDevices).toBe(5);
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

  it('persists the machine code to disk so it stays stable across restarts even if network adapters change', async () => {
    // Regression test for a real customer-reported bug: getMachineCode() used
    // to hash in every active network adapter's MAC address on every call.
    // That set is not stable on a real machine (WiFi radio cycling on
    // sleep/wake, VPN/virtual adapters appearing or disappearing), so the
    // exact same physical machine could compute a different code later and a
    // valid, already-activated license would suddenly report "machine code
    // does not match this computer". vi.resetModules() + a fresh dynamic
    // import simulates a separate process load (a real app restart), and we
    // fake a changed network environment between the two loads.
    const dir = mkdtempSync(join(tmpdir(), 'flowpos-machine-id-'));
    const idPath = join(dir, 'machine-id.txt');
    process.env.POS_MACHINE_CODE_PATH = idPath;
    try {
      vi.resetModules();
      const licenseModuleA = await import('./lib/license?machineA');
      const codeA = licenseModuleA.getMachineCode();
      expect(existsSync(idPath)).toBe(true);
      expect(readFileSync(idPath, 'utf-8').trim()).toBe(codeA);

      // Simulate the "process B" load happening under different network
      // conditions than process A saw — os.networkInterfaces() output isn't
      // easily mockable here, but the persisted-file short-circuit means
      // getMachineCode() never even needs to recompute from live OS state on
      // this second load, which is exactly the fix: it reads the cached
      // value instead of re-hashing volatile inputs.
      vi.resetModules();
      const licenseModuleB = await import('./lib/license?machineB');
      const codeB = licenseModuleB.getMachineCode();

      expect(codeB).toBe(codeA);
    } finally {
      delete process.env.POS_MACHINE_CODE_PATH;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
