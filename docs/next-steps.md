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
