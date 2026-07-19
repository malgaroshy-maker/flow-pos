# Next Steps — Execution Plan (post-V1.2.8)

> Written 2026-07-20 for **any agent** (Antigravity, Cursor, Claude Code, …) to execute.
> Read `AGENTS.md` first and obey its hard rules throughout — especially:
> **never push to GitHub unless the user explicitly asks**, all money is integer milli-LYD,
> stock only moves through `stock_movements`, and every release updates `سجل-التغييرات.md`.
>
> Definition of done for every task below: `npm run typecheck` + `npm test` + `npm run build`
> all green, new server behavior covered by tests in `server/src/*.test.ts`
> (follow the existing `app.inject` pattern), and a local commit with a clear message.

Work the milestones **in order**. Milestone A is a hard gate — do not start Phase 3 screens
inside the current monolith.

---

## Milestone A — Refactor the `web/src/App.tsx` monolith (THE GATE)

`web/src/App.tsx` is ~7,700 lines in a single component. Phase 3 adds several large screens;
they must not be added to this file. Target: `App.tsx` under ~300 lines (layout, routing
between tabs, top-level providers), everything else in modules. **Zero behavior change** —
this is a pure restructuring.

### A1. Extract shared infrastructure (no JSX moves yet)

1. `web/src/types.ts` — move every `type` currently at the top of App.tsx
   (Product, ProductUnit, CartItem, Sale, Shift, Expense, User, Settings, Backup, Customer,
   SpecialPrice, Quotation, Deposit, Supplier, Purchase, StockMovement…).
2. `web/src/lib/api.ts` — the API layer: token storage (localStorage `pos-token`/`pos-user`),
   `apiCall(url, method, body)`, a `fetchJson` helper with the 401-logout behavior, and
   `uploadProductImage`. Accept a `onUnauthorized` callback instead of reaching into state.
3. `web/src/context/AuthContext.tsx` — token + currentUser + login/logout/pin-switch.
4. `web/src/context/ToastContext.tsx` — `triggerToast` + the toast UI element.
5. `web/src/context/DataContext.tsx` — the shared lists (products, sales, shifts, customers,
   suppliers, purchases, quotations, deposits, users, backups, auditLogs, settings) and
   `refreshAllData` / `loadBaseData`. Screens consume via a `useData()` hook.

Verify after each file: typecheck + build + the app still works (`npm run dev`, log in, sell).

### A2. Extract the print system

`web/src/print/` with: `InvoiceA4.tsx`, `ThermalReceipt.tsx`, `QuotationA4.tsx`,
`StatementA4.tsx`, a `useQrDataUrl(text)` hook, and `PrintRoot.tsx` that renders the active
document inside the root `.print-only` element. Props in, JSX out — no context inside the
templates so they stay printable and testable. Keep the visibility-based print CSS contract
(`.no-print` modals, one `.print-only` at root, thermal swaps `@page` size).

### A3. Extract screens, one commit each

`web/src/screens/`: `Home.tsx`, `Dashboard.tsx`, `Pos.tsx`, `Products.tsx`, `Shifts.tsx`,
`Quotations.tsx`, `Purchases.tsx`, `Customers.tsx`, `Reports.tsx`, `Settings.tsx`,
`Login.tsx`. Extract in this order (smallest → largest): Home, Dashboard, Quotations,
Purchases, Customers, Shifts, Products, Reports, Settings, Pos (largest, includes cart logic —
move cart state into the screen or a `useCart` hook; only the checkout result touches shared
data via `refreshAllData`).

### A4. Extract shared components

`web/src/components/`: `Modal.tsx` (backdrop + card wrapper), `PinOverrideModal.tsx`,
`Icons.tsx`, `StatusPill.tsx`, money input field (`MoneyInput.tsx` wrapping parseLYDOrZero
conventions). Replace duplicated modal markup as screens get extracted — do not redesign.

**Acceptance for Milestone A:** `App.tsx` ≤ ~300 lines; every screen works identically
(POS sale incl. units/deposit/quotation-convert, printing all four documents, statements,
returns, images); typecheck/tests/build green. Release as **V1.2.9** with a changelog entry
("إعادة هيكلة داخلية بدون تغيير في الوظائف").

---

## Milestone B — Phase 3, feature by feature

Ship each feature as its own release (V1.3.0, V1.3.1, …) with tests + changelog entry.
Schema names below follow the PRD data model (`docs/prd.md` §8).

### B1. Smart stocktaking (الجرد الذكي) — V1.3.0

- Schema: `stocktake_sessions` (id, status open/closed, userId, createdAt, closedAt, notes)
  and `stocktake_items` (sessionId, productId, expectedQty snapshot at count time,
  countedQty, variance). Migration via `npm run db:generate` only.
- Server: create session; add/scan item (barcode lookup, default counted += 1, editable);
  close session → variance report; **one-click convert variances to stock adjustments**
  (manager approval required; each adjustment is a normal `stock_movements` row with reason
  `جرد — جلسة #N`). Products not counted in the session are untouched.
- Web: new `Stocktake.tsx` screen — start session, scan field (same keyboard-wedge pattern
  as POS search), list with expected/counted/variance columns (expected hidden for the
  sales role — blind count), close + variance summary, manager convert button, printable A4
  variance report via the print system.
- Tests: variance math, adjustment conversion writes correct movements, blind-count
  permissions, cannot convert twice.

### B2. Reports, charts & exports — V1.3.1

- Server endpoints returning aggregates (all integer milli-LYD): sales by day/period,
  profit (uses weighted-average `costPrice` snapshots from `sale_items` join products),
  stock valuation, receivables/payables aging, cash by shift, **slow-moving stock**
  (no sale movement in N days, N configurable), period-over-period comparison.
- Charts: Recharts (add to `web/`, bundled — no CDN). Follow `docs/design.md` tokens.
- Exports for every report: **Excel** via `exceljs` on the server (`GET /api/reports/...?format=xlsx`
  streams a file), **HTML/PDF** via the existing print-CSS path (A4 print view per report).
- Rebuild the current Reports screen on these endpoints (today it aggregates client-side
  from the full sales list — replace that).
- Tests: aggregate correctness against seeded fixtures, xlsx endpoint returns a valid file,
  slow-moving threshold logic.

### B3. Notification center — V1.3.2

- Server `GET /api/notifications` computes on demand (no new tables needed initially):
  low stock (quantity − reserved ≤ reorderPoint), expiry approaching (consumables within
  configurable days), overdue customer debts (configurable age), warranty endings
  (equipment sale items: saleDate + warrantyMonths within 30 days), expiring quotations
  (validUntil within 3 days). Include type, severity, entity link.
- Web: bell icon in the header with count badge + dropdown list; clicking an item navigates
  to the relevant screen. Settings for the thresholds (extend `settings` table).
- Tests: each notification trigger with fixture data; thresholds respected.

### B4. Warranty & service tickets — V1.3.3

- Schema: `warranties` (auto-created per sold equipment sale_item with serial:
  saleItemId, serialNumber, startDate, months, endDate) and `service_tickets`
  (id, warrantyId nullable, serialNumber, customerId nullable, fault, diagnosis, parts,
  laborCost, partsCost, inWarranty boolean, status open/repairing/done/delivered,
  userId, timestamps). Cash for out-of-warranty repairs goes through the open shift.
- Server: warranty auto-creation inside the sale transaction for equipment items with a
  serial; ticket CRUD; full history lookup by serial number.
- Web: `Warranty.tsx` screen — search by serial, ticket lifecycle, printable A4 ticket
  (reception receipt) via the print system; link from the notification center.
- Tests: warranty auto-creation, in/out-warranty determination by date, ticket cash flow.

---

## Backlog (do only when asked — not part of the milestones)

- Supplier statement of account (mirror of the customer statement).
- Purchase invoice A4 print view.
- `npm audit` cleanup and dependency bumps.
- Playwright smoke test for the POS + print flow (planned in docs/plan.md §4, never built).
- Phase 4 items (cloud sync, multi-branch, installments…) — **each needs explicit owner
  approval before any build** (see roadmap).

## Process checklist for the executing agent

1. Read `AGENTS.md` fully before touching code.
2. One milestone step at a time; commit locally after each green state. **Never push.**
3. Never edit `server/drizzle/*.sql` by hand — change `schema.ts` + `npm run db:generate`.
4. Update `docs/roadmap.md` checkboxes and `سجل-التغييرات.md` (Arabic, per its template)
   when a milestone ships; keep `AGENTS.md` ↔ `CLAUDE.md` in sync if conventions change.
5. If anything in this plan conflicts with reality (schema drift, renamed files), stop and
   tell the user instead of improvising.
