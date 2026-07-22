# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Other AI agents (Antigravity, Cursor, Codex, …) read `AGENTS.md`, which mirrors this file — **when you change one, keep the other in sync**.

## Git Rule

**Do NOT push to GitHub unless the user explicitly asks.** Committing locally when the user requests it is fine; pushing is always a separate, explicit instruction from the user.

## Project Status

**Phases 1, 2, and 3 are complete, plus Milestones D–J of the post-Phase-3 hardening plan (latest release V1.5.9, 2026-07-22).** Milestones through V1.4.6 were followed by Milestones F–J: F (real vendor-key licensing, removed Vendor-PIN activation, idle lock) V1.4.7–V1.4.9; G (partial customer sale returns, warranty notifications, automatic daily backups) V1.5.0–V1.5.2; H (Windows Firewall rule, persistent login sessions, ops guide + release checklist) V1.5.3–V1.5.5; version ergonomics V1.5.6–V1.5.8; J (cancel-after-partial-return ledger fix, bcrypt PIN hashing, DB indexing, modal consistency, empty states) V1.5.9. 88 Vitest unit tests (100% green) and 1 Playwright E2E test. See `docs/next-steps.md` and `docs/roadmap.md` for details.

Working today (typechecked, tested, built):

- **Offline Core**: Fastify + SQLite + Drizzle monorepo with 3-decimal milli-LYD monetary precision; migrations through `0018_round_charles_xavier.sql`.
- **Product & Stock**: Equipment vs Consumable branch fields, barcode search/scan, stock movements ledger, manual adjustments; all product routes require a session.
- **Cash Drawer & Shifts**: Shared drawer shift model, initial cash, cash expenses, shift closing with immutable variance audit and auto-backup. All cash in/out (sales, expenses, customer/supplier payments, paid purchases) requires an open shift.
- **POS Invoicing & Print**: Gap-free sequential numbers (`INV-YYYY-NNNNN`, max+1 within the year), A4 equipment invoices (model, serials, warranty, Tafqeet, stamp), 80mm thermal receipts, invoice cancellation with stock & cash/credit reversal.
- **Purchases & Suppliers**: Purchase invoices (`PUR-YYYY-NNNNN`), weighted average cost recalculation, supplier debt tracking & payments.
- **Customers & Credit Sales**: Cash vs Credit toggle, customer debt tracking with overpayment rejection, statement of account with a true (sign-preserving) running balance.
- **Hardening (2026-07-19)**: server-authoritative sale prices (custom price needs manager/PIN, audit-flagged), integer validation on every money/quantity input, string-based money parsing in the web app (no float rounding), crypto session tokens with 12h idle expiry + logout, login/PIN rate limiting, restore path-traversal guard, restore swaps the DB handle safely via `app.swapDatabase`.

Phase 2 additions (2026-07-19): price tiers + per-customer special prices, quotations with atomic convert-to-sale, supplier returns, multi-unit products (base-unit stock, per-unit prices), deposits with equipment reservation, setup bundles, credit limits, per-product tax exemption, product image upload, invoice QR, real A4/thermal print path with Tafqeet + warranty + stamp, customer statement modal.

Phase 3 additions (2026-07-20): barcode stocktaking sessions with blind count and one-click variance-to-adjustment conversion, financial reports with charts and real Excel (`.xlsx`) export, slow-moving stock report, on-demand notification center (low stock, expiry, overdue debts, expiring quotations), auto-created equipment warranties and service tickets with shift-linked repair cash. V1.3.3 added mobile/tablet navigation, bidi-safe dates, and role-gated client fetches; V1.3.4 added server-side manager gates on the backup endpoints and cleared all `npm audit` findings (drizzle-orm 0.45.2, @fastify/static 10, vite 7, uuid/esbuild overrides).

## What This Project Is

An **offline-first, Arabic (RTL) sales & inventory management system** for a café/restaurant supplies business in Libya. It runs on a local server (PC inside the shop) serving a responsive web app to cashier devices over local WiFi — **no internet required for any core function**. Cloud is used only for backups when a connection happens to exist.

## Source of Truth

- `PRD-نظام-المبيعات-والمخزون-v3.1.html` — the original full PRD (Arabic, interactive HTML). Authoritative on requirements.
- `docs/prd.md` — English markdown distillation of the PRD.
- `docs/plan.md` — implementation plan, confirmed decisions, and tech stack.
- `docs/roadmap.md` — the 4 delivery phases and what belongs in each.
- `docs/next-steps.md` — **the execution plan for what to build next** (backlog features, then commercial distribution V1.4.0). Start there when asked to "continue" or "do the next steps".
- `docs/design.md` — the design system (tokens, type, components, print templates). All UI work follows it; extend it before deviating.
- `docs/ops-guide.md` — for whoever runs a FlowPOS install on-site: setup checklist, backup/restore, upgrades, troubleshooting.
- `docs/release-checklist.md` — build/test/verify steps before handing a new installer to a customer.
- `سجل-التغييرات.md` — the official Arabic changelog, one summarized section per version, newest first.
- `تقرير-مميزات-المنظومة.html` — customer-facing features report (Arabic); update it when major features ship.
- `AGENTS.md` — the same working agreement for non-Claude agents; keep it in sync with this file.

If code and docs ever disagree, raise it — do not silently pick one.

## Changelog Rule (سجل التغييرات)

Every time a version is released (a `Vx.y.z` commit) or a meaningful batch of changes lands, **add a summarized Arabic section at the top of the versions list in `سجل-التغييرات.md`** following the template documented at the top of that file: plain Arabic a shop owner can read, grouped as features / fixes / security / UI / docs as applicable, ending with the commit hash and test count. Do not close out work without updating it.

## Non-Negotiable Domain Rules

- **Offline-first**: every feature must work with zero internet, indefinitely. Cloud sync/backup is additive only.
- **Currency**: Libyan Dinar (LYD) with **3 decimal places** in all calculations, storage, and printed output. Never use floating-point for money.
- **UI**: fully Arabic, RTL, light + dark themes, responsive (desktop, tablet, mobile).
- **Two product types with different fields**: equipment (serial number, warranty, model) vs. consumables (batch, expiry date, reorder point). Forms and logic must branch on `type`.
- **Stock is only mutated through recorded movements**: confirming a sale deducts stock, a purchase adds it, adjustments require a reason — every movement lands in `StockMovements` with `balance_after` and the acting user. No direct quantity edits.
- **Everything is attributed**: every sale, payment, expense, and adjustment records the user who did it and (where applicable) the active shift. Shift close computes cash variance and stores it immutably.
- **Quotations never touch stock**; converting a quotation to a sale applies all normal sale side-effects.
- **Multi-unit products**: stock is always tracked in the base unit; packaging units (carton = 20 packs = 1000 cups) convert via `conversion_factor` and carry their own prices. Multi-unit is opt-in per product.
- **Pricing precedence**: customer special price → customer tier (wholesale/retail) → product default.
- **One shared drawer shift**: a single shift per physical cash drawer; all devices feed it; each action still records its employee.
- **Insufficient stock blocks the sale**; a manager PIN override is allowed, logged, and flagged in reports.
- **Discounts are capped** for the sales role (configurable % per invoice); larger discounts need manager PIN; all discounts are logged with the actor.
- **Product cost is weighted average**, recalculated on every purchase; profit reports use it.
- **Invoice numbers are sequential and gap-free** (`INV-YYYY-NNNNN`), generated server-side inside the sale transaction; cancelled invoices keep their number.
- **Server clock only** — clients never supply timestamps.

## Roles

Two launch roles — **Manager** (everything) and **Sales** (sell, shifts, view products, record customer payments, own reports only). A third **Storekeeper** role comes later; design permissions so adding it needs no rework. Fast PIN switching between employees on a shared device is a required pattern.

## Delivery Phases (summary — details in docs/roadmap.md)

1. **MVP**: products (images + barcode), stock, cash sales, A4 invoices with QR + 80mm thermal receipts, users/roles, shifts + cash drawer, cash expenses, themes — all offline.
2. **Full business cycle**: purchases/suppliers, credit sales + receivables (both directions), configurable tax, card payment recording, wholesale/retail + special pricing, quotations, supplier returns, multi-units, deposits/reservations, bundles.
3. **Intelligence**: barcode stocktaking sessions with automatic variance, charts + Excel/HTML/PDF export, slow-moving stock report, notification center, warranty & service tickets.
4. **Future**: cloud sync, multi-branch, payroll/attendance, payment gateway, barcode label printing, WhatsApp sharing, installments (deferred decision — schema is ready, do not build until approved).

Scope discipline matters: 19 approved features across 4 phases is the top project risk. Do not pull later-phase features forward.

## Architecture

npm workspaces monorepo:

- `server/` — Fastify 5 + better-sqlite3 + Drizzle ORM (TypeScript, ESM, NodeNext). SQLite lives at `server/data/pos.db` (WAL + `synchronous=FULL`; gitignored). Migrations in `server/drizzle/` are generated from `server/src/db/schema.ts`. The entrypoint runs migrations + seed on boot and serves the built SPA from `web/dist` when it exists.
- `web/` — React 19 + Vite + Tailwind v4, Arabic RTL. Design tokens (`web/src/styles/tokens.css`) implement docs/design.md; components consume tokens/Tailwind theme names only — never raw hex. Fonts are bundled from Fontsource packages (never CDN). Dev server proxies `/api` to `localhost:3001`.
- **Money is integer milli-LYD** (`server/src/lib/money.ts` — value × 1000). All money math goes through that module.

## Commands

Run from the repo root:

- `npm install` — install all workspaces
- `npm run dev` — server (tsx watch, :3001) + web (Vite, :5173) in parallel
- `npm test` — server Vitest suite; single test: `npx vitest run src/lib/money.test.ts` from `server/`
- `npm run build` — compile server (tsc) + typecheck & bundle web
- `npm run typecheck` / `npm run format` — tsc --noEmit both workspaces / Prettier
- `npm run db:generate` — regenerate migrations after editing `schema.ts`
- `npm run db:migrate` / `npm run db:seed` — apply migrations / seed defaults (also run automatically on server boot)
