import { createHash, verify, sign, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cpus, hostname, arch, platform, networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveDbPath } from '../db/index.js';

// Default embedded vendor public key for license signature verification.
// Overridable via VENDOR_PUBLIC_KEY env variable if needed.
export const VENDOR_PUBLIC_KEY_PEM =
  process.env.VENDOR_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----
MCowKOZzgjA+MCEGCSqGSIb3DQEHAqEAMB4EACD5v9kM1J5K4q3L4bQ
-----END PUBLIC KEY-----`;

// Concrete Ed25519 Public Key used by default if custom key not supplied.
// Fallback keypair generation for default out-of-box operation.
//
// This MUST be persisted to disk. A license issued with an in-memory-only
// key becomes unverifiable the instant the process restarts (a fresh
// process = a fresh random keypair, which can never verify a signature made
// by the previous process's key) — every app restart looked like the
// license had been wiped, when actually the verification key itself had
// silently changed underneath it.
let defaultKeysCache: { publicKeyPem: string; privateKeyPem: string } | null = null;

function getDefaultVendorKeysFilePath(): string {
  if (process.env.POS_VENDOR_KEYS_PATH) return process.env.POS_VENDOR_KEYS_PATH;
  const dbPath = resolveDbPath();
  return join(dirname(dbPath), 'vendor-keys.json');
}

export function getDefaultVendorKeys(): { publicKeyPem: string; privateKeyPem: string } {
  if (defaultKeysCache) return defaultKeysCache;

  const filePath = getDefaultVendorKeysFilePath();
  if (existsSync(filePath)) {
    try {
      defaultKeysCache = JSON.parse(readFileSync(filePath, 'utf-8'));
      return defaultKeysCache!;
    } catch {
      // Corrupt file — fall through and regenerate below.
    }
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  defaultKeysCache = {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(defaultKeysCache), 'utf-8');
  return defaultKeysCache;
}

export function signLicense(
  payload: LicensePayload,
  privateKeyPem = getDefaultVendorKeys().privateKeyPem
): string {
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
}

export interface LicenseInfo {
  active: boolean;
  machineCode: string;
  customerName?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  licenseType?: string;
  isExpired?: boolean;
  reason?: string;
}

/**
 * Generate a deterministic 16-character machine fingerprint (XXXX-XXXX-XXXX-XXXX).
 */
export function getMachineCode(): string {
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
  publicKeyPem = getDefaultVendorKeys().publicKeyPem
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
export function getLicenseInfo(publicKeyPem = getDefaultVendorKeys().publicKeyPem): LicenseInfo {
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
  publicKeyPem = getDefaultVendorKeys().publicKeyPem
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
    },
  };
}

const DEFAULT_VENDOR_PIN = process.env.VENDOR_PIN || '1391997';

export function activateWithVendorPin(
  vendorPin: string,
  customerName: string
): { success: boolean; error?: string; info?: LicenseInfo } {
  if (!vendorPin || vendorPin.trim() !== DEFAULT_VENDOR_PIN) {
    return { success: false, error: 'رمز الموزع المعتمد غير صحيح' };
  }
  const machineCode = getMachineCode();
  const keys = getDefaultVendorKeys();
  const payload: LicensePayload = {
    machineCode,
    customerName: customerName.trim() || 'عميل محلي',
    issuedAt: new Date().toISOString(),
    expiresAt: null, // Lifetime commercial license
    licenseType: 'commercial',
  };

  const licenseKey = signLicense(payload, keys.privateKeyPem);
  return activateLicense(licenseKey, keys.publicKeyPem);
}
