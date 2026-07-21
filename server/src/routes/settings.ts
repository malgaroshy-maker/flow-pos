import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { settings, auditLogs, users } from '../db/schema.js';
import { authenticateRequest } from './auth.js';

import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Node's os.networkInterfaces() only exposes Windows' generic connection
// name ("Ethernet 3"), never the real driver identity — a VirtualBox
// host-only adapter and a real NIC can both show up as "Ethernet N". The
// actual vendor/driver string ("VirtualBox Host-Only Ethernet Adapter",
// "Siemens PLCSIM Virtual Ethernet Adapter", …) only comes from Windows'
// own adapter list, so it's queried separately and cross-referenced by name.
let adapterDescCache: { at: number; data: Record<string, string> } | null = null;
const ADAPTER_DESC_CACHE_MS = 30_000;

export async function getWindowsAdapterDescriptions(): Promise<Record<string, string>> {
  // Never shell out during tests — keeps the suite fast/deterministic and
  // avoids a result that happens to depend on whatever adapters exist on
  // the machine running the tests. isVirtual() below falls back to matching
  // the interface's own name when no description is available, which is
  // exactly what tests exercise.
  if (process.platform !== 'win32' || process.env.NODE_ENV === 'test') return {};
  if (adapterDescCache && Date.now() - adapterDescCache.at < ADAPTER_DESC_CACHE_MS) {
    return adapterDescCache.data;
  }
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-NetAdapter | Select-Object Name, InterfaceDescription | ConvertTo-Json -Compress',
      ],
      { timeout: 4000 }
    );
    const parsed = JSON.parse(stdout || '[]');
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const map: Record<string, string> = {};
    for (const item of list) {
      if (item?.Name) map[item.Name] = item.InterfaceDescription || '';
    }
    adapterDescCache = { at: Date.now(), data: map };
    return map;
  } catch {
    return {};
  }
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/network/info', async (_req, reply) => {
    const interfaces = os.networkInterfaces();
    const adapterDescriptions = await getWindowsAdapterDescriptions();

    // Virtual/vendor adapters (VirtualBox, VMware, Hyper-V/WSL, Docker, VPN
    // tunnels, Bluetooth PAN, industrial simulators…) hand out real-looking
    // IPv4 addresses that a phone on the shop's WiFi can never actually
    // reach. Showing them alongside the real LAN address just confuses
    // whoever is scanning the QR code, so they're filtered out entirely
    // rather than merely de-prioritized.
    const VIRTUAL_ADAPTER_PATTERN =
      /virtualbox|vmware|hyper-v|vethernet|docker|wsl|loopback|tailscale|zerotier|\btap\b|\btun\b|npcap|bluetooth|virtual/i;
    const isVirtual = (name: string) => {
      const description = adapterDescriptions[name] || '';
      return VIRTUAL_ADAPTER_PATTERN.test(description) || VIRTUAL_ADAPTER_PATTERN.test(name);
    };

    type Candidate = { name: string; ip: string };
    const allCandidates: Candidate[] = [];
    const realCandidates: Candidate[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family !== 'IPv4' || iface.internal) continue;
        const candidate = { name, ip: iface.address };
        allCandidates.push(candidate);
        if (!isVirtual(name)) realCandidates.push(candidate);
      }
    }
    // Fall back to the unfiltered list if every adapter looked "virtual" —
    // better to show a possibly-wrong address than none at all.
    const chosen = realCandidates.length > 0 ? realCandidates : allCandidates;

    const isWifi = (n: string) => /wi-?fi|wlan/i.test(n);
    const isEthernet = (n: string) => /ethernet|lan/i.test(n);
    const recommended =
      chosen.find((c) => isWifi(c.name)) || chosen.find((c) => isEthernet(c.name)) || chosen[0];

    const port = process.env.PORT || 3001;
    const withUrl = chosen.map((c) => ({ ...c, url: `http://${c.ip}:${port}` }));
    return {
      ips: chosen.map((c) => c.ip),
      interfaces: withUrl,
      recommendedUrl: recommended ? `http://${recommended.ip}:${port}` : null,
      port: Number(port),
      urls: withUrl.map((c) => c.url),
    };
  });

  app.get('/settings', async (_req, reply) => {
    const row = app.db.select().from(settings).limit(1).all()[0];
    if (!row) return reply.code(404).send({ error: 'settings_not_seeded' });
    return row;
  });

  app.put('/settings', { preHandler: authenticateRequest }, async (req, reply) => {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'هذا الإجراء متاح للمدراء فقط' });
    }

    const body = req.body as {
      businessName?: string;
      businessSubtitle?: string;
      businessPhone?: string;
      businessPhone2?: string;
      businessAddress?: string;
      warrantyTerms?: string;
      stampTitle?: string;
      taxEnabled?: boolean;
      taxRatePermille?: number;
      discountCapPercent?: number;
      idleLockMinutes?: number;
      backupRetentionDays?: number;
    };

    if (
      body.taxRatePermille !== undefined &&
      (!Number.isSafeInteger(body.taxRatePermille) ||
        body.taxRatePermille < 0 ||
        body.taxRatePermille > 1000)
    ) {
      return reply.code(400).send({
        error: 'invalid_taxRatePermille',
        message: 'نسبة الضريبة يجب أن تكون عدداً صحيحاً بين 0 و 1000 (بالميل ×10)',
      });
    }

    if (
      body.discountCapPercent !== undefined &&
      (!Number.isSafeInteger(body.discountCapPercent) ||
        body.discountCapPercent < 0 ||
        body.discountCapPercent > 100)
    ) {
      return reply.code(400).send({
        error: 'invalid_discountCapPercent',
        message: 'حد الخصم يجب أن يكون نسبة مئوية صحيحة بين 0 و 100',
      });
    }

    if (
      body.idleLockMinutes !== undefined &&
      (!Number.isSafeInteger(body.idleLockMinutes) ||
        body.idleLockMinutes < 0 ||
        body.idleLockMinutes > 120)
    ) {
      return reply.code(400).send({
        error: 'invalid_idleLockMinutes',
        message: 'مدة القفل التلقائي يجب أن تكون عدداً صحيحاً بين 0 و 120 دقيقة',
      });
    }

    if (
      body.backupRetentionDays !== undefined &&
      (!Number.isSafeInteger(body.backupRetentionDays) ||
        body.backupRetentionDays < 0 ||
        body.backupRetentionDays > 90)
    ) {
      return reply.code(400).send({
        error: 'invalid_backupRetentionDays',
        message: 'عدد النسخ الاحتياطية اليومية المحفوظة يجب أن يكون عدداً صحيحاً بين 0 و 90',
      });
    }

    const row = app.db.select().from(settings).limit(1).all()[0];
    if (!row) {
      return reply.code(404).send({ error: 'settings_not_seeded' });
    }

    app.db
      .update(settings)
      .set({
        businessName: body.businessName !== undefined ? body.businessName : row.businessName,
        businessSubtitle:
          body.businessSubtitle !== undefined ? body.businessSubtitle : row.businessSubtitle,
        businessPhone: body.businessPhone !== undefined ? body.businessPhone : row.businessPhone,
        businessPhone2:
          body.businessPhone2 !== undefined ? body.businessPhone2 : row.businessPhone2,
        businessAddress:
          body.businessAddress !== undefined ? body.businessAddress : row.businessAddress,
        warrantyTerms: body.warrantyTerms !== undefined ? body.warrantyTerms : row.warrantyTerms,
        stampTitle: body.stampTitle !== undefined ? body.stampTitle : row.stampTitle,
        taxEnabled: body.taxEnabled !== undefined ? body.taxEnabled : row.taxEnabled,
        taxRatePermille:
          body.taxRatePermille !== undefined ? body.taxRatePermille : row.taxRatePermille,
        discountCapPercent:
          body.discountCapPercent !== undefined ? body.discountCapPercent : row.discountCapPercent,
        idleLockMinutes:
          body.idleLockMinutes !== undefined ? body.idleLockMinutes : row.idleLockMinutes,
        backupRetentionDays:
          body.backupRetentionDays !== undefined
            ? body.backupRetentionDays
            : row.backupRetentionDays,
      })
      .where(eq(settings.id, row.id))
      .run();

    // Audit log
    app.db
      .insert(auditLogs)
      .values({
        userId: currentUser.userId,
        action: 'update_settings',
        details: `تحديث الإعدادات العامة للنشاط بواسطة ${currentUser.username}`,
        createdAt: new Date().toISOString(),
      })
      .run();

    return { success: true };
  });

  app.get('/audit-logs', { preHandler: authenticateRequest }, async (req, reply) => {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'manager') {
      return reply.code(403).send({ error: 'forbidden', message: 'هذا الإجراء متاح للمدراء فقط' });
    }

    const logs = app.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        username: users.username,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .all();

    return logs.sort((a, b) => b.id - a.id);
  });
}
