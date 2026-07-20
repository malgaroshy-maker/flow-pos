# Plan: Full System Audit & Fixes

## Phase A — Automated gate
1. `npm run typecheck` — ✅ passed
2. `npm test` (60 Vitest tests) — ✅ passed
3. `npm run build` — ✅ passed

## Phase B — Repository exploration
1. Map server routes ↔ web screens.
2. Read App.tsx routing, API client, auth context.

## Phase C — Live system verification
1. Boot server (:3001) + web dev (:5173).
2. Verify SPA loads, login works (manager + sales PINs from seed).
3. API smoke probe of each route group via HTTP.

## Phase D — Visual/functional walkthrough (browser)
Screens: Login → Home/Dashboard → POS → Products → Customers → Purchases → Quotations → Shifts → Stocktaking → Warranty → Reports → Settings.
For each: capture snapshot, check console errors, exercise the primary action.

## Phase E — Fix & improve
1. Fix defects found (minimal, in-scope changes).
2. Add/adjust server tests for fixed behavior (follow `app.inject` pattern).

## Phase F — Close-out
1. Re-run typecheck + tests + build.
2. Update `سجل-التغييرات.md` (Arabic, newest-first).
3. Write `implementation-summary.md`.
