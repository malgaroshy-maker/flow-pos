# Spec: Full System Audit & Fixes

**Date:** 2026-07-20  
**Status:** In Progress  
**Level:** 2

## Goal

Run a comprehensive audit of the entire Flow POS system — automated checks (typecheck, tests, build) plus a visual/functional browser walkthrough of every screen and feature — then fix all bugs found and implement targeted improvements.

## Scope (frozen)

1. Automated gate: `npm run typecheck`, `npm test`, `npm run build`.
2. Server: boot, verify migrations/seed, probe every route group (auth, products, customers, suppliers, sales, purchases, quotations, shifts, deposits, stocktaking, warranties, notifications, reports, settings, backup).
3. Web: visual walkthrough of all screens (Login, Home/Dashboard, POS, Products, Customers, Purchases, Quotations, Shifts, Stocktaking, Warranty, Reports, Settings) in the browser; check Arabic RTL rendering, console errors, broken flows.
4. Fix every defect found (server + web), autonomously.
5. Implement small, safe improvements discovered during the audit (no Phase-4 scope creep per AGENTS.md).
6. Re-run the definition of done; update the Arabic changelog.

## Out of scope

- Phase 4 features (cloud sync, multi-branch, installments).
- New major features not tied to a discovered defect.
- Pushing to GitHub.

## Success criteria

- All automated checks green before and after fixes.
- Every screen loads without console errors; core flows work end-to-end in the browser.
- Findings documented in `findings.md`; fixes verified.
