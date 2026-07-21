import { describe, it, expect, vi, afterEach } from 'vitest';
import os from 'node:os';
import { buildApp } from './app';
import { openDatabase } from './db/index';

// getWindowsAdapterDescriptions() (server/src/routes/settings.ts) is a no-op
// under NODE_ENV=test — it never shells out to PowerShell here — so
// /api/network/info's virtual-adapter filter falls back to matching the
// interface's own name (its second, OR'd check). These tests use adapter
// names descriptive enough to exercise that fallback directly; the
// description-based path (the real behavior on an actual Windows machine,
// where adapters are typically named generically like "Ethernet 3") is not
// covered here since it would require shelling out for real.
describe('GET /api/network/info', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockInterfaces(interfaces: Record<string, Array<{ address: string; family: string; internal: boolean }>>) {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue(interfaces as any);
  }

  it('filters out virtual adapters (VirtualBox, VPN, Docker) and recommends the Wi-Fi/Ethernet address', async () => {
    mockInterfaces({
      'VirtualBox Host-Only Network': [{ address: '192.168.56.1', family: 'IPv4', internal: false }],
      'Ethernet 2': [{ address: '192.168.1.70', family: 'IPv4', internal: false }],
      'Wi-Fi': [{ address: '192.168.1.16', family: 'IPv4', internal: false }],
      'Loopback Pseudo-Interface 1': [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    });

    const sqlite = openDatabase(':memory:');
    const app = buildApp(sqlite);
    const res = await app.inject({ method: 'GET', url: '/api/network/info' });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);

    expect(data.ips).not.toContain('192.168.56.1');
    expect(data.ips.sort()).toEqual(['192.168.1.16', '192.168.1.70'].sort());
    expect(data.recommendedUrl).toBe('http://192.168.1.16:3001');
  });

  it('falls back to the unfiltered list when every adapter looks virtual', async () => {
    mockInterfaces({
      'VirtualBox Host-Only Network': [{ address: '192.168.56.1', family: 'IPv4', internal: false }],
    });

    const sqlite = openDatabase(':memory:');
    const app = buildApp(sqlite);
    const res = await app.inject({ method: 'GET', url: '/api/network/info' });
    const data = JSON.parse(res.payload);

    expect(data.ips).toEqual(['192.168.56.1']);
    expect(data.recommendedUrl).toBe('http://192.168.56.1:3001');
  });
});
