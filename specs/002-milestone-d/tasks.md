# Tasks

- [x] Create spec folder (spec.md, plan.md, tasks.md)
- [ ] P0: restore 7 modals lost in V1.2.9 refactor (statement, supplier, purchase, return, movements, create/edit user) + browser verify → local commit
- [ ] D1: schema tables `supplier_payments` + `supplier_returns` + generated migration
- [ ] D1: record rows in payment/return transactions; `GET /suppliers/:id/statement`
- [ ] D1: `supplier-statement.test.ts` green (balance, cash-refund exclusion, from/to, 404)
- [ ] D1: StatementA4 label parameterization + supplier statement modal (Purchases screen)
- [ ] D1 gate: typecheck + tests + build green → local commit
- [ ] D2: PurchaseA4.tsx + PrintRoot entry + per-row print button
- [ ] D2 gate: typecheck + tests + build green → local commit
- [ ] D3: Playwright config + scratch-DB prepare + smoke spec + `npm run test:e2e` green
- [ ] D3 gate: full definition of done → local commit
- [ ] Release V1.3.5: Arabic changelog, docs sync (next-steps/roadmap/AGENTS/CLAUDE), summary
