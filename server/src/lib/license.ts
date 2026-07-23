import { createHash, verify, sign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cpus, hostname, arch, platform, networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveDbPath } from '../db/index.js';

// The embedded vendor public key — the ONLY key this app ever verifies
// license signatures against. The matching private key is generated and
// held exclusively by the vendor keygen tool, which lives OUTSIDE this
// repository and never ships with the product (see docs/next-steps.md
// Milestone F1). This app never generates, sees, or stores a private key —
// doing so on the customer's own machine would let anyone with basic
// tooling forge a valid license, which is exactly what the previous
// getDefaultVendorKeys()-based design allowed.
export const VENDOR_PUBLIC_KEY_PEM =
  process.env.VENDOR_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA8oMOYc4do1dFi2ZM3hWf3yDL2tgIaWZOAl69coPh12k=
-----END PUBLIC KEY-----`;

/**
 * Signs a license payload with a given private key PEM. Only ever called by
 * the external vendor keygen tool (via a private key it alone holds) and by
 * this repo's own tests (via an ad-hoc test keypair). The app itself never
 * calls this in production — there is no private key on the customer's
 * machine to call it with.
 */
export function signLicense(payload: LicensePayload, privateKeyPem: string): string {
  const payloadJsonStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJsonStr, 'utf-8').toString('base64');
  const signature = sign(null, Buffer.from(payloadJsonStr), privateKeyPem);
  const sigB64 = signature.toString('base64');
  return `${payloadB64}.${sigB64}`;
}

export interface LicensePayload {
  machineCode: string;
  customerName: string;
  issuedAt: string;
  expiresAt: string | null; // null = perpetual / lifetime
  licenseType: 'commercial' | 'demo' | 'trial';
  maxDevices?: number | null; // dormant: null / undefined = unlimited
}

export interface LicenseInfo {
  active: boolean;
  machineCode: string;
  customerName?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  licenseType?: string;
  maxDevices?: number | null;
  isExpired?: boolean;
  reason?: string;
}

function computeMachineCode(): string {
  const cpuModel = cpus()[0]?.model || 'generic-cpu';
  const cpuCount = cpus().length;
  const sysArch = arch();
  const sysPlatform = platform();
  const sysHost = hostname();

  const nets = networkInterfaces();
  const macs: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        macs.push(net.mac);
      }
    }
  }
  macs.sort();

  const rawString = `${cpuModel}|${cpuCount}|${sysArch}|${sysPlatform}|${sysHost}|${macs.join(',')}`;
  const hash = createHash('sha256').update(rawString).digest('hex').toUpperCase();

  // Format as 4 groups of 4 characters: XXXX-XXXX-XXXX-XXXX
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}

export function getMachineCodeFilePath(): string {
  if (process.env.POS_MACHINE_CODE_PATH) return process.env.POS_MACHINE_CODE_PATH;
  const dbPath = resolveDbPath();
  return join(dirname(dbPath), 'machine-id.txt');
}

const MACHINE_CODE_FORMAT = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

/**
 * Returns this machine's fingerprint (XXXX-XXXX-XXXX-XXXX), computed once and
 * cached to disk from then on.
 *
 * Regression fix: the fingerprint used to be recomputed from scratch on every
 * call, including every active network adapter's MAC address. That list is
 * NOT stable on a real machine — WiFi radios cycle on sleep/wake, VPN and
 * virtual adapters (Hyper-V, WSL, Bluetooth PAN, USB tethering) can appear or
 * disappear between boots — so the exact same physical machine could compute
 * a different code hours after activation, and a perfectly valid license
 * would suddenly fail "machine code does not match this computer". Caching
 * the first computed value to disk (same pattern as the vendor keypair and
 * session persistence fixes) makes it stable for the lifetime of the install
 * regardless of what changes on the network side afterward.
 */
export function getMachineCode(): string {
  const filePath = getMachineCodeFilePath();
  if (existsSync(filePath)) {
    try {
      const cached = readFileSync(filePath, 'utf-8').trim();
      if (MACHINE_CODE_FORMAT.test(cached)) return cached;
    } catch {
      // Corrupt/unreadable file — fall through and recompute below.
    }
  }

  const computed = computeMachineCode();
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, computed, 'utf-8');
  } catch {
    // Best-effort persistence — if the disk write fails, this call still
    // returns a correct value; the next call will just recompute again.
  }
  return computed;
}

/**
 * Path to license.lic file in POS data directory.
 */
export function getLicenseFilePath(): string {
  if (process.env.POS_LICENSE_PATH) return process.env.POS_LICENSE_PATH;
  const dbPath = resolveDbPath();
  return join(dirname(dbPath), 'license.lic');
}

/**
 * Verify license string format: base64(JSON_payload).base64(signature)
 */
export function verifyLicenseString(
  licenseKey: string,
  targetMachineCode = getMachineCode(),
  publicKeyPem = VENDOR_PUBLIC_KEY_PEM
): { valid: boolean; payload?: LicensePayload; reason?: string } {
  try {
    const parts = licenseKey.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'صيغة مفتاح الترخيص غير صحيحة' };
    }

    const [payloadB64, sigB64] = parts;
    if (!payloadB64 || !sigB64) {
      return { valid: false, reason: 'صيغة مفتاح الترخيص غير مكتملة' };
    }

    const payloadJsonStr = Buffer.from(payloadB64, 'base64').toString('utf-8');
    const payload: LicensePayload = JSON.parse(payloadJsonStr);

    if (!payload.machineCode || !payload.customerName) {
      return { valid: false, reason: 'بيانات الترخيص ناقصة' };
    }

    // Verify machine code match
    if (payload.machineCode.toUpperCase() !== targetMachineCode.toUpperCase()) {
      return { valid: false, reason: 'كود الجهاز غير مطابق لهذا الحاسوب' };
    }

    // Verify expiration if present
    if (payload.expiresAt) {
      const expiry = new Date(payload.expiresAt).getTime();
      if (isNaN(expiry) || Date.now() > expiry) {
        return { valid: false, payload, reason: 'انتهت صلاحية ترخيص المنظومة' };
      }
    }

    // Verify Ed25519 signature
    const signature = Buffer.from(sigB64, 'base64');
    const isSignatureValid = verify(null, Buffer.from(payloadJsonStr), publicKeyPem, signature);

    if (!isSignatureValid) {
      return { valid: false, reason: 'توقيع الترخيص غير صالح أو معدّل' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: 'فشل فك تشفير وتدقيق مفتاح الترخيص' };
  }
}

/**
 * Read and validate current license from disk.
 */
export function getLicenseInfo(publicKeyPem = VENDOR_PUBLIC_KEY_PEM): LicenseInfo {
  const machineCode = getMachineCode();

  // Bypassed in test environment or when explicitly disabled via env
  if (process.env.NODE_ENV === 'test' || process.env.POS_DISABLE_LICENSE_CHECK === '1') {
    return {
      active: true,
      machineCode,
      customerName: 'نسخة التطوير والاختبار',
      issuedAt: new Date().toISOString(),
      expiresAt: null,
      licenseType: 'commercial',
    };
  }

  const filePath = getLicenseFilePath();
  if (!existsSync(filePath)) {
    return {
      active: false,
      machineCode,
      reason: 'لم يتم تفعيل ترخيص المنظومة بعد',
    };
  }

  try {
    const licenseKey = readFileSync(filePath, 'utf-8');
    const res = verifyLicenseString(licenseKey, machineCode, publicKeyPem);

    if (!res.valid || !res.payload) {
      return {
        active: false,
        machineCode,
        reason: res.reason || 'ملف الترخيص غير صالح',
      };
    }

    return {
      active: true,
      machineCode,
      customerName: res.payload.customerName,
      issuedAt: res.payload.issuedAt,
      expiresAt: res.payload.expiresAt,
      licenseType: res.payload.licenseType,
      maxDevices: res.payload.maxDevices ?? null,
    };
  } catch (err) {
    return {
      active: false,
      machineCode,
      reason: 'خطأ أثناء قراءة ملف الترخيص من القرص',
    };
  }
}

/**
 * Save new license key to disk.
 */
export function activateLicense(
  licenseKey: string,
  publicKeyPem = VENDOR_PUBLIC_KEY_PEM
): { success: boolean; error?: string; info?: LicenseInfo } {
  const machineCode = getMachineCode();
  const res = verifyLicenseString(licenseKey, machineCode, publicKeyPem);

  if (!res.valid || !res.payload) {
    return { success: false, error: res.reason || 'مفتاح الترخيص غير صالح' };
  }

  const filePath = getLicenseFilePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, licenseKey.trim(), 'utf-8');

  return {
    success: true,
    info: {
      active: true,
      machineCode,
      customerName: res.payload.customerName,
      issuedAt: res.payload.issuedAt,
      expiresAt: res.payload.expiresAt,
      licenseType: res.payload.licenseType,
      maxDevices: res.payload.maxDevices ?? null,
    },
  };
}
