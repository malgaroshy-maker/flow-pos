import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getDefaultVendorKeys, type LicensePayload } from '../server/src/lib/license.js';

function printHelp() {
  console.log(`
منظومة Flow — أداة توليد وتوقيع التراخيص (Vendor License Generator)
==================================================================

الاستخدام:
  1. توليد مفاتيح تشفير Ed25519 جديدة:
     npx tsx scripts/keygen.ts --generate-keys

  2. إصدار وتوقيع ترخيص جديد لعميل:
     npx tsx scripts/keygen.ts --machine XXXX-XXXX-XXXX-XXXX --customer "اسم العميل" [--days 365] [--type commercial]
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      options[key] = val;
    }
  }
  return options;
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

async function main() {
  const opts = parseArgs();

  if (opts['help'] || Object.keys(opts).length === 0) {
    printHelp();
    return;
  }

  if (opts['generate-keys']) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    writeFileSync('vendor_public.pem', pubPem, 'utf-8');
    writeFileSync('vendor_private.pem', privPem, 'utf-8');

    console.log('✅ تم توليد المفتاح العام والخاص بنجاح وحفظهما في:');
    console.log('   - vendor_public.pem');
    console.log('   - vendor_private.pem');
    return;
  }

  if (opts['machine'] && opts['customer']) {
    const machineCode = opts['machine'].trim().toUpperCase();
    const customerName = opts['customer'].trim();
    const days = opts['days'] ? parseInt(opts['days'], 10) : null;
    const licenseType = (opts['type'] as LicensePayload['licenseType']) || 'commercial';

    let privateKeyPem = getDefaultVendorKeys().privateKeyPem;
    if (existsSync('vendor_private.pem')) {
      privateKeyPem = readFileSync('vendor_private.pem', 'utf-8');
    }

    const now = new Date();
    const expiresAt = days ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString() : null;

    const payload: LicensePayload = {
      machineCode,
      customerName,
      issuedAt: now.toISOString(),
      expiresAt,
      licenseType,
    };

    const licenseKey = signLicense(payload, privateKeyPem);

    console.log('\n==================================================================');
    console.log(`✅ تم إصدار ترخيص بنجاح للعميل: ${customerName}`);
    console.log(`   كود الجهاز: ${machineCode}`);
    console.log(`   نوع الترخيص: ${licenseType}`);
    console.log(`   تاريخ الصلاحية: ${expiresAt ? new Date(expiresAt).toLocaleDateString('ar-LY') : 'دائم (بدون انتهاء)'}`);
    console.log('==================================================================\n');
    console.log('مفتاح الترخيص للتفعيل (انسخه كاملاً في شاشة التفعيل):\n');
    console.log(licenseKey);
    console.log('\n==================================================================\n');
    return;
  }

  printHelp();
}

if (process.argv[1]?.endsWith('keygen.ts')) {
  main();
}
