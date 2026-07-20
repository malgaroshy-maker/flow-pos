# Plan: Milestone D (V1.3.5)

## Phase 0 — P0 modal restore (V1.2.9 regression)

1. Inventory current infra: `AppModals.tsx` (existing state/handlers), `Modal.tsx` API,
   `types.ts`, App.tsx prop wiring.
2. Extract the 7 modal JSX blocks from `dc33e1c:web/src/App.tsx` (lines ~6341–7600).
3. Rebuild them in `AppModals.tsx` on the current `Modal` component + existing handlers;
   statement modal prints via `setActivePrintDocument({ type: 'statement-a4', ... })`.
4. Verify `typecheck`/`test`/`build`, then browser-verify every restored modal opens
   (login as manager: Purchases, Products, Customers, Settings screens).
5. Local commit.

## Phase 1 — D1 server

1. `schema.ts`: add `supplierPayments` (id, supplierId→suppliers, shiftId→shifts?, amount,
   userId→users, notes?, createdAt) mirroring `customerPayments`; add `supplierReturns`
   (id, purchaseId→purchases, supplierId→suppliers, amount, refundMethod 'debt'|'cash',
   userId→users, createdAt).
2. `npm run db:generate` → new migration; verify it appears in `server/drizzle/`.
3. `suppliers.ts` payment endpoint: insert `supplierPayments` row in the same transaction.
4. `purchases.ts` return endpoint: insert `supplierReturns` row in the same transaction.
5. `GET /suppliers/:id/statement` in `suppliers.ts`, mirroring `customers.ts:355`:
   - rows: purchases (debit = `total - paid`, label نقدي/جزئي/آجل), payments (credit),
     debt-method returns (credit, reference = purchase invoice number);
   - sort ascending by date; running balance; summary block;
   - optional `from`/`to` (YYYY-MM-DD): filter rows, `openingBalance` = balance before `from`.
6. Tests in `server/src/supplier-statement.test.ts` (app.inject pattern).

## Phase 2 — D1 web

1. `StatementA4.tsx`: optional `title` / `partyLabel` / `signatureLabel` props (defaults = current
   customer strings); widen `customer` prop to a `{ name, phone }` shape so a `Supplier` fits.
2. `PrintRoot.tsx`: pass the new optional labels through the `statement-a4` doc.
3. `Purchases.tsx` + `AppModals.tsx`: per-supplier "كشف حساب" button → modal mirroring the
   customer statement modal (fetch, date filter, print via `printDoc`).

## Phase 3 — D2

1. `web/src/print/PurchaseA4.tsx`: business header (same block as StatementA4), supplier info,
   invoice number/date/user, items table, totals (الإجمالي/المدفوع/المتبقي), notes, stamp line.
2. `PrintRoot` union + render branch.
3. `Purchases.tsx`: print button per purchase row → fetch `/api/purchases/:id` → `printDoc`.

## Phase 4 — D3

1. `npm i -D @playwright/test` (root) + `npx playwright install chromium` (one-time, dev-only).
2. `playwright.config.ts`: two `webServer` entries (server :3001 with `POS_DB_PATH=<scratch>`,
   web :5173), `testDir: 'e2e'`.
3. `e2e/prepare-db.ts` (tsx, run by Playwright `globalSetup`): open scratch DB, run server
   migrations + seed, insert one stocked demo product.
4. `e2e/smoke.spec.ts`: login (manager) → open shift → POS cash sale of demo product →
   print modal shows invoice → cancel with manager PIN 1111 → stock restored → close shift.
5. Root script `test:e2e`; `.gitignore` scratch DB + playwright artifacts.

## Phase 5 — Verify & release

1. `npm run typecheck` + `npm test` + `npm run build` after each task; local commit per green state.
2. `npm run test:e2e` green.
3. Arabic V1.3.5 changelog (ميزات جديدة / توثيق) at top of `سجل-التغييرات.md`.
4. Sync `docs/next-steps.md` (D done, next = E), `docs/roadmap.md`, `AGENTS.md` ↔ `CLAUDE.md`.
5. `implementation-summary.md`; final local commit `V1.3.5`. Never push.
