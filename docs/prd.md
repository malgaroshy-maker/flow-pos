# PRD — Sales & Inventory System for Café/Restaurant Supplies

> English distillation of `PRD-نظام-المبيعات-والمخزون-v3.1.html` (v3.1, 2026-07-17, draft).
> The HTML file is authoritative; update both when requirements change.

## 1. Problem

The business sells two fundamentally different product kinds — **high-value equipment** (fridges, blenders, espresso machines) and **fast-moving consumables** (coffee beans, cups, plastic containers) — with no real link between sales and stock deduction, no reliable ledger of credit customers' balances, and no shift/cash-drawer accounting or audit trail of who did what.

**Target state:** automatic stock deduction/addition, professional A4 invoices with QR, shift & cash-drawer management, exportable charts/reports — all working fully offline.

## 2. Goals & Scope

### In scope (V1–V3)

- Products with images and barcodes (equipment + consumables, different field sets)
- Smart stocktaking with detailed reports
- Professional A4 invoices with QR code
- Purchases, suppliers, customers, and two-sided receivables (customer debts and supplier debts)
- Employees, shifts, operational cash drawer with expenses
- Reports with charts + Excel/HTML/PDF export
- Configurable tax + cash/card payment (manual card recording)
- Wholesale/retail pricing + per-customer special prices
- Quotations for equipment deals, cash-drawer expenses, supplier returns
- Smart notification center + warranty & after-sales service
- Deposits/equipment reservation + setup bundles
- Light/dark theme + full offline operation

### Out of scope (V1)

- Multi-branch with multi-directional sync
- Full HR (attendance/payroll)
- Real payment gateway/card terminal integration
- Barcode label printing
- Native mobile app (solution is responsive web)
- WhatsApp sharing (deferred to Phase 4)
- Installment sales (**deferred decision** — schema ready, build only if approved)

## 3. Users & Roles

| Permission                               | Manager | Sales           | Storekeeper (later) |
| ---------------------------------------- | ------- | --------------- | ------------------- |
| View products & stock                    | ✓       | ✓               | ✓                   |
| Add/edit product (images, barcode)       | ✓       | —               | ✓                   |
| Record sale & A4 invoice                 | ✓       | ✓               | —                   |
| Open/close shift & drawer + expenses     | ✓       | ✓               | —                   |
| Record purchase / supplier return        | ✓       | —               | ✓                   |
| Manual stock adjustment / stocktake      | ✓       | —               | ✓                   |
| Manage customers, suppliers, receivables | ✓       | view + payments | view only           |
| Quotations                               | ✓       | ✓               | —                   |
| Special prices & credit limits           | ✓       | —               | —                   |
| Manage users & permissions               | ✓       | —               | —                   |
| Financial reports & charts               | ✓       | own sales only  | stock only          |

Operational note: fast **PIN login** per employee on the same shared device at shift change, without full logout.

## 4. Core Features (with acceptance criteria where defined)

### Phase 1

- **Products & stock** — image + barcode per product; equipment fields (serial, warranty, model); consumable fields (batch, expiry, reorder point); full per-product movement ledger. _Acceptance: every confirmed sale deducts quantity immediately and logs the movement with the acting user — no manual step._
- **A4 invoices + QR** — branded A4 template; QR carries invoice reference; cash and credit on the same template; cancel/refund restores stock automatically. _Acceptance: prints on A4 with correct RTL alignment on the first try on any office printer._
- **Employees, shifts & cash drawer** — open shift with opening cash; every sale/payment/expense recorded against the active shift; close compares actual vs. expected cash. _Acceptance: closing any shift shows the variance automatically and saves it to an immutable log._
- **Users & permissions** — manager/sales roles (+storekeeper later); hashed password + optional quick PIN; every operation stamped with actor and time.
- **Offline & security** — local server + encrypted local DB; cloud backup/sync only when internet exists; light/dark theme throughout. _Acceptance: a full week with internet physically disconnected blocks no function._
- **Daily cash expenses** — expense voucher (amount, reason, category) tied to the shift; feeds expected-cash calculation; monthly expense report by category.

### Phase 2

- **Purchases & suppliers** — supplier registry with price history; purchase invoice adds stock automatically; supplier payables mirror customer receivables.
- **Customers & receivables** — optional credit limit; live statement (credit invoices, payments, balance); alert near/over limit; printable A4 statement.
- **Tax & payment** — enable/disable tax, rate set in settings; optional per-product exemption; cash or card (manual recording).
- **Multi-unit sales (carton ↔ piece)** — base unit + packaging units with conversion factors; independent price per unit; stock always deducted in base unit; opt-in per product.
- **Wholesale/retail pricing** — two prices per product; customer tier picks the default; per-customer special price overrides the tier.
- **Quotations** — A4 quote with validity period, same identity as the invoice; one-click convert to invoice; never deducts stock until converted.
- **Supplier returns** — return note deducts stock and reduces supplier payable; linked to the original purchase invoice.
- **Deposits & equipment reservation** — deposit receipt reserves quantity; auto-deducted from the final invoice; clear refund/forfeit policy.
- **Setup bundles** — composite product of several items at a bundle price; selling deducts all components.

### Phase 3

- **Smart stocktaking** — count sessions via barcode (camera or USB scanner); priority ordering by value/turnover; automatic variance detection + report; one-click conversion of variances to adjustments.
- **Comprehensive reports** — sales, profits, stock, receivables with charts; Excel/HTML/PDF export; period comparison; slow-moving stock report; daily dashboard.
- **Notification center** — low stock, coffee nearing expiry, overdue customer debts, expiring warranties, expiring quotations.
- **Warranty & after-sales** — warranty record per sold equipment (auto-starts at invoice date); service tickets (fault, parts, cost, in/out of warranty); full history per serial number.

### Phase 4 (future)

Cloud sync, attendance/payroll, multi-branch, payment gateway, barcode label printing, WhatsApp sharing (invoice/statement/quote PDF), installments (if approved: down payment + schedule + due-date alerts, no interest math).

## 5. Key Workflows

**Sale:** scan/select products → availability check → payment type (cash/card/credit) → if credit, link customer → confirm → _(auto: stock deduction + cash entry + movement log)_ → print A4 with QR.

**Shift:** PIN login → open shift with opening cash → _(auto: every sale/payment/expense recorded to shift)_ → count cash at close → _(auto: variance computed and stored)_.

**Stocktake:** start session (full or by category) → physical count via barcode → _(auto: live comparison with book balance)_ → review variances → approve adjustments (manager permission) → _(auto: PDF/Excel report)_.

**Quotation → invoice:** create quote (no stock deduction) → print/send → customer accepts → one-click convert → _(auto: stock deduction + all normal sale entries)_.

## 6. Screen Map

Dashboard · POS (most-used screen: search/scan, cart, pay, print) · Products · Stock movements · Stocktaking · Purchases · Customers & receivables · Quotations · Shifts & cash drawer · Reports · Settings (business info, logo, tax, users, backup).

## 7. Architecture (proposed in PRD)

One **local server** (PC/mini-PC in the shop) = single source of truth: encrypted local DB + backend API. Clients (cashier PCs, tablet/phone for camera barcode, USB scanner) connect over local WiFi. No internet required. When internet exists: cloud backup + read-only remote reports. Single-site V1 → no conflict resolution needed.

## 8. Data Model (entities)

- **Products**: id, name, type(equipment/consumable), category, base_unit, image_url, barcode, cost_price, retail_price, wholesale_price, quantity, reorder_point, serial_number\*, warranty_months\*, batch_no\*, expiry_date\* (\* = type-specific)
- **ProductUnits** (optional per product): unit_name, conversion_factor, retail_price, wholesale_price, barcode?
- **Sales / SaleItems**: customer_id?, user_id, shift_id, payment_type(cash/credit), payment_method(cash/card), tax_amount, discount, qr_ref, total, status; items with unit_id?, quantity, unit_price
- **Quotations**: customer_id?, valid_until, status(draft/sent/accepted/expired), converted_sale_id?
- **Suppliers / Purchases / PurchaseItems / SupplierPayments / SupplierReturns**
- **Customers**: price_tier(retail/wholesale), credit_limit?; **CustomerPrices** (special price per product); **Payments** (customer_id, sale_id?, shift_id, amount, method)
- **Employees / Shifts** (opening_cash, expected_cash, actual_cash, variance) / **CashMovements** (type: sale/expense/withdrawal/deposit)
- **StocktakeSessions / StocktakeItems** (expected_qty, counted_qty, variance) / **StockMovements** (type: sale/purchase/adjustment/return/supplier_return, quantity, balance_after, user_id)
- **Users** (password_hash, pin?, role, active) / **Settings** (business_name, logo, tax_enabled, tax_rate, currency=LYD, theme_default, backup_config) / **AuditLog**
- **Warranties / ServiceTickets / Deposits** (status: held/applied/refunded/forfeited) / **Bundles + BundleItems / Notifications** (type: low_stock/expiry/debt_due/warranty_end/quote_expiry) / **Installments** (deferred — build only if approved)

## 9. Non-Functional Requirements

| Area        | Requirement                                                                           |
| ----------- | ------------------------------------------------------------------------------------- |
| Language/UI | Full Arabic RTL, light + dark themes, responsive (mobile/tablet/desktop)              |
| Currency    | LYD with 3 decimal places everywhere                                                  |
| Performance | Sub-second responses on LAN; POS screen opens in seconds                              |
| Security    | Hashed passwords, encrypted DB, strict permissions, full audit log, idle session lock |
| Reliability | Full offline operation is non-negotiable; cloud is backup only                        |
| Backup      | Automatic daily local backup + cloud copy when online + one-step restore              |
| Scalability | Architecture allows future branches/roles without a rebuild                           |

## 10. Success Metrics

- ~0% variance between recorded and physical stock under continuous use
- < 60 seconds to record and print a complete sale
- 0 data-loss incidents during internet outages

## 11. Assumptions & Risks

| Type       | Description                                        | Mitigation                                           |
| ---------- | -------------------------------------------------- | ---------------------------------------------------- |
| Assumption | Single site currently                              | V1 targets one site, one local server                |
| Risk       | Scope creep: 19 approved features over 4 phases    | Strict phase discipline; MVP first                   |
| Risk       | Complexity of smart stocktaking & advanced reports | Start with simple manual stocktake, add smarts later |
| Risk       | LAN setup (static IP for server)                   | Simple ops guide at delivery                         |
| Risk       | Data growth (invoices, shifts, movements)          | Choose a DB that supports growth                     |

## 12. Open Questions (pre-build checklist)

Answered 2026-07-17 (recorded in `docs/plan.md` §0):

1. ~~What is the current tracking tool/method?~~ → **Fresh start, no data migration.**
2. ~~Is cloud storage for backups available?~~ → **Deferred; local backups only in V1.**
3. ~~Is the tax rate known now?~~ → **Configured later; tax engine ships disabled.**
4. ~~How many concurrent POS devices?~~ → **2–3.**

Still open:

3. Is a credit limit mandatory for every credit customer, or fully optional? (decide in Phase 2)
4. What logo/identity should the official A4 invoice template use? (needed before invoice slice; Settings-configurable)
5. Which products actually need multi-unit selling? (opt-in per product, Phase 2)
6. Installments: adopt in the future or is open credit enough? (deferred — Installments entity is ready)
