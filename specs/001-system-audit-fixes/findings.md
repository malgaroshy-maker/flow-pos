# Audit Findings — 2026-07-20

## Automated gate (before fixes)
- `npm run typecheck` — ✅ pass
- `npm test` — ✅ 60/60 pass
- `npm run build` — ✅ pass

## Live API probe (manager + sales tokens)
All route groups respond correctly: auth (login, pin-switch, manager-override), settings, products, customers, suppliers, sales, purchases, quotations, shifts (+active), deposits, stocktaking, warranties, notifications, users, backup (list/create), reports (analytics, excel), expenses, audit-logs.

## Browser walkthrough (Playwright, Chrome)
All 11 manager screens + Home render in RTL Arabic with **zero console errors** as manager. Verified functionally:
- Login (manager + sales), PIN fast-switch with role-based nav filtering
- POS: add to cart, totals math (75.000 LYD), checkout → INV-2026-00011, print modal (A4/thermal)
- Stock side-effects: 18→17, 15→14 after sale; restored after cancel
- Invoice cancel with manager PIN override → status cancelled, stock restored
- Notification center drawer (customer-debt alert present)
- Dark/light theme toggle
- Product create modal
- Backup create (pos_backup_2026-07-20_01-56-17.db), Excel export (xlsx stream)

## Defects found

| # | Sev | Area | Defect |
|---|-----|------|--------|
| 1 | P0 | Mobile/Responsive | **No navigation below 901px.** Sidebar is `hidden min-[901px]:flex` with no drawer/topbar menu — user is trapped on the current screen (no nav, no logout, no theme/user switch). Design.md §8 mandates "fixed topbar (58px, blurred surface) + drawer nav" for <900px. |
| 2 | P1 | POS | **Product cards unreadably narrow.** `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` yields ~125px cards inside the ~500px container at 1280px viewport — names/prices/stock clip. Design.md §8 mandates `minmax(150px,1fr)` auto-fit. |
| 3 | P1 | i18n/dates | **Garbled date-times (bidi).** `toLocaleString('ar-LY')` embeds RTL marks; inside `.mono` (ltr+isolate) output reorders, e.g. "1910:08:21 .2026/7/ م" on Shifts. 14 call sites. Violates design.md §4 (Western digits, LTR-isolated). |
| 4 | P2 | Data fetching | **Sales role fires manager-only requests.** DataContext fetches `/api/shifts`, `/api/users`, `/api/backup/list` unconditionally → repeated 403 console errors for cashiers. Only audit-logs is role-gated. |
| 5 | P3 | UX | Notification drawer never closes on outside-click/Escape — lingers behind modals. |
| 6 | P3 | i18n/cosmetic | Product image file input shows English browser chrome ("Choose File / No file chosen"). |
| 7 | P3 | a11y | Password inputs lack `autoComplete` hints (browser warnings). |

## Fix plan
1. App.tsx: add mobile topbar (menu button) + slide-in drawer nav (all nav items, user card, theme, logout), visible <901px.
2. Pos.tsx: product grid → `grid-cols-[repeat(auto-fill,minmax(150px,1fr))]`.
3. New `web/src/lib/datetime.ts` (`formatDateTime`, `formatDate` — Western digits, LTR-safe) + replace 14 `toLocaleString('ar-LY')` sites.
4. DataContext.tsx: role-gate manager-only fetches.
5. App.tsx: close notification drawer on outside click.
6. AppModals.tsx: styled Arabic file-input button.
7. Add autocomplete attrs where password inputs live.
