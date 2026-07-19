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

7. **Refactor `web/src/App.tsx`** (single component, now 7,000+ lines) into per-screen components with a shared API client **before starting Phase 3** — Phase 3's screens (stocktaking, charts, notifications, tickets) do not fit in the monolith.

## Phase 3 — Intelligence: stocktaking, reports, alerts, after-sales

**Goal:** insight and control on top of the operational data.

- Smart stocktaking: barcode count sessions (camera or USB), priority by value/turnover, automatic variance report, one-click conversion to adjustments (manager approval)
- Reports with charts: sales, profit, stock, receivables; period comparison; daily dashboard
- Exports: Excel / HTML / PDF for every report
- Slow-moving & stagnant stock report
- Notification center: low stock, expiry approaching, overdue debts, warranty endings, expiring quotations
- Warranty & after-sales: auto warranty per sold equipment, service tickets (fault, parts, cost, in/out warranty), full history per serial number

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
