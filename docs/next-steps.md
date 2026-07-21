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

### H1. Windows Firewall rule at install time — ✅ DONE (V1.5.3, 2026-07-21)

`electron/installer.nsh` (`customInstall`/`customUnInstall` NSIS macros, wired via
`nsis.include` in `electron/package.json`) adds a `netsh advfirewall firewall add rule
name="FlowPOS" ... profile=private,domain` rule on install and deletes it on uninstall
(also deletes any stale rule before re-adding, so re-installs stay idempotent). The
installer is already `perMachine` (elevated), so no extra UAC prompt beyond the one the
installer already triggers.

Verified: `npm run dist` in `electron/` builds `FlowPOS Setup 1.5.2.exe` successfully
with the NSIS include compiling cleanly (would fail the build on a syntax error); the
bare `netsh advfirewall firewall add rule ...` invocation was tested directly on this
machine and confirmed well-formed (rejected only for lack of elevation in an unprivileged
shell — the expected difference from running inside the installer's elevated context).
**Not yet verified end-to-end** — a real silent (`/S`) reinstall attempt on this machine
hits a UAC prompt an agent can't answer (documented limitation from the V1.4.x rounds);
a human needs to run `FlowPOS Setup 1.5.2.exe` interactively once and confirm
`Get-NetFirewallRule -DisplayName FlowPOS` (or the Windows Defender Firewall UI) shows
the rule, then test a phone connecting via the QR code on the same Wi-Fi.

### H2. Persistent sessions — ✅ DONE (V1.5.4, 2026-07-21)

New `sessions` table (migration `0018_round_charles_xavier.sql`: `token` PK, `userId`,
`username`/`role` snapshot, `expiresAt`). `createSession()` (login, PIN-switch) now
inserts into both the in-memory map and the table; `authenticateRequest` renews
`expiresAt` in both on every request (writes via `req.server.db` since it's a bare
preHandler shared across route files, not closed over a specific `app`); logout deletes
both. `loadPersistedSessions(db)` rehydrates the map at boot and drops already-expired
rows — wired into `server/src/index.ts` only, never `buildApp()`, so no test file is
affected. Idle-expiry semantics unchanged (12h). Note: the plan's original "token hash"
suggestion wasn't followed — tokens are already high-entropy random bearer tokens
(`randomBytes(32)`), and this is a local single-shop SQLite file, not a
multi-tenant/cloud store, so storing them directly matches the trust model already used
elsewhere in this app (e.g. `license.lic`).

Tests (`session-persistence.test.ts`, 2, using the same `vi.resetModules()` +
differently-queried dynamic import technique as `license.test.ts`): a session created via
a real HTTP login in one simulated "process" is loaded correctly by
`loadPersistedSessions()` in a fresh module graph; an already-expired row is dropped, not
resurrected. Verified end-to-end on a real (non-Electron) server restart on this machine:
killed and relaunched the `tsx watch` process, confirmed a token issued before the
restart still authenticated (`GET /api/notifications` → 200) after it. 86/86 total green.

### H3. Server availability decision — ✅ DECIDED (2026-07-21, owner: document only)

Owner chose **Option A**: the desktop app *is* the server, no separate Windows service.
Recorded in `docs/plan.md` §5 item 6 and `docs/ops-guide.md` §1 — the FlowPOS
window/tray must stay open on the shop PC; `openAtLogin` already covers reboots. The
Windows-service alternative (Option B, NSSM) stays unbuilt; revisit only if the owner
changes their mind later (real cost: port conflicts with the in-process server, a new
upgrade path, service recovery config).

### H4. DB-encryption decision — ✅ DECIDED (2026-07-21, owner: BitLocker)

Owner chose **BitLocker + physical control**, not SQLCipher/app-level encryption.
Recorded in `docs/plan.md` §5 item 1 and `docs/prd.md` §9/§12 item 9 (NFR table
corrected to say so explicitly instead of an unqualified "encrypted DB"); confirmed
`تقرير-مميزات-المنظومة.html` never actually claimed DB encryption in the first place
(only the original PRD HTML's NFR table did, which is a historical source document, not
something this pass rewrites).

### H5. Camera-scanning decision — ✅ DECIDED (2026-07-21, owner: defer)

Owner chose to **defer camera scanning indefinitely**; USB/keyboard-wedge scanners are
the documented supported path (`docs/ops-guide.md` §2). Recorded in `docs/plan.md` §5
item 5 and `docs/prd.md` §7/§12 item 10. Revisit only if explicitly requested — the
local-CA + per-device cert-install work described in the original finding is still the
right shape if that happens.

### H6. Ops guide + release checklist — ✅ DONE (2026-07-21)

- `docs/ops-guide.md`: static IP, UPS, BitLocker, firewall (now automatic per H1),
  server clock/timezone, USB scanner requirement (per H5), connecting cashier devices
  (QR flow), backup/restore (now automatic per G3), upgrade path, troubleshooting.
- `docs/release-checklist.md`: build/test/typecheck steps, changelog/doc-sync
  checklist, and an explicit "needs a human" install-verification section (silent
  installs of this `perMachine` NSIS package can't get past the UAC prompt in an
  automated agent context — documented, not worked around).
- `docs/plan.md` §5 and `docs/prd.md` §12 updated to close out the H3/H4/H5 decisions
  and correct several already-stale "decide in Phase 2" open questions that Phase 2
  had, in fact, already answered (credit limits, multi-unit opt-in).

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

### I3. Documentation truth pass — partially done (2026-07-21)

Done as part of V1.5.5 (Milestone H6, see above — a bigger doc pass than originally
scoped here happened alongside it):

- `docs/plan.md`: status header updated; §5 open decisions closed with the H3/H4/H5
  outcomes.
- `docs/roadmap.md`: V1.4.2–V1.5.5 all present in the post-Phase-3 list; Milestones F–I
  (this file) referenced.
- `installer/setup.iss` moved to `attic/setup.iss.superseded-by-electron-builder-nsis`
  (kept, not deleted, in case anyone wants the history — but never used by any build
  script; the real installer config lives in `electron/package.json`'s `build.nsis`).
- `AGENTS.md` ↔ `CLAUDE.md`: status line, migration reference, and Source-of-Truth doc
  list re-synced (they had drifted past just the status line — the two files keep
  different internal structure by design, `AGENTS.md`'s own header says so, but the
  substantive facts now match).
- `docs/prd.md` §12: renumbered and closed out, including two items that were already
  answered by Phase 2's shipped implementation (credit limits, multi-unit opt-in) but
  had never been marked resolved; folded in the H3–H5 decisions.

**Not done — bigger than a doc-sync pass, needs its own session:**

- `تقرير-مميزات-المنظومة.html` (customer-facing features brochure, Arabic) is stuck at
  "الإصدار V1.3.2" and "51 اختباراً" — it doesn't claim anything false (no DB-encryption
  or camera-scanning claims found), but it's missing all of V1.4.0 onward: commercial
  licensing, the Electron desktop app, print reliability fixes, the idle lock, sale
  returns, automatic backups, the firewall fix — a real content-writing task in the
  brochure's established Arabic tone, not a mechanical sync. Write a new "الجديد في
  الإصدارات V1.4–V1.5" section before the next customer-facing handoff.
- `دليل-مميزات-منظومة-Flow.docx` (binary Word doc) — same gap. `scripts/generate-report-docx.mjs`
  builds it from its own independently hardcoded Arabic content (not parsed from the
  HTML report), so fixing the HTML report does **not** fix the docx — both need their
  own content update, in whatever order is convenient.

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
