# Next Steps — Execution Plan (post-V1.4.6 full re-audit, 2026-07-21)

> Written 2026-07-21 for **any agent** (Antigravity, Cursor, Claude Code, …) to execute.
>
> **Context:** V1.6.2 is released; Phases 1–3, Milestones D through M (V1.4.1 → V1.6.2) are done.
> 89 Vitest unit tests + 1 Playwright E2E test green. This plan is the result of a **full re-analysis of the project**
> (PRD, plan, roadmap, design system, and code) that compared everything the docs promised against what the code actually does. Findings are grouped into milestones F–I below, ordered by
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
| 17 | **Cancel-after-partial-return double-reverses stock and cash.** `POST /sales/:id/cancel` (`server/src/routes/sales.ts:742`) replays the *original full* invoice's stock movements and refunds the *original full* total with no check against `saleReturns` — sell 10, return 3, then cancel → stock and cash both move as if the return never happened, on top of the return's own effects. Real ledger corruption on a normal workflow, not a contrived edge case. | Critical | J1 |
| 18 | **Manager-PIN brute force has no rate limit outside the dedicated override endpoint.** `sales.ts`, `quotations.ts`, `stocktaking.ts` each do their own inline plaintext-PIN lookup (`users.pin`, `schema.ts:36`) for overrides, bypassing the lockout built for `/auth/manager-override`. Server binds `0.0.0.0` with no CORS (by design, for QR/phone access), so this is reachable from anyone on the shop WiFi, not just at the counter. | High | J1 |
| 19 | **Seeded weak defaults (`admin`/`sales`, PINs `1111`/`2222`, `seed.ts:21`) have no forced rotation.** Combined with #18, a shop that never touches user management ships with a guessable, network-reachable manager PIN indefinitely. | High | J1 |
| 20 | **No index on `products.barcode` or `sales.createdAt`**, and `GET /products`/`GET /sales`/reports-analytics load full tables into memory with no pagination — the two columns the domain rules themselves call out as hot paths (barcode scan, date-range reports) are unindexed. Fine today at seed-data scale; will degrade quietly as a real shop's history grows. | Medium | J2 |
| 21 | **`DataContext.fetchArray` silently returns `[]` on any failed request** — no error surfaced, no loading flag exposed by the context at all. A cashier on a flaky connection sees "zero products" indistinguishable from an actually-empty catalog. `Reports.tsx` even has a `loading` state that's set but never read (dead code, evidence this was intended and dropped). | Medium (correctness, not just polish) | J2 |
| 22 | **Zero modals close on Escape or backdrop click**, contradicting design.md §7 ("ESC/backdrop closes except mid-payment"). One shared `Modal.tsx` (`web/src/components/Modal.tsx:22-45`) has no `onKeyDown`/backdrop `onClick`/`role="dialog"` — every one of the ~15+ modals built on it inherits the gap. | Medium | J3 |
| 23 | **The single scariest action in the app (full DB restore) uses native `confirm()`** (`App.tsx:667,680`) — breaks RTL, unstyled, and inconsistent with invoice cancellation's proper PIN-override modal that restates the amount. It's the only `confirm()` call in the whole web app. | Medium | J3 |
| 24 | **No empty state on Products/Customers/Purchases/Quotations/Warranty tables** — bare header row, nothing below. design.md §8 literally specifies the Arabic copy for Products (`لا منتجات بعد — أضف أول منتج`) and it's unused; `Stocktaking.tsx` does this correctly and should be the template. | Medium | J3 |
| 25 | **Bidi-date regression on `Home.tsx`** (lines 198, 285 use raw `toLocaleTimeString`/`toLocaleDateString('ar-LY')` instead of the shared `datetime.ts` helpers) — the exact bug class V1.3.3 already paid to fix, back on the shift-status banner every user sees dozens of times a day. Only two `toLocale*` call sites left in `web/src`; everywhere else is correct. | Medium | J4 |
| 26 | **Deposits (shipped Phase 2 feature) has no top-level nav entry** — `depositsList` is fetched by `DataContext` but no `Deposits` screen/nav item exists in `App.tsx`/`Home.tsx`'s nav config; needs confirming it isn't genuinely stranded UI. | Medium | J4 |
| 27 | **Design-token drift**: raw hex colors on `Login.tsx` (lines 61,67,89,96) and the Reports sales-trend chart (`#10b981` instead of the `--jade` token), plus stray fallback tokens in `App.tsx`'s pre-license spinner (`--bg-base`, `--color-primary`) that don't exist in `tokens.css` — all contradict CLAUDE.md's "tokens only, never raw hex" rule. Emoji mixed into an otherwise-consistent SVG `Icons.tsx` system, and two nav-icon collisions (Stocktaking/Reports share one icon, Warranty/Settings share another) hurt at-a-glance scanability. Low-stock in `Products.tsx` is shown by red digits alone with no badge/icon, contradicting the app's own "never color alone" rule (followed correctly everywhere else). | Low | J4 |
| 28 | **No first-run/onboarding experience** for a brand-new shop — `Home.tsx` renders the identical 9-tile grid whether the catalog has 0 or 10,000 products, with "التقارير المالية"/"الجرد الذكي" carrying equal visual weight to "نقطة البيع" before a single product exists. Worth a lightweight setup checklist given the product is now sold commercially. | Low | J5 |
| 29 | **Architecture debt**: `sales.ts` (1200+ lines) mixes HTTP/authZ/pricing/tax/stock/cash/audit with copy-pasted override-check blocks; `App.tsx` (1267 lines, ~35 `useState`) is a god component; zero frontend tests exist beyond one Playwright smoke test despite POS cart math (subtotal/tax/discount/change) being central to correctness. Not urgent, but a refactor tax on every future change until addressed. | Low | J6 |

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

## Milestone J — post-V1.5.8 full-app review (2026-07-22)

> A follow-up review (architecture/code-quality, security/data-integrity, and
> UX/feature-completeness, each done independently) after the touch/mobile ergonomics
> pass. Ordered by actual risk: J1 is data/security correctness happening in production
> today, J2–J3 are correctness-adjacent UX, J4–J6 are consistency/scale/debt that won't
> bite immediately but compound. Do J1 before anything else in this file.

### J1. Cancel/return ledger integrity + manager-PIN hardening

- **Cancel-after-partial-return double-reversal** (finding #17): `POST /sales/:id/cancel`
  (`server/src/routes/sales.ts:742`) must check `saleReturns` for the invoice and only
  reverse the *remaining* (not-yet-returned) stock/cash, mirroring the returnable-quantity
  cap logic already used on the return path (`saleItem.quantity - returnedQuantity`).
  Add a test: sell → partial return → cancel → assert stock and cash reflect only the
  unreturned remainder, not the full original invoice twice.
- **Hash PINs like passwords** (finding #18/#19): `users.pin` (`schema.ts:36`) moves from
  plaintext to bcrypt (same pattern already used for `passwordHash`). Add one shared
  `verifyManagerPin(userId, pin)` helper in `lib/`, rate-limited and audit-logged on
  failure, and replace every inline PIN-lookup call site (`sales.ts`, `quotations.ts`,
  `stocktaking.ts`, plus the existing `/auth/manager-override`) with it — no route should
  do its own PIN comparison again.
- **Forced rotation of seeded defaults**: on first login with the seeded `admin`/`sales`
  passwords or `1111`/`2222` PINs, either force a change before proceeding or show a
  persistent, undismissable-until-resolved banner. Cheapest correct option: a `mustChangeCredentials`
  flag on the seeded rows, cleared on the user's first successful password/PIN change.
- Tests: double-cancel-after-return regression test; PIN-hash migration (existing PINs
  re-hashed on first successful auth, not a breaking migration); rate limit shared across
  every PIN-check call site now that they funnel through one helper.

### J2. Read-path scale + fetch-failure visibility

- Add indexes on `products.barcode` and `sales.createdAt` (migration via
  `npm run db:generate` after adding `.index()` calls in `schema.ts` — never hand-edit
  the generated SQL).
- `DataContext.fetchArray` (`web/src/context/DataContext.tsx:70-108`) must distinguish
  "empty" from "failed to load": expose an error/loading flag per list (or at least a
  global `dataLoadError` the shell can toast), and wire the dead `loading` state already
  declared in `Reports.tsx` into an actual spinner. Do not ship a table that can silently
  read as "zero inventory" when the real cause is a dropped request.
- Defer full pagination unless/until a real shop's product or sales table is large enough
  to matter — note it here so it isn't forgotten, but don't build it speculatively.

### J3. Modal & confirmation consistency

- `Modal.tsx` (`web/src/components/Modal.tsx`): add Escape-to-close and backdrop-click-to-close
  (skip both for any modal that's mid-payment, per design.md §7's own carve-out), plus
  `role="dialog"` / `aria-modal="true"` / `aria-labelledby` pointing at the title. One
  fix, inherited by every modal built on the shared component.
- Replace the two native `confirm()` calls gating DB restore (`App.tsx:667,680`) with the
  same `PinOverrideModal`/confirmation-modal pattern already used for invoice cancellation
  — restate what's about to be replaced, require the same manager-PIN confirmation a
  destructive action of this severity deserves.
- Add the empty-state branch (muted sentence + action button, per design.md §8's own
  copy) to Products, Customers, Purchases, Quotations, and Warranty tables — copy
  `Stocktaking.tsx`'s existing pattern rather than inventing a new one.

### J4. Design-system & bidi conformance sweep

- Fix the two remaining raw `toLocaleTimeString`/`toLocaleDateString` calls in
  `Home.tsx` (lines 198, 285) to use `datetime.ts`'s shared formatters.
- Confirm whether Deposits is reachable anywhere in the UI; if not, add a nav entry (or a
  documented, deliberate decision that it's POS-flow-only and why).
- Replace the raw hex in `Login.tsx` and the Reports chart with real tokens (`--jade` for
  the chart series), and clean up the stray non-existent fallback tokens in `App.tsx`'s
  pre-license spinner.
- Swap emoji for the existing `Icons.tsx` SVG set where both are used for the same kind
  of action (print, power, printer icons especially — `Icons.Printer` already exists and
  is used inconsistently against raw 🖨️ elsewhere); resolve the two duplicate nav-icon
  pairs (Stocktaking/Reports, Warranty/Settings).
- Give `Products.tsx`'s low-stock indicator a badge/icon in addition to the red digits,
  matching the badge pattern already used correctly for warranty/out-of-stock status.

### J5. First-run onboarding

- Design and add a lightweight setup checklist shown only while the shop's data is
  genuinely empty (no products, no users beyond the seeded pair): business info →
  first product → optional first real user/PIN. Product decision on scope/UI, not just
  an engineering task — check with the owner on how prescriptive it should be before
  building.

### J6. Architecture debt (backlog — do opportunistically, not as a standalone project)

- Next time checkout/override logic is touched: extract a `lib/sales-service.ts` from
  `sales.ts` instead of adding another copy-pasted override/audit-log block.
- Next time `App.tsx` needs a new piece of global UI state: consider whether it belongs
  in a context instead of another top-level `useState`.
- Add component-level tests for POS cart math (subtotal/tax/discount/change) before any
  significant refactor of `Pos.tsx` — currently zero frontend test coverage exists for
  the app's most financially sensitive screen.

---

## Milestone K — V1.6.0: Flow Dev brand restyle (2026-07-23)

> Shipped outside this plan's numbered milestones — a visual/UX pass plus one security
> decision. Logged here so future audits don't rediscover it as drift.

### K1. Flow Dev color identity, micro-animations, nav/header rework — ✅ DONE (V1.6.0, 2026-07-23)

`tokens.css` repointed `--jade`/`--copper` (names kept for compatibility with existing
component classes) from green/copper to two blues drawn from the Flow Dev logo; a faint
centered logo watermark added behind all content (`body::before` in `app.css`);
app-wide hover/press micro-animations added to every button/icon/link (spring-pop scale,
colored glow, lift-on-hover, press-scale) — this is a deliberate departure from
design.md §10's prior "the stamp press is the only orchestrated animation" rule, and the
doc has been updated to describe it as the new baseline rather than a violation. Sidebar
nav reordered by daily-use frequency; the user/PIN-switch card moved from top to bottom
of the sidebar; quick-action buttons (QR connect, theme toggle, settings, logout) moved
from the sidebar footer into the header. `docs/design.md` §1/§3/§6/§10 and the
`CLAUDE.md`/`AGENTS.md` status lines updated to match (2026-07-23 doc-sync pass).

### K2. PIN/login lockout disabled — ⚠️ OWNER DECISION, NOT A BUG (V1.6.0, 2026-07-23)

Same commit disabled `isLockedOut`/`recordAuthFailure` in `server/src/lib/pin.ts`
entirely (both are now no-ops; `pin-switch` returns `401` forever instead of `429` after
10 failures) and updated `hardening.test.ts` accordingly. This reverses part of J1's
hardening (V1.5.9's PIN-check rate limiting). When asked to review this doc, the owner
confirmed **leave the code as-is, docs-only for now** — recorded in `CLAUDE.md`/
`AGENTS.md`'s status line. If the decision changes, restoring the previous
`isLockedOut`/`recordAuthFailure` bodies (10 failures → 15-minute lockout) and the
original `hardening.test.ts` assertion (`429` on the 11th attempt) is a self-contained
revert — see git history for `server/src/lib/pin.ts` before the `1.6.0` commit.

---

## Milestone L — Multi-PC: host + client stations — ✅ DONE (V1.6.1, 2026-07-23)

> The shop wants more than one PC on the same data: one host (the current desktop app,
> which *is* the server per H3) plus client PCs at other counters / the back office /
> the warehouse. The architecture is already ~90% there — the server binds `0.0.0.0`,
> the phone-QR feature proves any browser is a full client, and the host serves the SPA
> from `web/dist`. This milestone productizes the client experience. **Decisions below
> were confirmed with the owner on 2026-07-23 — don't re-litigate them, but L2/L3 details
> marked "verify" still need checking against the code before building.**
>
> **Confirmed decisions:**
> - **Licensing is per shop, host-only.** Clients (PCs and phones) never see an
>   activation screen and are unlimited. Add an optional `maxDevices` field to the
>   license file format now — default/absent = unlimited, **unenforced** — so seat
>   enforcement later is a small feature, not a license-format migration (same pattern
>   as the dormant Installments schema). Bigger shops are priced commercially via the
>   license price, not technically.
> - **Clients never bundle the web app.** A client loads the UI from the host, so
>   upgrading the shop = upgrading the host only; client shells should rarely need
>   reinstalling. The client owns only: the window, the `flowpos:print` bridge with its
>   own per-machine printer config, and the "which server?" setting.
> - **Discovery is layered:** manual server-address entry at first run (address shown in
>   the host's existing ربط الجوال modal); a **static IP / DHCP reservation for the host
>   becomes a required install step** (promote from recommendation in ops-guide §1 and
>   add to the release checklist's install section); automatic LAN re-scan is used only
>   for *recovery*, not first-run.
> - **Shared-drawer model only.** Multi-PC ships on the existing "one shared drawer
>   shift" domain rule (already correct: every action is attributed per employee).
>   **Drawer-per-counter (concurrent shifts, variance per drawer) is parked** as its own
>   future milestone needing its own owner brainstorm — it touches the shift schema,
>   variance reports, and POS flow. Do not build it as part of L.
> - **Connected-devices view for the manager: later** (nice-to-have; the persistent
>   `sessions` table already holds most of the data when wanted).

### L1. Document the browser client path (zero code)

- New ops-guide section: connecting a client PC via browser — desktop shortcut to
  `http://<host-ip>:3001`, login with the employee's own PIN, and the kiosk-mode
  browser flag for silent thermal printing on non-Electron clients (the technique the
  ops guide already documents for cashier devices).
- Promote the host static-IP step to **required** in ops-guide §1 and add it to
  `docs/release-checklist.md`'s install-verification section.
- This makes multi-PC officially supported immediately; L2 makes it polished.

### L2. Electron client mode

- First-run choice in the desktop app: **خادم رئيسي (هذا الجهاز يحمل البيانات)** vs
  **جهاز كاشير (اتصال بخادم موجود)**. Client mode: no DB, no migrations, no license
  screen, no in-process Fastify — the window loads the saved host URL directly.
- Keep silent thermal printing: the `flowpos:print` IPC bridge and per-machine
  `print-config.json` must work identically when the window shows a remote origin —
  **verify** the preload script attaches to the remote URL and that nothing in the
  bridge assumes `localhost` (see the V1.4.x printing lessons at the bottom of this
  file before touching any of it).
- Client stores the server URL in its own config (in `userData`, not `DATA_DIR` —
  there is no `DATA_DIR` concept on a client). Mode choice is changeable from a
  settings/escape hatch without reinstalling.
- License `maxDevices` field added to the license format (dormant, see decisions).
- **Verify before building:** session/localStorage behavior against the remote origin,
  and that the QR/network modal on the host shows the address a client PC should type.

### L3. Connection resilience

- Replace Chromium's error page in client mode with an Arabic screen:
  «انقطع الاتصال بالخادم — جارٍ إعادة المحاولة» — auto-retry every few seconds, plus a
  button to edit the saved server address (covers "router replaced / IP changed"
  without reinstalling; phones self-heal by re-scanning the QR).
- Auto-rediscovery on failure only: scan the local /24 for a FlowPOS host (the health
  endpoint identifies it) and offer «تم العثور على الخادم على عنوان جديد — إعادة
  الاتصال؟» — one tap, no typing. Never used at first-run; never trusted silently
  (always confirm before switching the saved address).
- Host-side banner when the host boots with a different LAN address than its last boot:
  «تغيّر عنوان الخادم — حدّث أجهزة الكاشير». Cheap early warning before the first
  confused cashier.
- **Explicitly rejected:** mDNS/`flowpos.local` hostnames — unreliable on Windows LANs
  without extra services; a support trap for a one-person support operation.

### L4. Parked follow-ups (each needs its own owner decision before build)

- **Drawer-per-counter shifts** — the real Phase-4-sized feature for two-full-register
  shops; brainstorm the shift model first.
- **Connected-devices list** in Settings (active sessions: device, user, last activity).
- **`maxDevices` enforcement** — only if a many-register customer actually appears.

---

## Milestone M — V1.6.2: post-V1.6.1 review fixes & sidebar UX — ✅ DONE (V1.6.2, 2026-07-23)

> Result of a full review of the V1.6.0 → V1.6.1 diff (Milestone L implementation) plus a
> verification pass against the running code. 89/89 tests green — none of these break the
> release, but M1 is a real user-facing bug in the new client mode and M2/M3 close gaps
> the changelog already claims are done. Ordered by severity. Same definition of done as
> every milestone: typecheck + tests + build green, server behavior covered by
> `app.inject` tests where applicable, Arabic changelog section, local commit, never push.

### M1. Client "save new address" button silently does nothing — HIGH (bug)

`electron/assets/disconnected.html` line ~150 calls `window.flowposClient.setServerUrl(newUrl)`,
but the preload (`electron/src/preload.ts`) exposes **`flowposConfig`** (`get`/`save`) — there is
no `flowposClient`. So «حفظ وتوصيل» always falls into the `window.location.href = newUrl`
fallback: it navigates for the current session but **never persists** the corrected address to
`app-config.json`. The `localStorage` write is useless too — it lands on the `file://` origin of
disconnected.html, which the app never reads. Net effect: after a router/IP change the cashier
"fixes" the address, it works until the next app restart, then reconnects to the dead address —
exactly the support call L3 was built to prevent.

- Fix: call `window.flowposConfig.save({ mode: 'client', serverUrl: newUrl })` (the bridge that
  actually exists) and let the existing `flowpos:save-app-config` handler do the `loadURL`.
  Remove the dead `flowposClient` branch and the `localStorage` reads/writes.
- Same page's auto-retry success path (`checkHealth`) navigates without persisting either — if
  the user edited the input and auto-retry succeeds on the new address, persist it through the
  same bridge before navigating.
- Test manually per the packaged-app checklist (this is Electron-shell code; Vitest can't reach
  it): kill host → edit address on disconnected screen → save → restart client → must reconnect
  to the *new* address.

### M2. Harden the `flowpos:save-app-config` IPC surface — HIGH (security)

In client mode the main window loads a remote LAN origin **with the preload attached**, so any
page served from that address (or anything that answers on the saved IP after a DHCP reshuffle)
can call `window.flowposConfig.save({ mode: 'client', serverUrl: '<anything>' })`. The handler
in `electron/src/main.ts` passes `serverUrl` straight to `mainWindow.loadURL()` and persists it
with **no validation** — the only URL check is client-side in `mode-select.html`. Low practical
risk on a trusted shop LAN, cheap to close:

- Validate in the **main process** (never trust renderer input): `new URL(serverUrl)` must parse
  with protocol `http:` or `https:`; reject everything else (`file:`, `javascript:`, …) before
  saving or loading.
- Restrict the sender: in the `flowpos:save-app-config` handler, check
  `event.senderFrame.url` starts with `file://` (mode-select / disconnected pages) and ignore
  calls from remote origins. `flowpos:get-app-config` can stay open (it leaks nothing beyond the
  URL the page is already served from). The print bridge (`flowpos:print`, printer config)
  **must remain callable from the remote origin** — that is how client-mode silent printing
  works; do not restrict it.

### M3. Adopt the permissions table — or it stays dead code — MEDIUM (decision + refactor)

V1.6.1 built the central `ROLE_PERMISSIONS` table (`server/src/lib/permissions.ts`) that audit
finding #15 / task I2 asked for, but **nothing adopted it**: of 14 actions, only
`MANAGE_SETTINGS` is checked (inside `requireManager`), `checkPermissionOrThrow` has zero
callers, and 34 inline `role !== 'manager'` checks remain across 12 route files. The V1.6.1
changelog already describes the table as wired ("لربط الإجراءات بالأدوار المسندة") — right now
it documents intent, not enforcement, and the Storekeeper-role promise ("adding a role is data,
not code") is still false.

- Migrate route-by-route: replace each inline `role !== 'manager'` check with
  `checkPermissionOrThrow(req.user?.role, '<ACTION>')`, mapping each site to the closest
  existing `PermissionAction` (add actions to the union where none fits — e.g. products.ts
  needs `MANAGE_PRODUCTS`, reports need `VIEW_FINANCIAL_REPORTS`). Behavior must be
  **identical** for manager/sales — this is a pure refactor; the test suite is the referee.
- `checkPermissionOrThrow` throws a plain `Error` with `statusCode` — verify Fastify's error
  handler actually returns 403 + the Arabic message in the same JSON shape
  (`{ error, message }`) the web app's `apiCall()` expects, or keep reply-based handling.
- Add a small unit test for the table itself (manager passes every action, sales fails
  manager-only ones, unknown role fails everything).
- Only after full adoption may a future milestone add Storekeeper as a data-only change.

### M4. Host-mode switch fails silently — MEDIUM (bug)

In the `flowpos:save-app-config` handler, switching back to host mode does
`try { await startServer(); } catch {}` then `loadURL(SERVER_URL)`. If the server fails to
start, the load fails and — because `did-fail-load` only acts in **client** mode — the user is
left on a raw Chromium error page with no explanation. The app-startup path already shows a
proper Arabic `dialog.showErrorBox` with the server log tail for exactly this failure; the
mode-switch path must do the same instead of swallowing the error.

### M5. Onboarding card: gate on load-complete and manager role — LOW (polish)

The first-run card on `web/src/screens/Home.tsx` renders whenever `productsList.length === 0`,
and `DataContext` initializes `productsList` to `[]` with **no loading flag** — so the card
flashes on every login until the products fetch returns, and it also shows for the sales role
whose step 1 ("ضبط بيانات المحل") leads to a manager-only Settings tab.

- Add a `productsLoaded` (or general `initialDataLoaded`) boolean to `DataContext`, set after
  the first successful products fetch; gate the card on `productsLoaded && productsList.length === 0`.
- Gate on `currentUser.role === 'manager'` — a brand-new install is always set up by the owner.

### M6. Changelog overclaims LAN auto-discovery — LOW (docs honesty)

The V1.6.1 changelog section promises «خيار… البحث في الشبكة المحلية» and L3 planned
auto-rediscovery (LAN /24 scan for the health endpoint) plus a host-side "IP changed since last
boot" banner. **Neither was built** — `disconnected.html` only retries the currently entered
URL every 4 s. Do not silently pick one:

- Cheapest honest fix: amend the V1.6.1 changelog wording to what shipped (auto-retry + manual
  address edit) and move LAN auto-scan + host IP-change banner explicitly into L4's parked
  list. Building the scanner is **not** required for M — it stays parked until the owner asks.

### M7. Minor cleanups (bundle with whichever task touches the file)

- `PRINT_CONFIG_PATH` (`electron/src/main.ts`) is chosen at module load via
  `existsSync(DATA_DIR)`, but `savePrintConfig` re-evaluates the directory at save time — on a
  fresh host install it can `mkdir` `DATA_DIR` while writing the file into `userData`. Make it
  one decision: a `getPrintConfigPath()` helper called at read/write time (host → `DATA_DIR`,
  client → `userData`).
- `SearchableCustomerSelect` has no keyboard navigation — add ArrowUp/ArrowDown/Enter/Escape
  handling so barcode-scanner-and-keyboard cashiers aren't forced onto the mouse. (Scanner
  input goes to the barcode field, not this combobox, so this is ergonomics, not a blocker.)

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
- **Native Module ABI Alignment (Node 24 vs Electron 36):** In an npm monorepo, running `npm test` compiles `better-sqlite3` for host Node 24 (`NODE_MODULE_VERSION 137`). Packaging with `electron-builder` without an explicit Electron target rebuild places ABI 137 into `app.asar.unpacked`, causing Electron 36 (`NODE_MODULE_VERSION 135`) to fail on launch. `build-installer.bat` automates the 5-step pipeline: 1. `npm run typecheck` -> 2. `npm test` (ABI 137) -> 3. `node-gyp rebuild` for Electron 36 (ABI 135) -> 4. `electron-builder` (`--config.npmRebuild=false --config.nodeGypRebuild=false`) -> 5. `npm rebuild better-sqlite3` (restores local Node 24 / ABI 137 for Vitest tests and dev).
- **Licenses activated under V1.4.4 or earlier** were signed with a lost in-memory key
  and need one re-activation under V1.4.5+ (and will need another after F1 lands).
