# Design System — نظام المبيعات والمخزون

> The application design system, extending the visual identity established in `PRD-نظام-المبيعات-والمخزون-v3.1.html`.
> Authoritative for all UI work. If a screen needs something this file doesn't define, extend this file first, then build.

## 1. Identity

**Paper ledger, Flow Dev blue.** The app feels like impeccably organized shop paperwork that happens to be digital: crisp slate surfaces, electric-blue ink, royal-blue annotations, receipts and stamps. Calm, trustworthy, fast — never a flashy SaaS dashboard.

> **Naming note (since V1.6.0):** the `--jade` and `--copper` tokens keep their original names for backward compatibility, but no longer render jade-green or copper-orange — both are now blue hues drawn from the Flow Dev logo (`--jade` = electric cyan-blue primary, `--copper` = royal-blue secondary). Treat the names as historical labels for "primary accent" / "secondary accent," not literal colors, when reading this doc or the code.

1. **Arabic-first, RTL always.** LTR appears only inside isolated data fragments (numbers, codes, barcodes).
2. **Speed over spectacle.** A full cash sale in under 60 seconds; every interaction optimizes for the next tap.
3. **Money and stock are monospaced.** Every quantity, price, balance, and document number renders in the mono face with tabular digits.
4. **State reads at a glance** — shape + words + color, never color alone.
5. **Documents are always paper.** Invoices, receipts, quotes, and statements render on light paper in _both_ themes — a receipt is white even at night.

## 2. Signature Elements

Three signatures, one family — each lives in exactly one place. Nothing else in the UI borrows them; that discipline is what keeps them meaningful.

### 2.1 The live receipt cart (POS screen only)

The POS cart **is a thermal receipt being written**. A paper-white column (`--paper`) with the business name at top; each added item appends as a printed mono line (name · qty · amount) separated by dashed hairlines; the running total sits at the bottom above a perforated tear-off edge. Adding an item slides the new line in from above the total (150ms, ease-out) — the cashier watches the receipt print itself. Quantity steppers and line removal live on each line; the confirm button sits directly under the tear-off edge. In dark theme the receipt stays paper-white against the dark room — like a real receipt under counter light. `prefers-reduced-motion`: lines appear without animation.

### 2.2 Rubber-stamp states (documents & confirmation moments only)

Document status renders as an **angled ink stamp**: Cairo 800 text inside a 2.5px border, rotated 8°, at 85% opacity.

| Stamp                       | Color  | Where                                    |
| --------------------------- | ------ | ---------------------------------------- |
| مدفوعة / مكتملة             | jade   | Paid invoices, closed balanced shifts    |
| مسودة / معلّقة / دفعة جزئية | copper | Drafts, pending quotes, partial payments |
| ملغاة / متأخرة              | alert  | Cancelled documents, overdue receivables |

Placement: top-start corner of document previews and A4 prints (prints use the same stamp in grayscale-safe black outline when not color-printed). **The confirmation moment:** when a sale is confirmed, the مدفوعة stamp presses onto the receipt — scale 1.2→1 with a 200ms settle, once. This is the app's single orchestrated animation. Stamps never appear in tables or lists — those use badges (§7).

### 2.3 Perforated ticket edges (documents only)

The zig-zag ticket edge marks anything that is a document: the receipt cart's tear-off, invoice/quote previews, and printed templates. Never on ordinary cards, KPIs, or panels.

## 3. Color

Tokens are CSS custom properties on `:root`; dark values are redefined under `@media (prefers-color-scheme: dark)` and again under `[data-theme="dark"]` / `[data-theme="light"]` so the in-app toggle always wins. Components use tokens only — never raw hex.

### Core palette

| Token          | Light     | Dark      | Role                                                    |
| -------------- | --------- | --------- | ------------------------------------------------------- |
| `--bg`         | `#F8FAFC` | `#0B0F19` | App background (slate paper / deep Flow midnight navy)  |
| `--surface`    | `#FFFFFF` | `#111827` | Cards, panels, tables                                   |
| `--surface-2`  | `#F1F5F9` | `#1F2937` | Nested fills: table headers, KPI tiles, input wells     |
| `--paper`      | `#FFFFFF` | `#FFFFFF` | **Documents & receipt cart — identical in both themes** |
| `--ink`        | `#0F172A` | `#0F172A` | Text on `--paper` — documents are ink on paper, always  |
| `--text`       | `#0F172A` | `#F8FAFC` | Primary text                                            |
| `--text-muted` | `#64748B` | `#94A3B8` | Secondary text, labels, captions                        |
| `--border`     | `#E2E8F0` | `#1E293B` | Hairlines, card borders, dividers                       |
| `--jade`       | `#0284C7` | `#38BDF8` | Primary accent (Flow electric cyan-blue): confirm, money-in, success, active nav |
| `--jade-2`     | `#0369A1` | `#00B2FE` | Primary accent hover/pressed                             |
| `--copper`     | `#2563EB` | `#60A5FA` | Secondary accent (Flow royal blue): warnings, low stock, credit/debt, eyebrows |
| `--copper-2`   | `#1D4ED8` | `#93C5FD` | Secondary accent hover/pressed                           |
| `--alert`      | `#EF4444` | `#F87171` | Destructive, stock-out, shortage, overdue               |

### Semantic mapping (do not invent new colors)

- **Success / money-in / in-stock** → jade · **Warning / low stock / pending / credit** → copper · **Danger / stock-out / delete / overdue** → alert · **Neutral info** → muted on `--surface-2`.
- Cash **variance**: surplus = copper (investigate), shortage = alert, balanced = jade.
- Stamps on `--paper` use the _light-theme_ ink values (`#0284C7` / `#2563EB` / `#EF4444`) in both themes — ink doesn't glow.

### Usage rules

- **Quiet chrome:** sidebar, headers, and nav stay neutral paper; jade appears only on actions, totals, active states, and money-in. One jade-filled primary action per screen region.
- Copper never sits on jade or vice versa; they meet only across a neutral.
- Tinted fills derive from tokens via `color-mix(in srgb, var(--jade) 12%, transparent)` — no hand-picked pastels.
- Dark theme is designed, not inverted: shadows deepen (`rgba(0,0,0,.55)`), accents brighten, paper warmth stays. Every component ships in both themes; theme choice persists per device.

## 4. Typography

All fonts **bundled locally as woff2** (`/public/fonts/`) via `@font-face` — the offline rule forbids CDN fonts. Verify zero network font requests; silent fallback to system Arabic fonts is a bug.

| Role    | Face               | Weights | Usage                                                       |
| ------- | ------------------ | ------- | ----------------------------------------------------------- |
| Display | **Cairo** / **Readex Pro** | 600–900 | Screen titles, brochure reports, card headings, stamps, money-confirm buttons |
| Body    | **Tajawal** / **Readex Pro** | 300–700 | Everything readable: body, forms, tables, brochure reports, nav |
| Data    | **JetBrains Mono** | 400–700 | Numbers, prices, quantities, barcodes, refs, receipt lines  |

### Type scale (rem, base 16px)

| Token      | Size            | Face/weight                              | Use                           |
| ---------- | --------------- | ---------------------------------------- | ----------------------------- |
| `display`  | clamp 1.75–2.25 | Cairo 800                                | Screen title (one per screen) |
| `h2`       | 1.25            | Cairo 800                                | Section/card group            |
| `h3`       | 1               | Cairo 700                                | Card title                    |
| `body`     | 0.9375          | Tajawal 400                              | Default                       |
| `label`    | 0.8125          | Tajawal 500                              | Form labels, table headers    |
| `caption`  | 0.75            | Tajawal 400 muted                        | Help text, timestamps         |
| `eyebrow`  | 0.75            | Mono 500, `letter-spacing:.08em`, copper | Section markers, doc metadata |
| `money-lg` | 1.5             | Mono 700 jade                            | Cart total, KPI values        |
| `money`    | 0.875           | Mono 500                                 | Prices in lists/tables        |
| `stamp`    | 1.125           | Cairo 800, `letter-spacing:.04em`        | Stamp text only               |

### Rules

- Arabic body `line-height: 1.7`; headings `1.35` with `text-wrap: balance`; running text max `65ch`.
- **Numerals are Western digits (0–9)**, never Arabic-Indic — matches documents and scanner output.
- Every numeric fragment: mono face, `direction: ltr`, `unicode-bidi: isolate`, `font-variant-numeric: tabular-nums` — one shared `.mono` utility.
- **Currency format:** `1,067.750 د.ل` — thousands separator, exactly 3 decimals, suffix outside the LTR isolate. One shared formatting function; no ad-hoc `toFixed`.

## 5. Space, Shape, Elevation

- **Spacing scale:** 4px base — `4, 8, 12, 16, 20, 24, 32, 40, 56`. Siblings spaced with flex/grid `gap`, not margins.
- **Radius:** `14px` cards/modals · `10px` buttons/inputs · `999px` pills/chips · `4px` documents (paper is square-ish).
- **Borders:** 1px `--border` on surfaces over `--bg`. Dashed borders are reserved for receipt/document dividers and "automatic step" indicators.
- **Shadow:** one level — `0 10px 30px -12px rgba(20,20,10,.18)` (dark `0 14px 34px -12px rgba(0,0,0,.55)`) for modals, popovers, the receipt cart, and primary-button hover. Cards and tables rely on borders.

## 6. Density Modes & Layout

Two density contexts, set once via `data-density` on the screen container — components read tokens, never hardcode sizes:

| Token             | `touch` (POS, shifts, PIN, stocktake counting) | `compact` (back-office tables, reports, settings) |
| ----------------- | ---------------------------------------------- | ------------------------------------------------- |
| Control height    | 48px (payment/confirm 56px)                    | 36px                                              |
| Base font         | 15px                                           | 13.5px                                            |
| Table row padding | 14px                                           | 8px                                               |
| Grid gap          | 16px                                           | 10px                                              |

- **Desktop (≥900px):** fixed neutral sidebar 272px at the RTL start; content max `980px` for forms/reports; POS uses full width. Sidebar nav order (since V1.6.0) follows daily-use frequency, not feature grouping: لوحة التحكم → نقطة البيع → المنتجات والمخزون → التوكة والخزينة → المشتريات والموردين → العملاء والذمم → التقارير المالية → عروض الأسعار → الجرد الذكي → الضمان والصيانة → الإعدادات العامة. The user/PIN-switch card moved from the top of the sidebar to the bottom (`mt-auto`), above the app-wide quick-action buttons which now live in the header instead (see below).
- **Tablet/mobile (<900px):** fixed topbar (58px, blurred surface) + drawer nav; safe-area insets respected. On POS, the receipt cart becomes a bottom sheet with a persistent total bar (mono total + item count always visible).
- **Header quick actions (since V1.6.0):** the sticky header's end side carries persistent icon/label buttons — ربط الجوال (QR), theme toggle (☀️/🌙), settings shortcut (manager only, highlights when active), and logout — replacing the sidebar's former bottom action stack.
- **Background watermark:** a fixed, centered, grayscale Flow Dev logo sits behind all content (`body::before`, `min(500px,65vw)`, opacity `0.035` light / `0.045` inverted dark) — decorative only, `pointer-events:none`, must never reduce text contrast below §13's thresholds.
- **POS anatomy:** scan/search field permanently focused at top (scanner-first; refocuses after every action); product grid `minmax(150px,1fr)` center; receipt cart at the RTL end. A cash sale completes without scrolling.
- Wide tables live in `overflow-x:auto` wrappers, sticky first column on mobile; the page body never scrolls horizontally. KPI rows: `repeat(auto-fit, minmax(140px,1fr))`, max 4.

## 7. Components

**Buttons** — heights per density mode. Primary: jade fill, white Cairo 700. Secondary: `--surface` + border. Destructive: alert fill, only in confirm dialogs. Disabled: 45% opacity, no motion. Hover `translateY(-1px)` + shadow; pressed none.

**Inputs** — `--surface` field, `--border`, focus ring `2px var(--jade)` offset 2px. Labels above, Tajawal 500. Errors: alert border + text that says what happened and what to do. Numeric inputs get `.mono` + LTR isolation.

**Chips / filters** — pill, `--surface` + border; active = jade fill, white text; counts in mono 11px.

**Badges** (lists & tables — stamps are for documents) — pill, 10.5px mono, 1px colored border + colored text: jade = متوفر / مفتوحة / مدفوعة، copper = منخفض / آجل / مسودة، alert = نافذ / متأخرة / ملغاة.

**KPI tiles** — `--surface-2`, mono value 18px (jade, or alert when bad), 11.5px muted label.

**Tables** — header `--surface-2` Cairo 700 13px; numeric columns `.mono`, aligned; row hover `--surface-2`; first column entity name in `--text`, rest muted.

**Modals & sheets** — `--surface`, radius 14, shadow, backdrop `rgba(0,0,0,.4)`; bottom sheet on mobile. One primary action; ESC/backdrop closes except mid-payment.

**Toasts** — jade fill (alert on failure), bottom center, Cairo 700 13.5px, 3s.

**Stepper** — buttons per density; mono quantity; long-press repeats.

**PIN pad** — 3×4 grid, 64px keys, mono digits; modal for user switch and manager overrides; the override reason is stated on the same dialog.

**Empty states** — one muted sentence + one action button. No illustrations in V1.

## 8. Voice & Microcopy

Words are design material. Written in Arabic, from the cashier's side of the counter:

- **Controls name the action + object:** «تأكيد الفاتورة»، «إغلاق الوردية»، «حفظ المنتج» — never «إرسال» or «موافق».
- **The name survives the flow:** the button «تأكيد الفاتورة» produces the toast «تم حفظ الفاتورة INV-2026-00231».
- **One vocabulary:** فاتورة، عرض سعر، وردية، حركة مخزون، ذمة — fixed terms, never synonyms per screen.
- **Errors say what and what now, no apology:** «الكمية المتاحة 3 فقط — عدّل الكمية أو اطلب موافقة المدير».
- **Empty states invite:** «لا منتجات بعد — أضف أول منتج».
- Confirmations restate the amount: «إلغاء فاتورة بقيمة 135.750 د.ل؟».

## 9. Interaction Rules

- Touch targets ≥44×44px everywhere; ≥56px for POS confirm/payment.
- Barcode field regains focus after every scan/action (USB scanners type + Enter).
- Manager overrides (discount above cap, stock override) open the PIN pad inline — never navigate away mid-sale.
- Full tab order, visible focus, Enter confirms the sale from the cart; shortcuts listed in Settings.
- Idle lock returns to the PIN screen; the in-progress cart survives the lock.

## 10. Motion

- Durations: 150ms hover/press and receipt-line append · 250ms drawer/sheet/toast · 350ms theme cross-fade. Easing `ease-out`.
- **The stamp press (§2.2) is the only orchestrated moment** in the sense of a one-shot narrative animation tied to a business event. Since V1.6.0, every button, link, and icon additionally carries app-wide hover/press micro-feedback (icon spring-pop `scale(1.15–1.18)` + slight rotate/lift on hover, colored `drop-shadow` glow keyed to `--jade`/`--copper`/`--alert`, button `translateY(-1.5px)` on hover and `scale(0.97)` on press) — this is ambient, not orchestrated, and applies globally rather than to one signature element. Treat it as the current baseline interaction feel; don't add further ambient motion beyond this without updating this section.
- `prefers-reduced-motion: reduce` disables all transitions and animations globally, including the micro-animations above.

## 11. Documents (print)

Shared identity: logo/name (Settings) top-start, mono doc number + date top-end, dashed dividers, mono amounts, jade grand total (black in print), status stamp when applicable, QR bottom-start, payment pill bottom-end, perforated edge motif.

- **A4 equipment invoice / quotation / customer statement:** `@page { size: A4; margin: 15mm }`; black-on-white, independent of theme tokens; Cairo/Readex Pro headings ≥11pt, body 10pt, mono 10pt; equipment invoices feature model name, serial numbers, warranty terms, stamp title, and Arabic `Tafqeet` currency spelling; statements feature running account balance ledger; stamps print as black outline unless color-printed; RTL alignment verified on physical printers (PRD acceptance).
- **80mm thermal receipt:** 72mm printable, single column, Tajawal 9pt / mono 9pt, pure black only, dashed separators, QR ≥20mm, generous feed. Kiosk-print mode — no dialog. The printed receipt and the on-screen receipt cart are visibly the same artifact.

## 12. Charts (Phase 3)

- Series order: jade → copper → muted olive `#8B907C` → jade-2; max 4 series, aggregate beyond.
- Money axes mono with 3-decimal tooltips; comparison periods at 40% opacity of the same hue.
- Area fills 12% opacity; faint `--border` gridlines; emphasized latest point.
- Semantic exceptions: shortage/negative always alert; low-stock always copper.
- Time axes run newest-at-left, clearly labeled.

## 13. Accessibility

- Text contrast ≥4.5:1 in both themes (token pairs above pass; verify any new pair, including on `--paper`).
- State = shape + words + color, never color alone.
- Focus visible (2px jade outline) on every interactive element.
- `lang="ar" dir="rtl"` on the root; LTR fragments isolated so punctuation never scrambles.
- Form errors associated via `aria-describedby`.

## 14. Implementation Notes

- Tokens live in one file (`tokens.css` / Tailwind theme) mapped as `bg-surface`, `text-jade`, etc. No component hardcodes a hex or a control height.
- Theme mechanism: `:root` tokens → `prefers-color-scheme` override → `[data-theme]` override (toggle wins both directions); persisted in localStorage per device.
- Density mechanism: `data-density="touch|compact"` on screen containers redefines the density tokens of §6.
- Fonts: woff2 subsets (Arabic + Latin) committed to the repo.
- Print CSS is its own stylesheet, black-and-white, theme-independent.
- The PRD HTML remains a living reference for the identity — when in doubt, match it.
