# AGENTS.md

Working agreement for **any AI coding agent** (Antigravity, Cursor, Codex, Claude Code, etc.) operating on this repository. Claude Code additionally reads `CLAUDE.md`, which mirrors this file — **if you change one, keep the other in sync**.

## What This Project Is

An **offline-first, Arabic (RTL) sales & inventory management system** ("منظومة Flow") for a café/restaurant supplies business in Libya. It runs on a local server (a PC inside the shop) serving a responsive web app to cashier devices over local WiFi — **no internet required for any core function**. Cloud is used only for backups when a connection happens to exist.

## Project Status

**Phases 1, 2, and 3, plus Milestones D and E are complete (latest release V1.4.1, 2026-07-20).** All milestones (Refactor Gate V1.2.9, Smart Stocktaking V1.3.0, Financial Reports & Excel V1.3.1, Notification Center & Warranties V1.3.2, Full System Audit & UI Fixes V1.3.3, Security & Dependency Hardening V1.3.4, Supplier Statement & Purchase A4 Print & Playwright Smoke V1.3.5, Commercial Packaging & Offline Licensing V1.4.0, Electron Desktop App & Instant Master Vendor PIN V1.4.1) are implemented and verified by 69 Vitest unit tests (100% green) and 1 Playwright E2E test. See `docs/next-steps.md` and `docs/roadmap.md` for details.

## Hard Rules (never violate)

- **Do NOT push to GitHub unless the user explicitly asks.** Committing locally when the user requests it is fine; pushing is always a separate, explicit instruction from the user.
- **Offline-first**: every feature must work with zero internet, indefinitely. No CDN assets, no external API calls in core paths.
- **Money is integer milli-LYD** (value × 1000, 3 decimal places). Never use floating point for money. All money math goes through `server/src/lib/money.ts` (server) and `web/src/lib/money.ts` (web) — both parse strings, never `parseFloat`.
- **Prices are server-authoritative**: the server resolves the authorized unit price (customer special price → customer tier wholesale/retail → product default; packaging units sell at their own configured price). Any other price requires manager role or manager PIN and is audit-logged.
- **Stock only changes through recorded movements** (`stock_movements` with `balance_after` and the acting user). No direct quantity edits. Bundles deduct their components; packaging units convert to base units via `conversion_factor`.
- **Every cash movement is tied to an open drawer shift** — sales, expenses, customer/supplier payments, paid purchases, deposits, refunds. One shared shift per physical drawer; each action still records its employee.
- **Everything is attributed and overrides are flagged**: insufficient stock, custom prices, over-cap discounts, and credit-limit overshoots all require manager/PIN and land in `audit_logs`.
- **Invoice numbers are sequential and gap-free** (`INV-YYYY-NNNNN`, max existing + 1 within the year, generated server-side inside the sale transaction; cancelled invoices keep their number). Same scheme for `PUR` and `QUO`.
- **Quotations never touch stock or cash**; conversion applies all normal sale side-effects atomically (a quotation can never convert twice).
- **Product cost is weighted average**, recalculated on every purchase.
- **Server clock only** — clients never supply timestamps.
- **UI is fully Arabic, RTL**, light + dark themes, responsive. Components consume design tokens (`web/src/styles/tokens.css`) — never raw hex. Fonts are bundled locally (Fontsource), never from a CDN. Wrap LTR fragments (phone numbers, codes, amounts) in the `mono` utility to avoid bidi reversal.
- **Changelog rule**: every release (`Vx.y.z` commit) or meaningful batch of changes adds a summarized **Arabic** section at the top of the versions list in `سجل-التغييرات.md`, following the template at the top of that file. Do not close out work without updating it.
- **Scope discipline**: do not pull later-phase features forward. Phase 4 items (cloud sync, multi-branch, installments…) each need explicit approval before any build.

## Source of Truth

- `PRD-نظام-المبيعات-والمخزون-v3.1.html` — original full PRD (Arabic). Authoritative on requirements.
- `docs/prd.md` — English distillation of the PRD.
- `docs/plan.md` — confirmed decisions and tech stack.
- `docs/roadmap.md` — the 4 delivery phases and current status.
- `docs/next-steps.md` — **the execution plan for what to build next** (backlog features, then commercial distribution V1.4.0). Start there when asked to "continue" or "do the next steps".
- `docs/design.md` — design system (tokens, type, components, print templates). All UI work follows it; extend it before deviating.
- `سجل-التغييرات.md` — official Arabic changelog, one summarized section per version, newest first.
- `تقرير-مميزات-المنظومة.html` — customer-facing features report (Arabic); update it when major features ship.

If code and docs ever disagree, raise it with the user — do not silently pick one.

## Roles

Two launch roles — **Manager** (everything) and **Sales** (sell, shifts, view products, record customer payments, own reports only). A third **Storekeeper** role comes later; design permissions so adding it needs no rework. Fast PIN switching between employees on a shared device is a required pattern (rate-limited server-side).

## Architecture

npm workspaces monorepo:

- `server/` — Fastify 5 + better-sqlite3 + Drizzle ORM (TypeScript, ESM, NodeNext). SQLite at `server/data/pos.db` (WAL + `synchronous=FULL`; gitignored). Migrations in `server/drizzle/` are generated from `server/src/db/schema.ts` via `npm run db:generate` — **never hand-write migrations or create tables at runtime**. The entrypoint runs migrations + seed on boot, serves the built SPA from `web/dist`, and serves product images from `server/data/uploads` under `/uploads/`.
- `web/` — React 19 + Vite + Tailwind v4, Arabic RTL. Dev server proxies **both `/api` and `/uploads`** to `localhost:3001`. Printing works via a root-level `.print-only` element with visibility-based print CSS — modals are `.no-print`; the browser prints the document, never the screen.

## Commands (run from repo root)

- `npm install` — install all workspaces
- `npm run dev` — server (tsx watch, :3001) + web (Vite, :5173) in parallel
- `npm test` — server Vitest suite (51 tests); single file: `npx vitest run src/pricing.test.ts` from `server/`
- `npm run build` — compile server (tsc) + typecheck & bundle web
- `npm run typecheck` / `npm run format` — tsc --noEmit both workspaces / Prettier
- `npm run db:generate` — regenerate migrations after editing `schema.ts`
- `npm run db:migrate` / `npm run db:seed` — apply migrations / seed defaults (also run automatically on server boot)

**Definition of done for any change:** `npm run typecheck`, `npm test`, and `npm run build` all pass; new behavior has tests in `server/src/*.test.ts` (follow the existing `app.inject` pattern); the changelog is updated per the rule above.
