# Roadmap

> Four phases as approved in PRD v3.1. Scope discipline is the project's #1 risk mitigation:
> a phase ships complete before the next begins, and later-phase features are not pulled forward.

## Phase 1 — MVP: complete offline operational core

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

## Phase 2 — Full business cycle: purchases, receivables, pricing

**Goal:** both sides of the money — buying and credit — plus real-world pricing.

- Purchases & suppliers (price history; purchase adds stock automatically)
- Credit sales; customer receivables with statements, payments, optional credit limits + alerts, printable A4 statement
- Supplier payables (mirror of customer receivables)
- Configurable tax (enable/disable, rate, optional per-product exemption)
- Card payment recording (manual)
- Wholesale/retail price tiers + per-customer special prices
- Quotations (validity, one-click convert to invoice, no stock impact until converted)
- Supplier returns (linked to original purchase)
- Multi-unit products (carton/pack/piece with conversion factors — opt-in per product)
- Deposits & equipment reservation (held/applied/refunded/forfeited)
- Setup bundles (composite products deducting all components)

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
