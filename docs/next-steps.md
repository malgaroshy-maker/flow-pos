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

### F3. Idle lock → PIN screen — ✅ DONE (V1.4.9, 2026-07-21)

`idleLockMinutes` added to `settings` (migration `0015_aromatic_tomas.sql`, default 5,
0 = disabled, validated 0–120), editable in the Settings screen. `App.tsx` tracks
activity (`mousemove`/`mousedown`/`keydown`/`touchstart`/`scroll`) and shows
`IdleLockOverlay` as a sibling on top of the still-mounted app after the configured
timeout — the in-progress POS cart is untouched since nothing unmounts. Unlocks via the
existing `/api/auth/pin-switch` endpoint (any active user's PIN), same as shift-change
fast switching; a "تسجيل الخروج بدلاً من ذلك" link falls through to a real logout.
Verified end-to-end on this machine with a real 1-minute timeout: locks after the idle
window with no synthetic activity, unlocks with the manager PIN, POS state intact.
75/75 tests green (3 new: valid/invalid `idleLockMinutes`, sales-role rejected).

---

## Milestone G — V1.5.0: Missing approved features

### G1. Customer sale returns (المرتجعات) — ✅ DONE (V1.5.0, 2026-07-21)

`sale_returns` + `sale_return_items` tables (migration `0016_known_stark_industries.sql`),
`returnedQuantity` added to `sale_items`. `POST /api/sales/:id/return`: document numbers
`RET-YYYY-NNNNN` (same gap-free max+1-in-year pattern as invoices); per-line returnable
caps (`saleItem.quantity - returnedQuantity`); multi-unit-aware (restores
`quantity * conversionFactor` base units via the line's own snapshot); bundle-aware
(restores every component proportionally via `productComponents`, not just the parent);
refund method is **derived**, never a free choice — cash sales refund from the currently
open shift (blocked with `no_active_shift` if none), credit sales reduce the customer's
balance (may go negative, same as cancellation); manager-only with PIN-override fallback
matching `/sales/:id/cancel`; rejects returns against an already-cancelled sale
(`sale_cancelled`); audit-logged. Refund amount is proportional to the original invoice
total (`subtotal = total - tax + discount` reconstructed from the immutable sale row, so
tax/discount fold in correctly without recomputing at current prices).

Web: `SaleReturnModal` (self-contained, fetches the sale detail, per-line quantity
inputs capped at the returnable amount) + a "مرتجع" button next to "إلغاء الفاتورة" in
the Reports invoice log. Submitting closes the item-picker before opening the PIN
overlay — both are `fixed inset-0 z-50`, so leaving the picker mounted blocked the PIN
modal's clicks (later DOM sibling painting on top despite equal z-index actually wasn't
the failure mode — it was outright *pointer-event interception* by the still-mounted
form; confirmed via a stuck Playwright click before the fix). No A4 print template for
the return note yet — out of scope for this pass, only the toast confirmation exists.

Tests (`server/src/sale-returns.test.ts`, 5): partial cash return refunds correctly and
caps at the remaining returnable quantity; credit return reduces customer balance;
manager-only + PIN-override path; a fully-cancelled sale rejects further returns; a
bundle return restores every component proportionally. 80/80 total green.

### G2. Warranty-ending notifications — ✅ DONE (V1.5.1, 2026-07-21)

`server/src/routes/notifications.ts` now emits `warranty_ending` items for every row in
`warranties` whose `endDate` is within 30 days (≤7 days = `alert`, else `warning`),
`tab: 'Warranty'`. The drawer already rendered generically by `severity`/`title`/
`message`/`tab` (no per-type icon mapping exists in this codebase) so no web change was
needed. Test added to `notifications.test.ts`: sells an equipment item to auto-create a
warranty, force-updates its `endDate` to 10 days out (directly via `app.db`, since a real
sale bakes in the full `warrantyMonths` term), confirms it surfaces at `warning` severity.

### G3. Automatic daily backup + retention — ✅ DONE (V1.5.2, 2026-07-21)

`server/src/lib/autoBackup.ts`'s `runDailyBackupIfNeeded()` creates
`pos_backup_auto_daily_YYYY-MM-DD.db` if today's doesn't exist yet, then prunes daily
backups beyond `settings.backupRetentionDays` (default 14, 0 = disabled). Wired into
`server/src/index.ts` only (never `buildApp()`, so the ~70 test files that call
`buildApp()` directly are completely unaffected) — runs once at boot and then hourly via
`setInterval`, so a day rollover is caught even if the process itself never restarts
(the "shop PC sleeps" scenario from plan.md's hardening notes). Verified on this machine
with a real (non-Electron) server boot: `pos_backup_auto_daily_2026-07-21.db` appeared
in `server/data/backups/` within seconds of startup. Settings screen exposes the
retention count. Tests (`autoBackup.test.ts`, 3): idempotent same-day calls, disabled at
0, and pruning respects the count while leaving manual/shift-close backups untouched.
84/84 total green.

### G4. Arabic-normalized customer & supplier search — descoped, finding corrected (2026-07-21)

The original audit assumed a search box exists for customers/suppliers that just needs
normalization (matching products, which filters in-memory with `normalizeArabic()` — no
shadow column or index actually exists anywhere in this codebase, unlike what plan.md §2
originally described; correct that expectation in future audits). On inspection: **no
such search box exists**. `Customers.tsx` and `Purchases.tsx`/Suppliers render full
tables with no filter input; the POS credit-customer picker (`Pos.tsx`) is a plain
native `<select>`, which has no meaningful "normalize the query" hook to attach to.

This is not a contained bug fix — it requires designing new search UI (a text filter for
the two tables, and probably a searchable combobox to replace the native `<select>` for
real usability once the customer list grows past a couple dozen names). Re-scope as a
small UX feature if wanted:

- Add a debounced text filter above the Customers and Suppliers tables, filtering
  client-side with `normalizeArabic()` (matches the products precedent — no server
  round-trip needed at this data scale).
- Replace the POS customer `<select>` with a searchable combobox (type-to-filter,
  same normalization) — the highest-value spot, since finding a credit customer
  mid-sale is the actual daily friction point.
- Tests: أ/إ/آ/ا, ة/ه, ى/ي equivalences match in the new filter.

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
