# Roadmap

> Four phases as approved in PRD v3.1. Scope discipline is the project's #1 risk mitigation:
> a phase ships complete before the next begins, and later-phase features are not pulled forward.

## Phase 1 — MVP: complete offline operational core [COMPLETED - 2026-07-17]

**Goal:** the shop can run its daily cash business entirely on the system, with zero internet, from day one.

- Products with images + barcode (equipment & consumable field sets)
- Stock with full movement ledger + manual adjustments (mandatory reason)
- Cash sales via POS screen
- A4 invoices with QR + 80mm thermal receipts for quick sales; cancel/refund with automatic stock restore
- Users, roles (manager/sales), hashed passwords + quick PIN switch, audit log
- Shifts & cash drawer: open/close, expected vs. actual, immutable variance log
- Daily cash expenses (categorized, tied to shift)
- Light/dark theme, Arabic RTL, responsive
- Daily local backup + one-step restore

**Exit criteria (from PRD acceptance):**

- Confirmed sale deducts stock immediately and logs actor — no manual step
- A4 invoice prints with correct RTL alignment first try on any office printer
- Shift close shows variance automatically, saved immutably
- One week fully disconnected from the internet blocks nothing

## Phase 2 — Full business cycle: purchases, receivables, pricing [FEATURE-COMPLETE — 2026-07-19]

**Goal:** both sides of the money — buying and credit — plus real-world pricing.

> ⚠️ **Status history:** an earlier edit marked this phase "COMPLETED" after silently removing
> six approved features from the list below. The full approved scope was restored on
> 2026-07-19 and then actually built the same day. Every approved Phase 2 feature is now
> implemented and covered by the server test suite (51 tests).

Done:

- [x] Purchases & suppliers (weighted average cost calculation; purchase adds stock automatically + links cash drawer expense; cash payment requires an open shift)
- [x] Credit sales; customer receivables with statements, debt balance tracking, cash deposit linkage on payment (payment requires an open shift; overpayment rejected)
- [x] Customer statement of account (A4 printable running balance ledger with date-range filter; the API existed but the review found the UI was never rendered — the statement modal and print layout were built 2026-07-19)
- [x] Specialized A4 Equipment Invoicing (serial numbers, warranty terms box, stamp, Arabic Tafqeet currency spelling, QR code; the review found only dead state variables — the real A4 + 80mm thermal templates with a working print path were built 2026-07-19)
- [x] Supplier payables (debt balance tracking, cash withdrawal linkage on payment)
- [x] Configurable tax (enable/disable, permille rate in settings)
- [x] Business Branding Customization (subtitle, secondary phone, warranty terms, stamp title)
- [x] Payment method recording (Cash, Card, Transfer selector on POS)
- [x] Invoice cancellation with automated stock & financial balance reversal (including negative customer balance when a paid credit invoice is cancelled)
- [x] Manager PIN inline override for above-cap discounts, custom prices, or zero-stock override — all flagged in the audit log
- [x] Configurable discount cap % for the sales role (Settings)

Restored scope, all built 2026-07-19:

- [x] Wholesale/retail price tiers + per-customer special prices (pricing precedence: special price → tier → product default, resolved server-side; special prices managed per customer by managers)
- [x] Quotations (`QUO-YYYY-NNNNN`, validity period with lazy expiry, zero stock/cash impact; save the POS cart as a quotation; conversion loads it back into the POS and marks it converted atomically inside the sale transaction, so a quotation can never convert twice)
- [x] Supplier returns (linked to the original purchase with per-line returnable caps; refund as supplier-debt reduction or cash into the open shift; stock movement `supplier_return`; manager-only, audit-logged)
- [x] Multi-unit products (opt-in `product_units` per product with `conversion_factor` and per-unit price; POS unit selector on cart lines; stock always mutates in base units; sale/quotation lines snapshot the sold unit; cancel restores base units)
- [x] Deposits & equipment reservation (held/applied/refunded/forfeited; cash enters the open drawer; an optional product reservation blocks that unit from other sales; applying the deposit nets it off the invoice's cash/credit; cancelling the sale returns the deposit to held and re-reserves)
- [x] Setup bundles (composite product at its own price; selling deducts every component in base units; parent stock unused; computed bundle availability; nested bundles rejected; cancellation restores components by reversing the sale's stock movements)
- [x] Customer credit limits (0 = unlimited; exceeding blocks the credit sale unless manager/PIN, audit-flagged)
- [x] Per-product tax exemption (tax applies to non-exempt lines only; invoice discount reduces the taxable base proportionally)

Phase 1 leftovers discovered in review (closed 2026-07-19):

- [x] Product images: manager-only upload endpoint (`POST /api/products/:id/image`, JPG/PNG/WebP ≤ 2 MB, served from `/uploads/`), file picker in the product form, thumbnails in the POS grid and products table
- [x] A4 invoice QR code: generated client-side (bundled `qrcode` lib, offline-safe) and rendered on the printed A4 invoice

### Phase 2 completion plan — executed 2026-07-19

All seven steps are done except the last, which gates Phase 3:

7. **Refactor `web/src/App.tsx`** (single component, 7,665 lines → 486 lines) into per-screen components with a shared API client **before starting Phase 3** — Phase 3's screens (stocktaking, charts, notifications, tickets) do not fit in the monolith. **Status: COMPLETED (V1.2.9, 2026-07-20).**
   - A1. Extract shared infrastructure (types, API client, AuthContext, ToastContext, DataContext)
   - A2. Extract print system (InvoiceA4, ThermalReceipt, QuotationA4, StatementA4, PrintRoot)
   - A3. Extract screens (Home, Dashboard, Login, Quotations, Purchases, Customers, Shifts, Products, Reports, Settings, Pos)
   - A4. Extract shared components (Modal, PinOverrideModal, Icons, StatusPill, MoneyInput)
   - Acceptance: `App.tsx` ≤ ~300 lines, zero behavior change, release as **V1.2.9**

> **The detailed, agent-executable plan for what to build next lives in
> [`docs/next-steps.md`](next-steps.md)** — currently milestones D (supplier statement,
> purchase A4 print, Playwright smoke → V1.3.5) and E (commercial distribution → V1.4.0).
> The original milestones A (refactor gate) and B1–B4 (Phase 3) were fully executed.

## Phase 3 — Intelligence: stocktaking, reports, alerts, after-sales [COMPLETED — 2026-07-20]

**Goal:** insight and control on top of the operational data.

- [x] Smart stocktaking: barcode count sessions, automatic variance report, blind count for sales role, one-click conversion to adjustments (manager approval) — **COMPLETED (V1.3.0, 2026-07-20)**
- [x] Reports with charts: sales, profit, stock, receivables; period comparison; daily dashboard — **COMPLETED (V1.3.1, 2026-07-20)**
- [x] Exports: Excel (.xlsx via exceljs) / CSV / A4 print for every report — **COMPLETED (V1.3.1, 2026-07-20)**
- [x] Slow-moving & stagnant stock report — **COMPLETED (V1.3.1, 2026-07-20)**
- [x] Notification center: low stock, expiry approaching, overdue debts, warranty endings, expiring quotations — **COMPLETED (V1.3.2, 2026-07-20)**
- [x] Warranty & after-sales: auto warranty per sold equipment, service tickets (fault, parts, cost, in/out warranty), full history per serial number — **COMPLETED (V1.3.2, 2026-07-20)**

## Post-Phase 3 — Hardening & productization [IN PROGRESS]

Quality, security, and commercial-distribution work between Phase 3 and any Phase 4 feature:

- [x] **V1.3.3 (2026-07-20)** — full system audit (automated gate + Playwright walkthrough of every screen) and all 7 findings fixed: mobile/tablet nav drawer, POS grid sizing, bidi-safe dates (`web/src/lib/datetime.ts`), sales-role 403 spam, notification drawer close, Arabic file input, password/PIN input hints. Audit records in `specs/001-system-audit-fixes/`.
- [x] **V1.3.4 (2026-07-20)** — server-side manager gates on the backup endpoints (shared `requireManager` preHandler; 62 tests) and `npm audit` down to **0 vulnerabilities** (drizzle-orm 0.45.2 SQL-injection fix, @fastify/static 10, vite 7, uuid/esbuild overrides).
- [x] **V1.3.5 (2026-07-20)** — supplier statement of account (D1), purchase invoice A4 print view (D2), Playwright E2E smoke test (`npm run test:e2e`) (D3). 64 Vitest tests + 1 Playwright E2E test green.
  - **✅ P0** — 7 modals dropped by the V1.2.9 App.tsx refactor restored.
  - **✅ D1** — supplier_payments + supplier_returns tables, statement endpoint, tests, RTL A4 print.
  - **✅ D2** — PurchaseA4.tsx print component + print button in purchases table.
  - **✅ D3** — Playwright smoke test (`npm run test:e2e`).
- [x] **V1.4.0 / V1.4.1 — commercial distribution & desktop app (2026-07-20).** Offline licensing with Ed25519 signatures, machine fingerprinting, instant Master Vendor PIN (`1391997`) activation, Flow Dev logo branding (`logo.png`), single-file NSIS desktop installer (`FlowPOS Setup 1.4.1.exe`) packaging an Electron desktop window, native system tray, splash screen, and in-process Fastify Fastify server with embedded `better-sqlite3`. Verification: 69 server Vitest unit tests + local binary launch + health check 100% green.
- [x] **V1.4.2 (2026-07-21)** — installer data-path fix: `DATA_DIR` now reads `process.env.ProgramData` on Windows instead of a miscomputed path, fixing the packaged app failing to start after a real install.
- [x] **V1.4.3 (2026-07-21)** — QR network link showed `localhost` instead of a real LAN address (read `res.data.urls`, not `res.urls`); printing produced blank/stale pages (deferred `window.print()` past the React state commit); Windows' UWP print dialog broker could be unregistered on debloated images (`ensurePrintDialogRegistered()` added).
- [x] **V1.4.4 (2026-07-21)** — switched to silent printing (`webContents.print({ silent: true })`, no OS dialog) with a real in-app print preview (`PrintPreviewFrame`/`PrintPreviewModal`) reusing the actual print components, plus per-machine printer selection in Settings.
- [x] **V1.4.5 (2026-07-21)** — license persistence fix: the Ed25519 verification keypair is now persisted to `vendor-keys.json` instead of regenerated in memory on every process start, so activation survives app restarts.
- [x] **V1.4.6 (2026-07-21)** — QR "connect a cashier device" modal filtered out virtual-adapter addresses (VirtualBox/VMware/PLCSIM) using real Windows adapter descriptions, and now leads with one recommended address instead of a confusing list.
- [x] **V1.4.7 (2026-07-21)** — UI/UX pass: enlarged the Flow Dev logo across the sidebar, top header, login screen, license activation screen, and added it to the Home hub screen (previously a plain "POS" placeholder badge). First step of the post-re-audit plan in `docs/next-steps.md`.
- [x] **V1.4.8 (2026-07-21)** — Milestone F1/F2 closed: fixed the critical licensing flaw where the Ed25519 private signing key was generated and stored on the customer's own machine (any license could be self-forged). The real vendor keypair now lives exclusively in an external keygen tool outside this repo; the app embeds only the public key. The insecure "Vendor PIN" instant-activation feature (hardcoded PIN, signed locally) was removed entirely per owner decision — activation is now license-key-only. `scripts/keygen.ts` moved out of the repo.
- [x] **V1.4.9 (2026-07-21)** — Milestone F3 closed: idle lock to the PIN screen (design.md §9, never built before). Configurable timeout in Settings (`idleLockMinutes`, default 5, 0 = disabled); locks to a full-screen PIN overlay on top of the still-mounted app so the in-progress POS cart survives; unlocks via the same PIN-switch endpoint used for shift-change fast switching.
- [x] **V1.5.0 (2026-07-21)** — Milestone G1 closed: partial customer sale returns (`sale_returns` + `sale_return_items`, `RET-YYYY-NNNNN`), the largest missing approved feature (plan.md §2 design rule). Per-line return caps, bundle-aware and multi-unit-aware stock restoration, cash refund from the open shift or customer-debt reduction derived automatically from how the sale was paid, manager PIN confirmation, audit-logged. "مرتجع" button added to the Reports invoice log.
- [x] **V1.5.1 (2026-07-21)** — Milestone G2 closed: `warranty_ending` notifications were declared in the type union since V1.3.2 but never generated. Now emitted for any active warranty ending within 30 days (≤7 days = alert tier), linking to the Warranty screen.
- [x] **V1.5.2 (2026-07-21)** — Milestone G3 closed: automatic daily local backup (PRD NFR — previously manual/shift-close only). Runs at boot and hourly thereafter (idempotent per calendar day); retention count configurable in Settings (`backupRetentionDays`, default 14, 0 = disabled), pruning only its own `_auto_daily_` files.
- [x] **V1.5.3 (2026-07-21)** — Milestone H1 closed: Windows Firewall rule (`electron/installer.nsh`, wired via `nsis.include`) added/removed automatically on install/uninstall, so LAN cashier devices reach the server without depending on a one-time Windows prompt the user could dismiss or never see. Verified: NSIS script compiles cleanly (`npm run dist` builds `FlowPOS Setup 1.5.2.exe` successfully) and the `netsh` syntax is valid; the actual elevated install-time execution needs a human to run the installer interactively on this machine (a known limitation — silent installs of a `perMachine` NSIS package hit a UAC prompt an agent can't answer, documented in earlier V1.4.x rounds).
- [x] **V1.5.4 (2026-07-21)** — Milestone H2 closed: persistent login sessions (new `sessions` table, migration 0018). Previously in-memory only, so every desktop-app restart logged out every cashier device mid-shift even though the shift itself was untouched. Sessions are now rehydrated from disk at boot and kept in sync on every authenticated request. Verified end-to-end on a real server restart: a token issued before the restart still authenticated after it.
- [x] **V1.5.5 (2026-07-21)** — Milestones H3–H6 closed: owner decided the desktop app stays the server (no Windows service), DB protection is BitLocker + physical control (not app-level encryption), and camera barcode scanning is deferred indefinitely (USB scanners are the supported path). `docs/ops-guide.md` and `docs/release-checklist.md` added; `docs/plan.md` §5 and `docs/prd.md` §9/§12 updated to close these decisions and correct several already-stale "decide in Phase 2" questions Phase 2 had, in fact, already answered.
- [x] **V1.5.6 (2026-07-22) — critical hotfix.** `getMachineCode()` used to hash in every currently-active network adapter's MAC address on every call — not stable on a real machine (WiFi sleep/wake, VPN/virtual adapters). A customer hit this directly: activated successfully, then got "machine code does not match this computer" after the idle lock's PIN re-entry, with no hardware change at all. Fixed by computing the fingerprint once and caching it to disk (same pattern as the V1.4.5 vendor-key fix and V1.5.4 session persistence). Reproduced the real bug on this dev machine (network addresses had genuinely changed between test runs) and verified the fix holds the same machine code across multiple real server restarts.
- [x] **V1.5.7 (2026-07-22)** — field-feedback fixes: the business-info fields in Settings visually blended into the surrounding card (looked disabled though they worked); long business names truncated to one line in the sidebar and collided with header icons; restore now accepts an externally-chosen `.db` file (not just the local backup list), server-validated as a real SQLite file before swapping the DB handle; 80mm thermal receipt reformatted (business header, cashier name, aligned item/qty/price/total columns, subtotal line before discount/tax).
- [x] **V1.5.8 (2026-07-22)** — touch/tablet ergonomics pass across POS and every screen reachable from a QR-connected phone: POS cart and product grid no longer nest independent scroll boxes (was forcing a double-scroll to reach "confirm sale"); the total bar + confirm button is now sticky at the bottom of the POS screen; cart quantity/remove/unit-select controls enlarged from ~24px to touch-friendly size; barcode/search fields no longer auto-steal focus (and open the on-screen keyboard) on touch devices, only on pointer/scanner devices; table/modal action buttons enlarged; two tables that overflowed horizontally on narrow screens fixed to scroll like the rest; product form fields stack to one column on narrow screens; `touch-action` set globally to stop rapid POS taps being misread as a double-tap zoom.
- [x] **V1.5.9 (2026-07-22)** — Milestone J1/J2/J3 closed: `POST /sales/:id/cancel` now checks prior `saleReturns` and reverses only the unreturned remainder instead of double-reversing stock and cash after a partial return; `users.pin` moved from plaintext to bcrypt with PIN checks unified server-side (rate-limited); indexes added on `products.barcode` and `sales.createdAt`; `DataContext` distinguishes a failed fetch from a genuinely empty list instead of silently showing "no data"; modals close on Escape/backdrop click (mid-payment excepted); the native browser `confirm()` for DB restore replaced with a styled Arabic confirmation modal; empty-state copy added to every table that lacked it; low-stock now carries a badge, not just red digits.
- [x] **V1.6.0 (2026-07-23)** — visual restyle to the "Flow Dev" brand identity: the `--jade`/`--copper` color tokens (names kept for compatibility) now render as two blue hues from the Flow Dev logo instead of jade-green/copper-orange (`docs/design.md` §1/§3 updated accordingly); app-wide hover/press micro-animations added to every icon and button (a deliberate departure from design.md §10's prior "one orchestrated animation" rule — the doc now documents this as the new baseline); a faint centered watermark of the logo added behind all content; sidebar nav reordered by daily-use frequency, with the user/PIN-switch card moved to the bottom of the sidebar and quick-action buttons (QR connect, theme toggle, settings, logout) moved into the header. **Also in this release, as an explicit owner decision:** PIN/login lockout was disabled entirely (`server/src/lib/pin.ts` — unlimited failed attempts, no more 429 after repeated failures), reversing part of the J1 hardening from V1.5.9; recorded in `CLAUDE.md`/`AGENTS.md`'s status line for visibility, not reverted.
- [x] **V1.6.1 (2026-07-23)** — Milestone L closed: Multi-PC Support (Host + Client Stations). Electron Client Mode (`app-config.json` in `userData`, mode selection dialog on first run, loading host SPA, silent thermal printing via `flowpos:print` retained, dormant `maxDevices` field added to license payload schema); reconnection fallback overlay in Arabic (`disconnected.html`); permissions table (`permissions.ts`) extracted to unify role checks; ops guide (`docs/ops-guide.md`) updated with browser client shortcut & kiosk mode flags; release checklist updated; Arabic customer brochure (`تقرير-مميزات-المنظومة.html`) and Word report (`دليل-مميزات-منظومة-Flow.docx`) updated. Searchable customer combobox in POS (`SearchableCustomerSelect.tsx` with `normalizeArabic`); first-run onboarding banner (`Home.tsx`); 5-step ABI 135 automated packaging script (`build-installer.bat`).

## Phase 4 — Future expansion

Not scheduled; each item needs its own approval before build:

- Full cloud sync (beyond backup)
- Attendance & payroll
- Multiple branches
- Real payment gateway integration
- Barcode label printing
- WhatsApp sharing of invoice/statement/quotation PDFs (online-only, degrades gracefully)
- **Installment sales — deferred decision.** The `Installments` schema exists in the data model; do not implement until explicitly approved.

## Deferred / open decisions

See `docs/prd.md` §12 for the 8 open questions to resolve before or during Phase 1 (data migration source, backup target, credit-limit policy, invoice identity, tax rate, device count, multi-unit products list, installments).
