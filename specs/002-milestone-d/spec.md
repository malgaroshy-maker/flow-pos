# Spec: Milestone D — Supplier Statement, Purchase A4 Print, Playwright Smoke (V1.3.5)

**Date:** 2026-07-20
**Status:** In Progress
**Level:** 2

## Goal

Execute Milestone D from `docs/next-steps.md` in full and release it as **V1.3.5**:

- **D1.** Supplier statement of account — mirror of the customer statement.
- **D2.** Purchase invoice A4 print view.
- **D3.** Playwright smoke test wired as `npm run test:e2e` against a scratch DB.

## Scope (frozen)

0. **P0 restore (found during analysis, owner-approved 2026-07-20):** the V1.2.9 refactor
   (`54e0db7`) dropped the rendered JSX of 7 modals — customer statement, supplier form,
   purchase form, supplier return, stock movements, create user, edit user. State, buttons
   and submit handlers survived in `AppModals.tsx`; nothing renders them (dead clicks).
   Restore all 7 from `dc33e1c:web/src/App.tsx`, adapted to the current `Modal` component,
   contexts, and `PrintRoot` print path (statement prints via `statement-a4` print doc, not
   the monolith's inline print overlay). Verify each modal opens in the browser.
1. **D1 server**
   - New tables `supplier_payments` and `supplier_returns` (owner-approved 2026-07-20) via
     `schema.ts` + `npm run db:generate` — never hand-written SQL.
   - `POST /suppliers/:id/payment` inserts a `supplier_payments` row inside its existing transaction.
   - `POST /purchases/:id/return` inserts a `supplier_returns` row (both refund methods) inside its
     existing transaction.
   - `GET /api/suppliers/:id/statement` (optional `from`/`to` query): sign-preserving running-balance
     ledger. Purchases raise debt by their unpaid portion (`total - paid`); `supplier_payments` and
     debt-method `supplier_returns` reduce it. Cash-refund returns never touched debt → excluded.
     Summary mirrors the customer statement (`currentBalance` from `suppliers.debtBalance` vs
     `calculatedBalance` from the ledger); pre-upgrade events fold into `currentBalance` only.
   - 404 with Arabic message for unknown supplier.
2. **D1 web**
   - Parameterize `StatementA4` labels (title / party / signature) without changing customer output.
   - Statement modal per supplier row in the Purchases/Suppliers screen with date-range filter,
     printable A4 through the existing `PrintRoot` / `.print-only` path.
3. **D1 tests** — `server/src/supplier-statement.test.ts` following the `app.inject` pattern:
   running balance vs seeded purchase/payment/return fixtures, cash-refund exclusion, `from`/`to`
   filtering, unknown supplier → 404.
4. **D2** — `web/src/print/PurchaseA4.tsx` per the print-system contract (props in, JSX out);
   `PrintRoot` union entry; print button on each purchase row. No server changes.
5. **D3** — `@playwright/test` at root; `playwright.config.ts` boots server (scratch DB via
   `POS_DB_PATH`, never `server/data/pos.db`) + web; one spec: login → open shift → POS sale →
   print modal renders invoice → cancel invoice with manager PIN (stock restored) → close shift.
   Wired as `npm run test:e2e`, **not** part of `npm test`.
6. Release: Arabic V1.3.5 changelog section (ميزات جديدة / توثيق), `docs/next-steps.md` +
   `docs/roadmap.md` status sync, `AGENTS.md` ↔ `CLAUDE.md` sync, local commits. **Never push.**

## Out of scope

- Milestone E (installer, licensing) — next session.
- Phase 4 items.
- Backfilling historical supplier payments/returns into the new tables (impossible reliably —
  they exist only as localized strings in `cash_movements`/`audit_logs`).
- Pushing to GitHub.

## Success criteria

- `npm run typecheck`, `npm test`, `npm run build` all green; new tests pass.
- `npm run test:e2e` green against the scratch DB.
- Supplier statement reconciles with `debtBalance` for all post-upgrade events.
- Changelog + docs updated per project rules.
