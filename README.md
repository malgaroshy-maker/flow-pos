# POS — نظام المبيعات والمخزون

An **offline-first, Arabic (RTL) point-of-sale and inventory management system** for a café/restaurant supplies business in Libya. It runs on a local server (a PC inside the shop) and serves a responsive web app to cashier devices over local WiFi — **no internet is required for any core function**. Cloud connectivity, when it exists, is used for backups only.

## Features

**Working today**

- Products with equipment/consumable field sets (serials & warranty vs. batch & expiry), barcode search and scanner support
- Stock managed exclusively through a movements ledger (`balance_after` + acting user on every row); manual adjustments require a reason
- POS screen with cart, cash/credit toggle, cash/card/transfer payment methods, and configurable discount cap (larger discounts need a manager PIN)
- Gap-free sequential invoices (`INV-YYYY-NNNNN`), A4 equipment invoices with Arabic Tafqeet amount spelling and company stamp, 80mm thermal receipts, cancellation with full stock/cash/debt reversal
- Shared cash-drawer shifts: opening cash, expenses, customer/supplier payments and paid purchases all flow through the open shift; closing computes the variance and stores it immutably, then auto-backs-up the database
- Purchases with weighted-average cost recalculation and supplier payables
- Customer receivables: credit sales, debt tracking, payments (overpayment rejected), printable statement of account with a running balance
- Users & roles (manager / sales) with bcrypt passwords, quick PIN switching on shared devices, rate-limited logins, and a full audit log
- Business branding, configurable tax, light/dark RTL themes, local backup & one-click restore

- Pricing tiers (retail/wholesale) with per-customer special prices, resolved server-side (special → tier → default)
- Quotations (`QUO-YYYY-NNNNN`) with validity windows and atomic one-click conversion to invoices
- Supplier returns against original purchases (debt reduction or cash refund)
- Multi-unit products (carton/pack/piece with conversion factors and per-unit prices; stock always in base units)
- Customer deposits with equipment reservation (held/applied/refunded/forfeited), netted off the final invoice
- Setup bundles (composite products at a bundle price, deducting all components)
- Credit limits, per-product tax exemption, product images, and QR codes on printed invoices

**Not yet built** — see [`docs/roadmap.md`](docs/roadmap.md): the `App.tsx` refactor (gates Phase 3), then Phase 3 (stocktaking sessions, charts & Excel/HTML/PDF exports, notifications, warranty tickets) and Phase 4 (cloud sync, multi-branch, and more).

## Non-negotiable domain rules

- **Money is integer milli-LYD** (value × 1000, 3 decimal places). No floating point anywhere in money paths — parsing and formatting are string-based on both server (`server/src/lib/money.ts`) and web (`web/src/lib/money.ts`).
- **Offline-first**: every feature works with zero internet, indefinitely.
- **Stock only changes through recorded movements**; every action is attributed to a user and (where cash is involved) an open shift.
- **Prices are server-authoritative**: a sale at anything other than the product's price requires a manager or a manager PIN, and is flagged in the audit log.
- **Server clock only** — clients never supply timestamps.

## Tech stack

npm-workspaces monorepo:

| Workspace | Stack                                                                                      |
| --------- | ------------------------------------------------------------------------------------------ |
| `server/` | Node.js, Fastify 5, better-sqlite3 (WAL + `synchronous=FULL`), Drizzle ORM, TypeScript ESM |
| `web/`    | React 19, Vite, Tailwind v4, Arabic RTL, bundled Fontsource fonts (no CDN)                 |

The SQLite database lives at `server/data/pos.db` (gitignored). Migrations in `server/drizzle/` are generated from `server/src/db/schema.ts` and run automatically on server boot, along with seeding.

## Getting started

```bash
npm install        # install all workspaces
npm run dev        # server (tsx watch, :3001) + web (Vite, :5173) with /api proxy
```

Default seeded users (change these before real use):

| User | Password | PIN  | Role    |
| ---- | -------- | ---- | ------- |
| مدير | `admin`  | 1111 | manager |
| بائع | `sales`  | 2222 | sales   |

Other commands (run from the repo root):

```bash
npm test           # server Vitest suite (money, API, e2e business cycle, hardening)
npm run build      # compile server + typecheck & bundle web; server serves web/dist when present
npm run typecheck  # tsc --noEmit in both workspaces
npm run db:generate  # regenerate migrations after editing schema.ts
npm run db:migrate / npm run db:seed
```

## Documentation

| Document                                                                       | Purpose                                                                |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [`PRD-نظام-المبيعات-والمخزون-v3.1.html`](PRD-نظام-المبيعات-والمخزون-v3.1.html) | Original full PRD (Arabic) — authoritative on requirements             |
| [`docs/prd.md`](docs/prd.md)                                                   | English distillation of the PRD                                        |
| [`docs/plan.md`](docs/plan.md)                                                 | Confirmed decisions & tech stack                                       |
| [`docs/roadmap.md`](docs/roadmap.md)                                           | The 4 delivery phases, current status, and the Phase 2 completion plan |
| [`docs/design.md`](docs/design.md)                                             | Design system: tokens, typography, components, print templates         |
| [`سجل-التغييرات.md`](سجل-التغييرات.md)                                         | Official Arabic changelog — one summarized section per version         |
| [`تقرير-مميزات-المنظومة.html`](تقرير-مميزات-المنظومة.html)                     | Customer-facing features report (Arabic, printable)                    |
| [`AGENTS.md`](AGENTS.md)                                                       | Working agreement for AI coding agents (Antigravity, Cursor, …)        |
| [`CLAUDE.md`](CLAUDE.md)                                                       | Same agreement for Claude Code — kept in sync with `AGENTS.md`         |

If code and docs disagree, raise it — never silently pick one.
