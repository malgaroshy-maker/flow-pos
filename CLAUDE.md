# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**Spec-only — no code has been written yet.** This repository currently contains the product requirements and planning documents for a POS (sales & inventory) system. When scaffolding begins, update this file with real build/test/run commands.

## What This Project Is

An **offline-first, Arabic (RTL) sales & inventory management system** for a café/restaurant supplies business in Libya. It runs on a local server (PC inside the shop) serving a responsive web app to cashier devices over local WiFi — **no internet required for any core function**. Cloud is used only for backups when a connection happens to exist.

## Source of Truth

- `PRD-نظام-المبيعات-والمخزون-v3.1.html` — the original full PRD (Arabic, interactive HTML). Authoritative on requirements.
- `docs/prd.md` — English markdown distillation of the PRD.
- `docs/plan.md` — implementation plan, confirmed decisions, and tech stack.
- `docs/roadmap.md` — the 4 delivery phases and what belongs in each.

If code and docs ever disagree, raise it — do not silently pick one.

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

## Roles

Two launch roles — **Manager** (everything) and **Sales** (sell, shifts, view products, record customer payments, own reports only). A third **Storekeeper** role comes later; design permissions so adding it needs no rework. Fast PIN switching between employees on a shared device is a required pattern.

## Delivery Phases (summary — details in docs/roadmap.md)

1. **MVP**: products (images + barcode), stock, cash sales, A4 invoices with QR + 80mm thermal receipts, users/roles, shifts + cash drawer, cash expenses, themes — all offline.
2. **Full business cycle**: purchases/suppliers, credit sales + receivables (both directions), configurable tax, card payment recording, wholesale/retail + special pricing, quotations, supplier returns, multi-units, deposits/reservations, bundles.
3. **Intelligence**: barcode stocktaking sessions with automatic variance, charts + Excel/HTML/PDF export, slow-moving stock report, notification center, warranty & service tickets.
4. **Future**: cloud sync, multi-branch, payroll/attendance, payment gateway, barcode label printing, WhatsApp sharing, installments (deferred decision — schema is ready, do not build until approved).

Scope discipline matters: 19 approved features across 4 phases is the top project risk. Do not pull later-phase features forward.

## Commands

None yet — no toolchain exists. When the project is scaffolded (see docs/plan.md for the proposed stack), record here: install, dev server, build, lint, test (including single-test invocation), and database migration commands.
