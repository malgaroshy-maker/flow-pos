# Ops Guide — Running FlowPOS in a Shop

> For whoever sets up or maintains a FlowPOS installation on-site: the shop owner,
> a technician, or the vendor. Companion to `docs/plan.md` (architecture decisions)
> and `docs/next-steps.md` (the decisions this guide reflects, with their rationale).

## 1. What FlowPOS is, operationally

FlowPOS runs entirely on **one Windows PC in the shop** ("the server PC"). That PC
serves the app over the shop's WiFi/LAN to any number of cashier devices (other PCs,
tablets, phones) via a web browser — there is nothing to install on those other
devices. No internet connection is required for any core function.

**The desktop app IS the server.** There is no separate Windows service — closing the
FlowPOS window (or exiting via the system tray) stops the server for every connected
device. Keep the FlowPOS window or tray icon running on the server PC at all times
during business hours. It is configured to auto-start when Windows logs in
(`openAtLogin`), so a reboot recovers automatically — but a user manually closing it
does not restart it on its own.

## 2. One-time setup checklist

- [ ] **[MANDATORY] Static IP for the server PC** (or a DHCP reservation on the router) — if its
  LAN address changes, the QR code and any bookmarked cashier-device URLs go stale, breaking all client stations.
- [ ] **UPS (battery backup)** on the server PC — Libya's power situation makes
  unexpected outages routine; SQLite's WAL mode + `synchronous=FULL` protects against
  data corruption from a hard power loss, but a UPS avoids the interruption itself.
- [ ] **Windows Firewall**: the installer adds the required rule automatically
  (`FlowPOS`, allowing inbound LAN traffic) — no manual step should be needed. If a
  cashier device still can't connect, confirm the rule exists:
  `Get-NetFirewallRule -DisplayName FlowPOS` in an elevated PowerShell.
- [ ] **BitLocker** (Windows Settings → Privacy & Security → Device encryption, or
  `manage-bde -on C:` from an elevated prompt) — this is the app's actual answer to
  "is the database encrypted": full-disk encryption plus keeping the PC in a
  physically secured location (not SQLCipher or any in-app encryption). See
  `docs/plan.md` §5 for why.
- [ ] **Server clock & timezone**: set to `Africa/Tripoli` and confirm it isn't
  drifting — every timestamp in the system (invoices, shifts, audit log) comes from
  this clock, never from client devices.
- [ ] **Barcode scanners**: USB (keyboard-wedge) scanners work out of the box — they
  just "type" the barcode into whatever field is focused. Camera-based scanning from a
  phone/tablet is not supported (would need a local HTTPS certificate on every device);
  use USB scanners.

## 3. Connecting cashier devices & client stations

### 3.1 Mobile devices and quick browser access
1. On the server PC, open FlowPOS and click "📱 ربط الجوال (QR)" in the sidebar.
2. On the cashier device (phone, tablet, secondary PC), scan the QR code or navigate to `http://<server-ip>:3001`.
3. If the recommended address doesn't work (e.g. the device is on a different
   network segment), the modal offers a "جرّب عنواناً آخر" picker with every real LAN
   address the server detected.

### 3.2 Secondary Cashier PCs (Browser / Kiosk mode)
1. On secondary cashier PCs, open Chrome or Edge and navigate to `http://<host-ip>:3001`.
2. Create a desktop shortcut to `http://<host-ip>:3001` for quick access.
3. For silent thermal printing without print dialogs on non-Electron browser clients, configure the browser shortcut target with flags: `--kiosk --enable-print-preview --printing-ris-silent`.
4. Alternatively, install the FlowPOS Electron desktop app on the cashier PC and select **"جهاز كاشير (اتصال بخادم موجود)"** on first run to get native silent thermal printing via `flowpos:print`.

## 4. Backups & restore

- **Automatic**: a daily backup is created the first time the server is running on
  a given calendar day (checked at boot and hourly thereafter). The last 14 daily
  backups are kept by default — configurable in Settings (0 disables automatic daily
  backups; manual/shift-close backups are unaffected either way).
- **Automatic on shift close**: every time a cash drawer shift is closed, a backup is
  also taken.
- **Manual**: Settings → "إنشاء نسخة احتياطية فورية" for an on-demand backup before
  risky changes (e.g. before a restore, or before a major data cleanup).
- **Restore**: Settings lists every backup file with a "استرجاع" button. Restoring
  swaps the live database for the backup's contents — take a fresh manual backup
  first if you might need to undo the restore itself.
- Backup files live in `<install data dir>\backups\` (see §6 for where that is).

## 5. Upgrading

Running a newer `FlowPOS Setup x.y.z.exe` over an existing install:

- Preserves the database, uploads, backups, and license — they live in
  `C:\ProgramData\FlowPOS\data`, separate from the app files in `Program Files`.
- Replaces the app files and re-registers the firewall rule and shortcuts.
- Database migrations run automatically the next time the server starts — no manual
  migration step.
- **License note**: if the installer bundles a new vendor public key (a rare,
  security-relevant change — see `سجل-التغييرات.md` V1.4.8), the existing license
  file will fail verification once and the activation screen will reappear. This is
  expected; re-activate with a license key from the vendor for this machine's code.

## 6. Where things live

| What | Path |
| --- | --- |
| App files | `C:\Program Files\FlowPOS\` |
| Database, uploads, backups, license | `C:\ProgramData\FlowPOS\data\` |
| Server log | `C:\ProgramData\FlowPOS\data\server.log` (if present) |

## 7. Troubleshooting

- **A phone can't connect via the QR code**: confirm the server PC and the phone are
  on the same WiFi network (not one on WiFi and one on a mobile hotspot); confirm the
  Windows Firewall rule exists (§2); try the "جرّب عنواناً آخر" address picker.
- **Printing produces no dialog and nothing prints, or prints on the wrong printer**:
  check Settings → "طابعات الفواتير والإيصالات" (only visible inside the Electron app)
  and pick the correct A4/thermal printer explicitly instead of relying on the
  Windows default.
- **The activation screen reappears after it was already activated**: see the
  license-note in §5 above — request a fresh license key from the vendor with this
  machine's displayed code.
- **A cashier device says "session expired" right after the server PC restarted**:
  this shouldn't happen since V1.5.4 — sessions now persist across restarts. If it
  does, it means the idle timeout (12h) had already genuinely elapsed, or Settings'
  idle-lock timeout triggered (that's a UI lock requiring a PIN unlock, not a real
  logout — the difference should be visually obvious: the idle lock shows a "الشاشة
  مقفلة" screen, not a login form).
