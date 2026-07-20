# Next Steps — Execution Plan (V1.4.0 Complete)

> Written 2026-07-20 for **any agent** (Antigravity, Cursor, Claude Code, …) to execute.
>
> **Context:** Phases 1–3 and Phase 4 Milestones D and E (V1.4.0) are complete. V1.4.0 (Commercial Packaging, Ed25519 Hardware Licensing Engine, Vendor Keygen, Inno Setup Script, License Activation Overlay) is fully implemented and verified. All 69 Vitest unit tests and 1 Playwright E2E smoke test are 100% green. Production server (esbuild bundle) and client (Vite bundle) build cleanly.
>
> Definition of done for every task below: `npm run typecheck` + `npm test` + `npm run build`
> all green, new server behavior covered by tests in `server/src/*.test.ts`
> (follow the existing `app.inject` pattern), a V1.x.y Arabic changelog section in
> `سجل-التغييرات.md`, and a local commit. **Never push.**

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
