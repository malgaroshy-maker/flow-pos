# Implementation Plan

> Companion to `docs/prd.md` (requirements) and `docs/roadmap.md` (phases).

## 0. Confirmed Decisions (2026-07-17)

| Decision            | Choice                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment          | **Local server + browsers**: one Windows PC in the shop runs the server; clients connect over WiFi via browser                                                    |
| Server machine      | **Windows PC**, app installed as an auto-starting Windows service                                                                                                 |
| Concurrent devices  | **2–3** (cashier PC + tablet/phone for barcode & stock work)                                                                                                      |
| Printing            | **A4 office printer + 80mm thermal receipt printer** — A4 for equipment/credit invoices, thermal receipt template for quick consumable sales (added to MVP scope) |
| Tax                 | Engine built in Phase 2 but **disabled by default**; enabled via Settings when a rate is known                                                                    |
| Cloud backup target | **Deferred** — daily local backups in V1; cloud target chosen in a later phase                                                                                    |
| Data migration      | **None — fresh start**; products and customers entered manually                                                                                                   |
| Shift model         | **One shared drawer shift** per physical cash drawer; all devices feed it, every action still attributed to its employee                                          |
| Insufficient stock  | **Block the sale; manager PIN can override** — overrides logged and flagged in reports                                                                            |
| Discounts           | **Sales role capped at a configurable % per invoice; larger needs manager PIN; manager unlimited** — all discounts logged with actor                              |
| Cost method         | **Weighted average** — each purchase updates the product's average cost; profit reports use it                                                                    |

## 1. Tech Stack

| Layer              | Proposal                                                                                                   | Why                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Server runtime     | **Node.js (LTS) + Fastify**                                                                                | Single lightweight process on the shop PC; huge ecosystem for printing/QR/Excel; easy for agents to work in one language end-to-end           |
| Database           | **SQLite via better-sqlite3** + SQLCipher (or app-level encryption)                                        | Zero-admin, single file (trivial daily backup/restore), synchronous transactions fit POS integrity needs; handles years of single-site volume |
| Migrations         | **Drizzle ORM** (or Knex) with SQL migrations                                                              | Typed schema shared with the API; deterministic migrations                                                                                    |
| Frontend           | **React + Vite + TypeScript**, RTL-first                                                                   | Responsive SPA served by the local server over LAN; mature RTL/i18n tooling                                                                   |
| UI styling         | Tailwind CSS with `dir="rtl"` + logical properties; Cairo/Tajawal fonts (bundled locally, no CDN)          | Matches PRD identity; offline requirement forbids CDN assets                                                                                  |
| State/data         | TanStack Query + REST JSON API                                                                             | Simple, cacheable, debuggable on LAN                                                                                                          |
| Auth               | Session cookies + bcrypt password hash + per-user quick PIN switch                                         | Matches shared-device shift pattern                                                                                                           |
| Invoices/quotes A4 | HTML + `@media print` CSS templates rendered by the app; QR via `qrcode` lib                               | PRD acceptance: correct RTL A4 print on any office printer, first try                                                                         |
| Thermal receipts   | 80mm receipt HTML template (print CSS, ESC/POS fallback if needed) for quick consumable sales              | Confirmed hardware: A4 printer + 80mm thermal printer                                                                                         |
| Barcode            | USB scanners act as keyboards (no code needed); camera scanning via `BarcodeDetector`/ZXing in the browser | Covers both PRD input methods                                                                                                                 |
| Exports (Phase 3)  | `exceljs` (Excel), print-CSS → PDF, plain HTML                                                             | All offline-capable                                                                                                                           |
| Charts (Phase 3)   | Recharts (bundled)                                                                                         | Offline, React-native fit                                                                                                                     |
| Packaging          | Windows service (NSSM or node-windows) with auto-start; clients open `http://<server-ip>`                  | "Local server = source of truth" per PRD; static-IP ops guide at delivery                                                                     |
| Tests              | Vitest (unit + API integration against a temp SQLite file); Playwright for POS/print smoke tests           | Money math, stock ledger, and shift variance logic must be test-covered                                                                       |

**Money rule:** store all amounts as **integer millidirhams of LYD (value × 1000)**; format with 3 decimals at the edge only. No floats anywhere in money paths.

## 2. Architecture

```
[Shop PC — Windows service]
  Fastify API ── better-sqlite3 ── pos.db (encrypted, single file)
      │ serves /            → React SPA (static build)
      │ serves /api/*       → JSON
      │ daily job           → local backup copy + cloud upload when online
[Clients over LAN WiFi]
  Cashier PCs · tablets/phones (camera barcode) · USB scanners
```

Design rules that fall out of the PRD:

- **All stock changes go through one service function** that writes the `StockMovements` row (with `balance_after`, user, type, ref) in the same transaction as the business document. No other code path may touch `Products.quantity`.
- **All cash effects go through one service function** that writes `CashMovements` against the active shift. Shift close derives expected cash from these rows only.
- **Documents are immutable after confirmation** — cancel/refund creates reversing entries, never edits.
- Role checks live in API middleware keyed by a permission table (so adding Storekeeper later is data, not code).
- Every mutating endpoint writes `AuditLog`.
- **Customer sale returns** (after the day of sale, full or partial): reversing document that restores stock and takes cash from the _current_ shift's drawer; requires manager permission. Never edits the original invoice.

### Hardening & environment realities

- **Power outages are expected** (Libya): SQLite in WAL mode with `synchronous=FULL` for money paths; the ops guide mandates a UPS on the server PC; the app must recover cleanly from hard power loss mid-sale (transaction either fully committed or absent).
- **Camera scanning requires HTTPS**: browsers block `getUserMedia` on plain `http://` LAN origins. The server ships with a locally-generated CA + cert and a one-time install step on each phone/tablet (documented in the ops guide). Solved in slice 1, not discovered in slice 5.
- **Invoice numbers are sequential and gap-free**, generated server-side inside the sale transaction (scheme: `INV-YYYY-NNNNN`; quotations `QUO-`, purchases `PUR-`, returns `RET-`). Cancelled invoices keep their number with a cancelled status — numbers are never reused.
- **Server clock is the only clock.** Clients never supply timestamps. Ops guide covers setting the server timezone (Africa/Tripoli) and correcting drift.
- **Arabic-normalized search**: product/customer search matches across hamza forms (أ/إ/آ/ا), ة/ه, ى/ي, and ignores diacritics and tatweel. Implemented as a normalized shadow column, indexed.
- **Silent thermal printing**: cashier stations run the browser in kiosk-print mode so receipts print without a dialog; A4 invoices may show the normal print preview.

## 3. Build Order (Phase 1 / MVP in vertical slices)

Each slice is shippable and testable end-to-end:

1. **Scaffold** [Completed] — monorepo (server + web), TypeScript, lint/format, Vitest, migrations runner, seed script, RTL app shell with theme toggle (light/dark) and Arabic fonts bundled.
2. **Auth & users** [Completed] — login, bcrypt, roles (manager/sales), PIN quick-switch, idle lock, audit log skeleton.
3. **Products & stock ledger** [Completed] — CRUD with type-branching fields (equipment/consumable), image upload (stored locally), barcode field + search, `StockMovements` ledger + manual adjustment with mandatory reason.
4. **Shifts & cash drawer** [Completed] — open with opening cash, `CashMovements`, expenses with categories, close with counted cash → variance stored immutably.
5. **POS & cash sales** [Completed] — scan/search → cart → availability check → confirm (transaction: sale + stock deduction + cash movement + ledger) → stock and drawer visibly updated.
6. **A4 invoice + QR + thermal receipt** [Completed] — A4 print template with business identity from Settings and QR ref, plus an 80mm thermal receipt template for quick sales; RTL print CSS verified on the physical printers; cancel/refund flow with automatic stock restore.
7. **Dashboard + settings + backup** [Completed] — today's sales, low stock, shift status; Settings (business info, logo, tax placeholder); daily local backup + one-step restore.
8. **Offline validation** [Completed] — the PRD acceptance test: run a full week's workflows with networking to the internet disabled; fix anything that breaks.

Phases 2–3 slices are ordered in `docs/roadmap.md`; each later feature slots into the same ledger/cash/permission frameworks built in Phase 1 (this is why the frameworks come first).

## 4. Testing Strategy

- **Unit**: money math (3-dp rounding), unit conversion factors, pricing precedence (special → tier → default), shift variance calculation.
- **Integration (API + temp DB)**: sale confirmation atomicity (stock + cash + ledger in one transaction, rollback on any failure), refund reversal, credit-limit alerts, quotation conversion.
- **E2E (Playwright)**: POS happy path under 60s, print page renders RTL A4, PIN switch mid-shift.
- **Property-style checks**: for any sequence of movements, `Products.quantity` equals the sum of its `StockMovements`; drawer expected cash equals opening + movements.

## 5. Remaining Open Decisions

1. DB encryption approach: SQLCipher build vs. OS-level (BitLocker) + app-level field encryption — decide during scaffolding (slice 1).
2. Cloud backup target — deferred by decision; revisit after MVP.
3. Invoice/receipt visual identity (logo, business details) — needed before slice 6; configurable in Settings so a placeholder is fine to start.
4. Remaining PRD open questions (docs/prd.md §12): credit-limit policy (Phase 2), which products get multi-units (Phase 2), installments (Phase 4, deferred).
