# Next Steps — Execution Plan (post-V1.4.6 full re-audit, 2026-07-21)

> Written 2026-07-21 for **any agent** (Antigravity, Cursor, Claude Code, …) to execute.
>
> **Context:** V1.4.6 is released; Phases 1–3, Milestones D and E, and five rounds of
> desktop-app fixes (V1.4.1 → V1.4.6) are done. 72 Vitest unit tests + 1 Playwright E2E
> test green. This plan is the result of a **full re-analysis of the project** (PRD, plan,
> roadmap, design system, and code) that compared everything the docs promised against
> what the code actually does. Findings are grouped into milestones F–I below, ordered by
> severity. The condensed lessons from the V1.4.x bug-fix rounds are archived at the
> bottom — read them before touching Electron, printing, licensing, or `apiCall()`.
>
> Definition of done for every task: `npm run typecheck` + `npm test` + `npm run build`
> all green, new server behavior covered by tests in `server/src/*.test.ts` (follow the
> existing `app.inject` pattern), a V1.x.y Arabic changelog section in `سجل-التغييرات.md`,
> and a local commit. **Never push.**

---

## Audit summary — what the re-analysis found

| # | Finding | Severity | Milestone |
|---|---------|----------|-----------|
| 1 | Licensing is self-defeating: the Ed25519 **private signing key is generated and stored on the customer's machine** (`vendor-keys.json` next to `license.lic`), so anyone can forge a valid license. The embedded `VENDOR_PUBLIC_KEY_PEM` constant is an invalid placeholder and is never used by default. | Critical (commercial) | F1 |
| 2 | Master vendor PIN `1391997` is a hardcoded string in the shipped binary (trivially extractable with `strings`), and `POST /api/license/activate-pin` has **no rate limiting** (unlike login/PIN auth). | High (commercial) | F2 |
| 3 | `scripts/keygen.ts` lives **inside this repo**, violating Milestone E3's own rule ("keygen tool and private signing key live outside this repo and never ship"). | High (commercial) | F1 |
| 4 | **No idle session lock in the UI.** PRD NFR "idle session lock" and design §9 ("idle lock returns to the PIN screen; the in-progress cart survives the lock") were never built — only the server's 12h token idle expiry exists. | High | F3 |
| 5 | **Customer sale returns are missing.** plan.md §2 design rule: "Customer sale returns (after the day of sale, full or partial): reversing document that restores stock and takes cash from the *current* shift's drawer; manager permission; never edits the original invoice" (`RET-` numbering reserved in plan §2). Only full same-invoice cancellation exists. | High (business) | G1 |
| 6 | **`warranty_ending` notifications are declared but never generated** — the type exists in `server/src/routes/notifications.ts` line 14's union, but no generator emits it. PRD Phase 3 explicitly lists "expiring warranties" in the notification center. | Medium | G2 |
| 7 | **No automatic daily backup.** PRD NFR: "Automatic daily local backup"; plan architecture diagram shows a "daily job". Reality: manual manager-triggered backup + auto-backup on shift close only. No retention/pruning policy either. | Medium | G3 |
| 8 | **Arabic-normalized search covers products only** (`server/src/lib/arabic.ts`). Customer and supplier search does not normalize hamza/ta-marbuta/alef-maqsura forms — plan §2 requires it for "product/customer search". | Medium | G4 |
| 9 | **No Windows Firewall rule** is created by the NSIS installer, and the server binds `0.0.0.0` from inside `FlowPOS.exe`. LAN cashier devices (the whole point of the QR-connect feature) fail silently if the user dismisses/never sees Windows' one-time firewall prompt. | High (deployment) | H1 |
| 10 | **Sessions are in-memory** (`sessions = new Map()` in `server/src/routes/auth.ts`). Every desktop-app restart or PC reboot logs out every cashier device mid-shift. | Medium | H2 |
| 11 | **The server only runs while the desktop app runs.** The original E1 plan was a Windows service (auto-start on boot, restart on crash). `openAtLogin: true` only covers user login; closing the tray app kills the server for all LAN devices. Needs a product decision + at minimum ops-guide documentation. | Medium (deployment) | H3 |
| 12 | **DB encryption was never decided or implemented.** PRD NFR "encrypted local DB"; plan §5 open decision #1 ("decide during scaffolding") was never closed. | Medium — needs decision | H4 |
| 13 | **Camera barcode scanning is absent** (PRD stocktake: "camera or USB scanner") along with its prerequisite from plan §2: HTTPS on the LAN origin for `getUserMedia` ("solved in slice 1, not discovered in slice 5" — it never was). USB-scanner-as-keyboard works. | Medium — needs decision | H5 |
| 14 | **E4 non-technical deliverables missing**: ops guide (static IP, UPS, Africa/Tripoli timezone/drift, firewall, browser kiosk mode for silent thermal print on non-Electron cashier devices), release checklist, per-customer license contract template. | Medium (commercial) | H6 |
| 15 | **Design-system drift**: design §6 density modes (`data-density="touch|compact"`) are not implemented (0 occurrences in `web/src`); role-permission checks are 45 hard-coded `role !== 'manager'`-style conditions across 13 route files instead of the plan §2 permission table ("adding Storekeeper later is data, not code"). | Low–Medium | I1, I2 |
| 16 | **Doc drift**: `docs/plan.md` header still says "feature-complete as of V1.2.8"; `docs/roadmap.md` post-Phase-3 section stops at V1.4.0/V1.4.1 (missing V1.4.2–V1.4.6); `installer/setup.iss` (Inno Setup) is dead code superseded by electron-builder NSIS; `AGENTS.md` and `CLAUDE.md` have drifted in length/content beyond the status line. | Low | I3 |

---

## Milestone F — V1.4.7/V1.4.8: Licensing & security integrity

> The product is being sold on the strength of "Ed25519 offline licensing". Today that
> protection is cosmetic (finding #1). This milestone makes it real. **Requires the
> owner's vendor machine once** to generate the real keypair.

### F1. Real vendor keypair, embedded public key — ✅ DONE (V1.4.8, 2026-07-21)

Real Ed25519 keypair generated with a new standalone tool at
`D:\flowpos-vendor-keygen\keygen.mjs` (outside this repo, zero dependency on
FlowPOS source — plain Node.js `crypto`). `vendor_private.pem` stays there only;
`server/src/lib/license.ts`'s `VENDOR_PUBLIC_KEY_PEM` now holds the matching real
public key. `getDefaultVendorKeys()`, its `vendor-keys.json` persistence, and
`scripts/keygen.ts` (which used to live inside this repo) are all removed —
the app never generates or stores a private key again. Verified end-to-end on
this machine: a license issued by the external tool activates successfully;
a license forged with an unrelated keypair is rejected
("توقيع الترخيص غير صالح أو معدّل"). Existing dev/test licenses from before this
change no longer verify (expected — they were signed under the old insecure
per-machine keys) and need one fresh reactivation with a real vendor-issued key.

### F2. Vendor-PIN activation — ✅ REMOVED (V1.4.8, 2026-07-21, owner decision)

Owner chose to remove PIN activation entirely rather than harden it (it could
never be made cryptographically secure — any secret embedded in the binary is
extractable). `activateWithVendorPin()`, the hardcoded PIN, and
`POST /api/license/activate-pin` are deleted from the server;
`LicenseActivationScreen` now shows only the license-key form. Every customer
activates with a signed license file issued by the external vendor tool
(`D:\flowpos-vendor-keygen\keygen.mjs`) for their specific machine code — matches
the original E3 design intent.

### F3. Idle lock → PIN screen (next)

- Configurable idle timeout (Settings, default ~5 min; 0 = disabled) after which the UI
  locks to the PIN fast-switch screen. The in-progress POS cart **must survive** the lock
  (design §9) — lock is a UI overlay, not a logout; the session token stays valid.
- Unlock via the existing PIN switch endpoint (any active user may unlock as themselves —
  this is also the shift-change fast-switch pattern).
- Web-only change + one Settings field; test the Settings field server-side.

**Release as V1.4.7** (changelog: أمان).

---

## Milestone G — V1.5.0: Missing approved features

### G1. Customer sale returns (المرتجعات)

The largest genuinely missing approved feature (plan §2 design rule). Mirror of supplier
returns, on the sales side:

- Server: `sale_returns` + `sale_return_items` tables (schema.ts + `npm run db:generate`);
  document numbers `RET-YYYY-NNNNN` (same gap-free max+1-in-transaction pattern as
  sales); per-line returnable caps against the original sale minus prior returns;
  stock movement type `return` restoring base units (multi-unit aware — restore via the
  snapshot on the sale line); cash refund from the **current open shift** (blocked if no
  open shift) or customer-debt reduction for credit sales; manager-only; audit-logged;
  cancelled/fully-returned sales cannot be returned again.
- Bundles: returns operate on the component stock exactly as cancellation does (reverse
  the original sale's stock movements proportionally).
- Web: "مرتجع" action on the sale row → modal with per-line quantity pickers, refund
  method, manager PIN; A4 print of the return note via the existing print system.
- Tests: partial return caps, double-return rejection, cash-vs-credit refund paths,
  stock restoration in base units, no-open-shift rejection.

### G2. Warranty-ending notifications

- Emit `warranty_ending` items in `server/src/routes/notifications.ts` for active
  warranties expiring within a configurable horizon (mirror the existing
  `expiring_quote` generator; default 30 days).
- Web: the notification drawer already renders by type — add the icon/label mapping.
- Tests: warranty inside/outside the horizon; expired warranties excluded.

### G3. Automatic daily backup + retention

- On server boot and then on a 24h timer (and, cheaply, on a date-change check whenever a
  request arrives — the shop PC sleeps), create a daily backup via the existing
  `app.sqlite.backup()` path if none exists for today's date. Keep the last N (default
  14, Settings-configurable) daily backups; prune older ones. Never prune shift-close
  backups.
- Tests: backup-once-per-day idempotence, pruning respects N and never deletes
  non-daily files.

### G4. Arabic-normalized customer & supplier search

- Apply `server/src/lib/arabic.ts` normalization (already used for products) to customer
  and supplier name search — same shadow-column + index approach the products table uses
  (schema change + migration + backfill in the migration).
- Tests: أ/إ/آ/ا, ة/ه, ى/ي equivalences match for customers and suppliers.

**Release as V1.5.0** (changelog: ميزات جديدة / تحسينات).

---

## Milestone H — V1.5.1: Deployment & ops hardening

### H1. Windows Firewall rule at install time

- Add an NSIS `include` script (electron-builder `nsis.include`) that runs
  `netsh advfirewall firewall add rule name="FlowPOS" dir=in action=allow program="$INSTDIR\FlowPOS.exe" enable=yes profile=private`
  on install and deletes it on uninstall. The installer is already `perMachine` (elevated),
  so no extra UAC prompt.
- Verify on this machine: fresh install → phone on the same Wi-Fi reaches the QR URL
  without any firewall prompt.

### H2. Persistent sessions

- Persist sessions (token hash, userId, expiresAt) to a small SQLite table; load into the
  in-memory map on boot; delete on logout/expiry. Cashier devices then survive a desktop
  app restart. Keep the 12h idle-expiry semantics exactly.
- Tests: session survives a simulated restart (`vi.resetModules()` or re-`buildApp`
  against the same DB); expired sessions are not resurrected.

### H3. Server availability decision (document, maybe build)

Present to the owner, then implement the choice:

- **Option A (document only):** the desktop app *is* the server — ops guide says "the
  FlowPOS window/tray must stay open on the shop PC" and `openAtLogin` handles reboots
  after login. Cheapest; acceptable for a single-shop product.
- **Option B:** ship the bundled server additionally as a Windows service (NSSM,
  installed by the NSIS script) with the desktop app as a pure client. Matches the
  original E1 plan; meaningfully more moving parts (port conflicts with the in-process
  server, upgrade path, service recovery config).

### H4. DB-encryption decision (close plan §5 open decision #1)

Recommendation to put to the owner: **document BitLocker + physical control as the V1
answer** (SQLCipher would break `better-sqlite3` prebuilds, complicate backups/restore,
and the threat model is a shop PC, not a hostile host). Whatever is decided, record it in
`docs/plan.md` §5 and the ops guide, and stop advertising "encrypted DB" in
`تقرير-مميزات-المنظومة.html` unless it is actually true.

### H5. Camera-scanning decision (close plan §2 hardening item)

USB scanners work today. Camera scanning on phones requires an HTTPS LAN origin
(`getUserMedia`), which means a local CA + cert install on each device — real ops burden.
Recommendation: **defer camera scanning; document USB/keyboard-wedge scanners as the
supported path**, and note the HTTPS prerequisite in the roadmap for when it's revisited.
If the owner wants it: local CA generation on first boot, cert-install page served over
HTTP, `BarcodeDetector` with ZXing fallback in the Stocktaking and POS screens.

### H6. Ops guide + release checklist (E4 close-out)

- `docs/ops-guide.md` (or Arabic `دليل-التشغيل.md`, owner's choice): static IP for the
  shop PC, UPS requirement, Africa/Tripoli timezone + clock drift, firewall behavior,
  connecting cashier devices (QR flow), browser kiosk/silent-print setup for non-Electron
  cashier stations (`chrome --kiosk-printing`), backup/restore procedure, upgrade
  procedure (run newer installer over older; `C:\ProgramData\FlowPOS` survives).
- `docs/release-checklist.md`: build server + web → build Electron + NSIS → install on a
  clean Windows VM → smoke: activate license, login, sale, print, QR connect from phone,
  restart app (license + sessions persist), uninstall keeps data.
- Verify the upgrade path once for real: install V1.4.6 build, then install the next
  release over it, confirm DB/uploads/backups/license survive.

**Release as V1.5.1** (changelog: تحسينات / توثيق).

---

## Milestone I — V1.5.2: Design conformance & doc hygiene

### I1. Permission table (Storekeeper-ready roles)

plan §2: "Role checks live in API middleware keyed by a permission table (so adding
Storekeeper later is data, not code)." Today: 45 inline role conditions across 13 route
files. Refactor to a single `permissions.ts` map (`action → allowed roles`) consumed by a
`requireRole(action)` preHandler; keep every current behavior identical (tests must not
change except for imports). This is the prerequisite for the Phase-4-era Storekeeper role.

### I2. Design-system audit pass

Walk `docs/design.md` against the app and fix or consciously waive (recording waivers in
design.md itself):

- §6 density modes: implement `data-density="touch|compact"` tokens or amend design.md to
  match what was actually built.
- §2 signature elements: verify the receipt-cart, stamp-press moment (200ms settle, only
  orchestrated animation), perforated edges appear only where §2 allows.
- §4: one shared currency formatter everywhere (no stray `toFixed`), `.mono` + LTR
  isolation on all numerics; §13 contrast pairs on any token added since.
- `prefers-reduced-motion` disables the stamp press and receipt-line animation.

### I3. Documentation truth pass

- `docs/plan.md`: update the status header (still says V1.2.8); close §5 open decisions
  with the H3/H4/H5 outcomes.
- `docs/roadmap.md`: add V1.4.2–V1.4.6 to the post-Phase-3 list; add milestones F–I.
- Delete `installer/setup.iss` (superseded by electron-builder NSIS) or move it under a
  clearly-marked `attic/`.
- Re-sync `AGENTS.md` ↔ `CLAUDE.md` (they have drifted beyond the status line).
- `تقرير-مميزات-المنظومة.html` + `دليل-مميزات-منظومة-Flow.docx`: reflect V1.4.x desktop
  features; remove/adjust any claim the audit found untrue (encryption, camera scanning)
  until built.
- `docs/prd.md` §12: renumber the "still open" list (currently 3,4,5,6 after two struck
  items) and fold in the decisions made in H3–H5.

**Release as V1.5.2** (changelog: تحسينات واجهة / توثيق).

---

## Backlog (do only when asked)

- `bytenode` bytecode compilation (E2 phase 2).
- Windows-service server mode (if H3 picks Option A now but the owner changes their mind).
- Camera scanning + local HTTPS CA (if H5 defers it).
- Phase 4 items (cloud sync, multi-branch, payroll, payment gateway, barcode labels,
  WhatsApp sharing, installments) — **each needs explicit owner approval before any build**.

## Process checklist for the executing agent

1. Read `AGENTS.md` fully before touching code.
2. One milestone step at a time; commit locally after each green state. **Never push.**
3. Never edit `server/drizzle/*.sql` by hand — change `schema.ts` + `npm run db:generate`.
4. Update `docs/roadmap.md` and `سجل-التغييرات.md` (Arabic, per its template) when a
   milestone ships; keep `AGENTS.md` ↔ `CLAUDE.md` in sync if conventions change.
5. Milestones F2, H3, H4, H5 contain **owner decisions — ask before building**, then
   record the decision in the docs listed there.
6. If anything in this plan conflicts with reality (schema drift, renamed files), stop
   and tell the user instead of improvising.

---

## Archived lessons from the V1.4.1–V1.4.6 fix rounds (do not re-learn these)

Full narratives live in `سجل-التغييرات.md` and git history (`git log v-tags`); the
load-bearing lessons:

- **`DATA_DIR` on Windows** comes from `process.env.ProgramData` — never
  `app.getPath('appData') + '..'` (V1.4.2). Electron `userData` is
  `%APPDATA%\flowpos-desktop` (package name), not `%APPDATA%\FlowPOS` (product name),
  and uninstall does **not** clear it — stale tokens there have masked bugs before.
- **`apiCall()` refuses to run without a stored token** — pre-login surfaces (license
  screens) must use plain `fetch()`. `apiCall()` also wraps responses as
  `{ success, data }` — read `res.data.X`, never `res.X`.
- **Printing:** interactive `window.print()`/GDI dialogs on Windows are unreliable
  (orientation, no preview, and the UWP `PrintDialog` AppX can be unregistered on
  debloated images — `ensurePrintDialogRegistered()` in `electron/src/main.ts` repairs
  it). The shipped path is silent `webContents.print()` via the `flowpos:print` IPC
  bridge with per-machine printer config in `<DATA_DIR>/print-config.json`. React state
  must commit before printing — print calls are deferred with `setTimeout(..., 50)`.
- **Adapter filtering for the QR link** uses PowerShell `Get-NetAdapter`
  `InterfaceDescription` (30s cache) because `os.networkInterfaces()` names carry no
  vendor info; the helper is a no-op under `NODE_ENV=test`, and `vi.spyOn` cannot mock
  same-module ESM calls (they bind directly, not through the exports object).
- **The server runs in-process in the Electron main process** (approach #4); child-process
  and `ELECTRON_RUN_AS_NODE` approaches all failed on `better-sqlite3`/asar resolution —
  do not retry them. electron-builder's smart-unpack handles the native `.node` binary.
- **Licenses activated under V1.4.4 or earlier** were signed with a lost in-memory key
  and need one re-activation under V1.4.5+ (and will need another after F1 lands).
