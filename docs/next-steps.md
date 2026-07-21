# Next Steps — Execution Plan (V1.4.1 Complete)

> Written 2026-07-20 for **any agent** (Antigravity, Cursor, Claude Code, …) to execute.
>
> **Context:** Phases 1–3 and Phase 4 Milestones D and E (V1.4.0 & V1.4.1) are complete. V1.4.1 (Electron Native Desktop Application, Commercial Packaging, Ed25519 Hardware Licensing Engine, Instant Master Vendor PIN Activation `1391997`, Flow Dev Branding `logo.png`, System Tray, Splash Screen, Single-file NSIS Installer `FlowPOS Setup 1.4.1.exe`) is fully implemented, verified, and tested locally. All 69 Vitest unit tests, local packaged binary launch with in-process Fastify server + health check, and 1 Playwright E2E smoke test are 100% green. Production server (esbuild bundle), client (Vite bundle), and Electron main app build cleanly.
>
> Definition of done for every task below: `npm run typecheck` + `npm test` + `npm run build`
> all green, new server behavior covered by tests in `server/src/*.test.ts`
> (follow the existing `app.inject` pattern), a V1.x.y Arabic changelog section in
> `سجل-التغييرات.md`, and a local commit. **Never push.**

---

## ✅ RESOLVED: QR "connect a cashier device" showed multiple confusing addresses (2026-07-21, shipped as V1.4.6)

**User-reported:** "why there are more than one address that may not work and confuse the
users" — the QR modal listed 3 addresses (`192.168.56.1`, `192.168.1.70`, `192.168.1.16`),
only one of which (the real Wi-Fi adapter) is actually reachable from a phone.

**Root cause:** `os.networkInterfaces()` only exposes Windows' generic per-connection name
("Ethernet 3"), never the real driver identity. On this dev machine, "Ethernet 3" turned
out to be a VirtualBox host-only adapter and "Ethernet 2" a Siemens PLCSIM industrial
simulator — both indistinguishable from a real NIC by name alone. An earlier attempt at
name-based filtering (matching `/virtualbox|vmware|.../i` against the interface name)
looked correct in a hand-written test but did nothing on the real machine, because the
name itself carries no vendor information.

**Fix:** `server/src/routes/settings.ts` now calls `Get-NetAdapter | Select-Object Name,
InterfaceDescription` via PowerShell (Windows only, 30s in-memory cache) and filters based
on the real `InterfaceDescription` ("VirtualBox Host-Only Ethernet Adapter", "Siemens
PLCSIM Virtual Ethernet Adapter", …), falling back to matching the interface's own name
when no description is available (non-Windows, or the PowerShell call fails) — which is
also what the test suite exercises, since `getWindowsAdapterDescriptions()` is a deliberate
no-op under `NODE_ENV=test` (shelling out during tests is both slow and environment-
dependent; an earlier attempt to `vi.spyOn` it out didn't work — ESM same-module function
calls bind directly, not through the exports object, so the "mocked" version silently fell
through to a real, slow PowerShell call that only passed because it coincidentally matched
this dev machine's real adapters).

`web/src/components/NetworkConnectModal.tsx` also no longer opens with a dropdown of every
candidate — it leads with the server's `recommendedUrl` (Wi-Fi preferred, then Ethernet)
and only reveals the "try another address" picker on demand.

**Verified:** `npm run build` (typecheck clean) + Vitest 72/72 green, and confirmed for
real on this machine via the actual packaged build — `GET /api/network/info` now returns
only `192.168.1.16`, both virtual adapters correctly excluded.

---

## ✅ RESOLVED: License re-activation required on every app restart (2026-07-21, shipped as V1.4.5)

**Symptom (user-reported):** "do i have to register the program everytime i open it, i always
see the license screen when i re open the system."

**Root cause:** `getDefaultVendorKeys()` in `server/src/lib/license.ts` generated a random
Ed25519 keypair and cached it **only in memory** (`defaultKeysCache`, a module-level
variable). Every real app restart starts a brand-new Node process, so that cache is empty
again — the function silently generated a **different** random keypair each time. A
license file signed with process N's private key can never verify against process N+1's
freshly-generated public key, so `getLicenseInfo()` reported the signature invalid and the
activation screen reappeared, even though the license itself was never actually wiped.

**Fix:** the keypair is now persisted to `<DATA_DIR>/vendor-keys.json` (same directory as
`license.lic`), generated once on first use and reloaded on every subsequent call —
including across process restarts.

**Verified:**
- New regression test in `server/src/license.test.ts` — uses `vi.resetModules()` + a
  differently-queried dynamic import of `./lib/license` to simulate two separate process
  loads against the same on-disk key file, and confirms a license signed under the first
  "process" verifies under the second.
- Real end-to-end test on this machine using the actual packaged build
  (`dist-installer/win-unpacked/FlowPOS.exe`): activated via vendor PIN, then killed and
  relaunched the process three times in a row (a genuine restart, not a page reload) —
  `GET /api/license/info` returned `active: true` every time with no reactivation needed.
- `npm run build` (typecheck clean) + Vitest 70/70 green.

**Important for anyone who activated under V1.4.4 or earlier:** that license was signed
with a since-lost in-memory key and will fail to verify once — activate one more time
after upgrading to V1.4.5, and it will then stay active permanently across restarts.

---

## ✅ RESOLVED (round 4): Switched printing to silent (no dialog) + real in-app preview (2026-07-21, shipped as V1.4.4)

After the V1.4.3 landscape-orientation fix, the user tested again with a real
printed invoice: the dialog still defaulted to Landscape, and separately showed
"This app doesn't support print preview." Both are the same root cause — Electron
on Windows drives the *interactive* print dialog through the legacy GDI print
path, which doesn't reliably honor `landscape`/`pageSize` options and has no
preview capability at all. This is a platform limitation, confirmed by two
rounds of testing, not something fixable by passing different options.

**Fix, agreed with the user via AskUserQuestion:** switched to silent printing
end to end.

- `electron/src/main.ts`: `flowpos:print` now calls `webContents.print()` with
  `silent: true` (plus `landscape: false`, `pageSize: 'A4'` for documents) —
  no OS dialog, so orientation/size are fully under the app's control and the
  earlier windowless-dialog bug (`ensurePrintDialogRegistered`) can't recur
  either way. Printer choice persists per-machine in
  `<DATA_DIR>/print-config.json` via new `flowpos:list-printers` /
  `flowpos:get-print-config` / `flowpos:set-print-config` IPC handlers.
- `web/src/screens/Settings.tsx`: new "طابعات الفواتير والإيصالات" card (only
  rendered when `window.flowpos` exists, i.e. inside Electron) to pick a
  separate A4 printer and thermal 80mm printer, defaulting to Windows' own
  default printer when left unset.
- `web/src/print/PrintPreviewFrame.tsx` (new): scaled on-screen wrapper reusing
  the *actual* print components (`InvoiceA4`, `ThermalReceipt`, `QuotationA4`,
  `PurchaseA4`) so what you see is exactly what prints.
- `web/src/print/PrintPreviewModal.tsx` (new): generic preview+print modal for
  quotations and purchase invoices, which previously printed instantly with no
  preview at all. `App.tsx`'s `handleSaveQuotation`, `handleOpenQuotationPrint`,
  `handleOpenPurchasePrint` now open this instead of calling `triggerPrint()`
  directly.
- The existing sale invoice/thermal print modal in `AppModals.tsx` (which
  already had override-editing fields for customer name/stamp/warranty notes)
  now also renders a live `PrintPreviewFrame` instead of just the form.
- Customer/supplier statement print buttons already rendered `StatementA4`
  inline as their own preview before this — left as is, just benefits from
  silent printing now.

**Verified:** `npm run build` (typecheck clean, both server and web), Electron
`tsc --noEmit` clean, Vitest 69/69 green, `dist-installer\FlowPOS Setup
1.4.4.exe` built successfully. **Not yet verified end-to-end through the
installed app** — pushed at the user's request while they were away; when back,
install `FlowPOS Setup 1.4.4.exe`, print an invoice and confirm no dialog
appears and the PDF/paper comes out correct, and check the new printer
dropdowns in Settings list real printers.

---

## ✅ RESOLVED (round 3): QR network link showed `localhost`; printing produced blank/stale pages (fixed 2026-07-21, shipped as V1.4.3)

Reported after V1.4.2 was installed and both earlier issues confirmed fixed. Two
unrelated bugs, found by direct investigation on this machine (not guesswork):

**1. QR "connect a cashier device" modal always showed `http://localhost:3001`.**
`web/src/components/NetworkConnectModal.tsx` read `res.urls` directly off the
return value of `apiCall()`. But `apiCall()` always wraps successful responses as
`{ success: true, data: <body> }` — so `res.urls` was always `undefined`, the
`Array.isArray(res.urls)` check always failed, and the code fell through to
`window.location.hostname`, which inside Electron is literally `"localhost"`
(the window loads `http://localhost:3001`). The backend endpoint
(`GET /api/network/info`) was never broken — confirmed via direct `curl` that it
correctly returns real LAN IPs (`192.168.1.16`, etc.). Fix: read `res.data.urls`.

**2. Printing (invoice, quotation, purchase, statements) produced a blank or
stale page.** Five call sites did `setActivePrintDocument(doc); window.print();`
back to back in the same synchronous tick. React doesn't commit a state update to
the DOM until the current call stack finishes, and `window.print()` captures the
page's *current* DOM state — so it printed whatever was there *before* the new
document was set, not the new one. Fixed by deferring the print call with
`setTimeout(..., 50)` in all five spots (`App.tsx` ×3, `AppModals.tsx` ×2).

**3. Separately, direct testing on this machine also surfaced that Windows'
native print dialog (`PrintDialog.exe`, the modern UWP Print UI) can launch as a
process with `MainWindowHandle: 0` — i.e. no visible window at all — when its
per-user AppX registration is missing. Confirmed via Chrome DevTools Protocol
(`Runtime.evaluate` against the packaged app) that `window.print()` really was
invoking the OS dialog broker; the broker just never rendered. `Get-AppxPackage
-Name "Windows.PrintDialog"` returned nothing on this machine; running
`Add-AppxPackage -DisableDevelopmentMode -Register
'C:\Windows\SystemApps\Windows.PrintDialog_cw5n1h2txyewy\AppxManifest.xml'`
(a per-user, non-admin operation) fixed it immediately. This is a known issue on
debloated/OEM-trimmed Windows images — plausible for cheap shop PCs in this
product's target market — so the app now runs this same check-and-repair
automatically at startup (`ensurePrintDialogRegistered()` in
`electron/src/main.ts`), and printing was also switched from the renderer's
`window.print()` to a main-process `webContents.print()` call via a new
`window.flowpos.print()` IPC bridge (`preload.ts` + `flowpos:print` handler),
which is Electron's documented, more reliable path.

**Verified:** `npm run build` (typecheck clean) and Vitest 69/69 both green.
Confirmed via direct `GET /api/network/info` call that real LAN IPs are
returned, and via CDP that the rebuilt bundle hash matches the new build.
**Not yet verified end-to-end through the actual installed app** — a silent
elevated reinstall attempt during this session triggered a UAC prompt that was
cancelled, so the perMachine NSIS installer needs to be run interactively by a
human. `dist-installer\FlowPOS Setup 1.4.3.exe` is built and ready; run it,
then confirm: QR modal shows a real `192.168.x.x` address, and printing an
invoice/quotation/statement actually opens a usable print dialog.

---

## ✅ RESOLVED (round 2): Activation screen stuck on "لم يتم الاتصال" / machine code `----` (fixed 2026-07-21)

**This is a *second, separate* bug from the `DATA_DIR` fix below** — found after the
user reinstalled with that fix and still hit the activation screen showing a
connection-error banner and empty machine code, even though `server.log` showed the
server started cleanly this time (no `_journal.json` error) and `curl` against
`/api/health` and `/api/license/info` both worked fine.

**Root cause:** `web/src/lib/api.ts`'s `apiCall()` helper refuses to send a request at
all when there is no stored auth token — it short-circuits with
`{ success: false, error: 'no_token' }` before ever touching the network. The license
activation screen runs **before login**, so on a genuinely fresh install/profile there
is no token yet. `checkLicenseStatus()` in `App.tsx` and both activation handlers in
`LicenseActivation.tsx` were calling `/api/license/info`, `/api/license/activate-pin`,
and `/api/license/activate` through `apiCall()` — so every attempt failed locally
without ever reaching the server, retried 30× over 24s, then permanently showed the
"can't connect" banner with `machineCode: '----'`. It only *appeared* to work on this
dev machine because a stale token was left over in Electron's `userData` (which
uninstalling the app does not clear) from earlier manual testing — bearing any
non-empty (even garbage) token was enough to make `apiCall()` proceed, and the server
doesn't actually gate `/api/license/*` on auth at all (confirmed in
`server/src/app.ts`'s license-exempt `onRequest` hook).

**Fix:** `checkLicenseStatus()` and both activation submit handlers now use a plain
unauthenticated `fetch()` instead of `apiCall()`, matching the server's actual
contract for these pre-login routes.

**Verified:** wiped Electron's real `userData` directory
(`%APPDATA%\flowpos-desktop`, *not* `%APPDATA%\FlowPOS` — the productName and the
package.json `name` differ) so no stale token could mask the bug, confirmed via grep
that no `pos-token` string existed in the fresh LevelDB `localStorage` files,
reinstalled V1.4.2, launched, confirmed `/api/license/info` returns
`active: false` with a real machine code, then activated via the same
unauthenticated-`fetch` path the UI now uses — succeeded. Full Vitest suite: 69/69.

---

## ✅ RESOLVED (round 1): Electron Packaged App — Server Does Not Start (fixed 2026-07-21)

**Root cause found in `server.log`** (which the 2026-07-20 session hadn't inspected for
a fresh run): `Error: Can't find meta/_journal.json file` — an early crash, not a hang.
The 60s-timeout / retry fixes from the previous session (`25ffb3f`, `bf77f75`,
`2d96236`, `19af81f`) papered over the symptom on later attempts but didn't fix the
actual cause, which was a second, separate bug in `DATA_DIR`.

**The real bug:** `electron/src/main.ts` computed the machine-wide data directory as
`join(app.getPath('appData'), '..', 'ProgramData', 'FlowPOS', 'data')`. On Windows,
`getPath('appData')` is `C:\Users\<user>\AppData\Roaming`, so `..` lands on
`C:\Users\<user>\AppData`, and the code then appended a `ProgramData` subfolder there —
**not** the real `C:\ProgramData`. This directory doesn't exist by default and isn't
what any other part of the system expects, so migrations/DB paths ended up inconsistent
between runs and installs, producing the observed flakiness (worked in one dev
`win-unpacked` test, failed after a real install to `Program Files`).

**Fix applied:** `DATA_DIR` now reads the real machine-wide path from
`process.env.ProgramData` (always set on Windows), falling back to
`app.getPath('appData') + '..'` only on non-Windows platforms:

```ts
const COMMON_APP_DATA = process.env.ProgramData || join(app.getPath('appData'), '..');
const DATA_DIR = join(COMMON_APP_DATA, 'FlowPOS', 'data');
```

(Electron's `app.getPath()` has no built-in `'commonAppData'` key — that was tried
first and rejected by the TypeScript types.)

**Verified locally end-to-end on this machine (2026-07-21):**
1. Uninstalled any prior FlowPOS install, wiped `C:\ProgramData\FlowPOS`,
   `C:\Users\<user>\AppData\ProgramData\FlowPOS` (the old wrong path), and
   `Program Files\FlowPOS`.
2. Rebuilt server + web (`npm run build`) and the Electron app + installer
   (`npm run dist` in `electron/`).
3. Silent-installed the fresh `FlowPOS Setup 1.4.1.exe` (`/S`) — landed at
   `C:\Program Files\FlowPOS` (default, since no prior custom install dir existed).
4. Launched `FlowPOS.exe` directly (simulating a real customer double-click).
5. `server.log` showed `DB path: C:\ProgramData\FlowPOS\data\pos.db` (correct) and no
   errors.
6. `GET /api/health` → `200` within seconds.
7. `GET /api/license/info` → fresh machine code, `active: false` (correct first-run
   state).
8. `POST /api/license/activate-pin` with the master vendor PIN → activation succeeded.
9. Full Vitest suite: 69/69 green.

**Historical symptom (kept for context — do NOT re-attempt these):**

After installing an older build, the app opened but showed either an infinite loading
spinner or the activation screen with machine code `----`, because the server crashed
on the wrong `DATA_DIR` path before ever binding to the port.

**What was tried and failed in the prior session (do NOT repeat these — the eventual
fix kept the current approach, #4 below, and just corrected the data path):**

1. **Child process with `node.exe`** — `better-sqlite3` ABI mismatch and missing
   `node_modules` next to a standalone `node.exe`.
2. **`ELECTRON_RUN_AS_NODE=1` with `process.execPath`** — `app.asar` path resolution
   breaks when Electron is invoked as plain Node.
3. **`extraFiles` copying `server/` directory** — wrong `better-sqlite3` native
   binary path resolution outside the dev machine.
4. **In-process `await import(SERVER_SCRIPT)`** — kept; this was never actually the
   problem. The server runs in the Electron main process directly, and
   electron-builder's smart-unpack correctly puts `better-sqlite3`'s native `.node`
   binary in `app.asar.unpacked` automatically (confirmed via `npx asar list`).

---

## Milestone C — V1.3.4: Security hardening, dependencies, doc sync

### C1. Server-side role gates (security)

The V1.3.3 audit found manager-only data reachable by any authenticated role — the
client stopped calling these for the sales role, but the server never enforced it:

- `POST /api/backup` and `GET /api/backup/list` (`server/src/routes/backup.ts`) have
  **no role check at all** (only `/backup/restore` is gated).
- Audit: verify `/api/audit-logs` and every other manager-only route is gated
  **server-side**, not just hidden in the UI.

Implementation: add a shared `requireManager` preHandler (e.g. in
`server/src/lib/auth.ts` or wherever `authenticateRequest` lives) and use it instead
of the copy-pasted inline `role !== 'manager'` checks across the 13 route files.
`GET /api/auth/users` **stays open to all authenticated users** — PIN fast-switching
depends on it and it only returns id/username/role/active.

Tests: for each newly gated endpoint, sales token → 403 (Arabic error message),
manager token → success.

### C2. npm audit cleanup

`npm audit` (2026-07-20): 8 vulnerabilities (7 moderate, 1 high), all transitive:

- `drizzle-kit` → `@esbuild-kit/*` → old `esbuild` (dev-time advisory). Fix by
  upgrading `drizzle-kit` (and `drizzle-orm` in lockstep if required) to current.
  After upgrading: `npm run db:generate` must produce **no new migration** for an
  unchanged schema, and existing migrations must still apply to a copy of the DB.
- `exceljs` → vulnerable `uuid` (runtime). Fix via npm `overrides` pinning
  `uuid@^11` — do **not** downgrade exceljs to 3.4.0.

Verify: full test suite + a real `/api/reports/excel` download opens as valid xlsx.

### C3. Documentation sync

- `CLAUDE.md` + `AGENTS.md`: project status still says "feature-complete (V1.3.2)" —
  update to reflect V1.3.3+ and Phase 3 completion. Keep the two files in sync.
- `تقرير-مميزات-المنظومة.html` (customer-facing features report): Phase 3 features
  (stocktaking, reports/charts/Excel, notification center, warranty & service
  tickets) are essentially absent — add them in the report's existing style.

**Release as V1.3.4** (changelog sections: أمان / إصلاحات / توثيق).

---

## Milestone D — V1.3.5: Backlog features + E2E safety net

### D1. Supplier statement of account

Mirror of the customer statement (same UX and print layout):

- Server: `GET /api/suppliers/:id/statement?from=&to=` returning a sign-preserving
  running-balance ledger — purchases increase supplier debt, supplier payments and
  supplier returns (debt-reduction refunds) decrease it. Integer milli-LYD.
- Web: statement modal in the Suppliers screen with date-range filter, printable A4
  via the existing `StatementA4` template (parameterize customer/supplier labels).
- Tests: running balance against seeded purchase/payment/return fixtures; date
  filtering; unknown supplier → 404.

### D2. Purchase invoice A4 print view

- `web/src/print/PurchaseA4.tsx` following the existing print-system contract
  (props in, JSX out, rendered through `PrintRoot`, `.print-only` CSS path).
- Print button on each purchase row/detail in the Purchases screen.
- No server changes.

### D3. Playwright smoke test (planned in docs/plan.md §4, never built)

- One spec covering the core loop: login → open shift → POS sale → print modal
  renders invoice → cancel invoice with manager PIN (stock restored) → close shift.
- Runs against a scratch DB (never `server/data/pos.db`).
- Wire as `npm run test:e2e` at the root — **not** part of `npm test` (keep the
  unit suite fast and offline).

**Release as V1.3.5** (changelog sections: ميزات جديدة / توثيق).

---

## Milestone E — V1.4.0: Commercial distribution (closed-system packaging)

> **Owner-approved 2026-07-20.** The system is sold as a licensed closed product:
> the customer receives an installer and a working system — never source code.
> Keep the GitHub repo private. The keygen tool and private signing key live
> **outside this repo** and never ship.

### E1. Windows installer (Inno Setup)

- Bundle: portable Node.js runtime + compiled server + `web/dist` + migrations.
  Customer never sees npm or a terminal.
- Install app to `Program Files`, DB + backups + uploads to `ProgramData`
  (writable, survives upgrades).
- Register the server as a **Windows service** (NSSM or node-windows): auto-start
  on boot, restart on crash/power cut.
- Open a Windows Firewall rule for LAN access; show the server's LAN address/QR at
  the end of install so cashier devices can connect.
- Desktop shortcut opens the app in the default browser.
- **Upgrade path**: running a newer installer over an older install preserves
  `ProgramData` and replaces the app; migrations-on-boot handles the DB.

### E2. Source protection

- Bundle + minify the server with `esbuild` into a single file
  (`better-sqlite3`'s native `.node` binary ships alongside).
- Phase 2 of protection (optional, later release): compile the bundle to V8
  bytecode with `bytenode` — requires exact Node version match, which we control
  since we ship the runtime.
- Web app: Vite's minified build is sufficient (browser code is never protectable).

### E3. Offline license activation

- First run without a license → activation screen showing a **machine code**
  (fingerprint of stable hardware identifiers).
- Vendor-side keygen (separate private repo/folder) signs
  `{machineCode, customerName, issuedAt, supportExpiry?}` with an **Ed25519
  private key**; the app verifies with the embedded public key. Zero internet.
- License file lives in `ProgramData`; invalid/missing/mismatched-machine license
  → activation screen only, no data access, existing DB untouched.
- Supports: time-limited demo licenses, per-customer name shown in the app,
  optional support/updates expiry (system keeps working; updates stop).
- Tests: signature verification, machine mismatch rejection, demo expiry.

### E4. Non-technical

- Per-customer sales contract: software licensed per location, not sold.
- Release checklist doc for building an installer (build → bundle → installer →
  smoke-test on a clean Windows VM).

---

## Backlog (do only when asked — not part of the milestones)

- Server-side gate review for any remaining role-sensitive read endpoints.
- `bytenode` bytecode compilation (E2 phase 2).
- Phase 4 items (cloud sync, multi-branch, installments…) — **each needs explicit
  owner approval before any build** (see roadmap).

## Process checklist for the executing agent

1. Read `AGENTS.md` fully before touching code.
2. One milestone step at a time; commit locally after each green state. **Never push.**
3. Never edit `server/drizzle/*.sql` by hand — change `schema.ts` + `npm run db:generate`.
4. Update `docs/roadmap.md` and `سجل-التغييرات.md` (Arabic, per its template) when a
   milestone ships; keep `AGENTS.md` ↔ `CLAUDE.md` in sync if conventions change.
5. If anything in this plan conflicts with reality (schema drift, renamed files),
   stop and tell the user instead of improvising.
