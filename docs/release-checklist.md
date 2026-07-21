# Release Checklist

> Run through this before handing a new `FlowPOS Setup x.y.z.exe` to a customer or
> updating an existing install. Companion to `docs/ops-guide.md` (what the customer
> needs to know) and `سجل-التغييرات.md` (what changed, written for the customer).

## 1. Build

- [ ] `npm run typecheck` — server + web, both clean.
- [ ] `npm test` — full Vitest suite green (see `سجل-التغييرات.md` for the current
      count; it should only ever go up).
- [ ] `npm run build` — server (esbuild bundle) + web (Vite bundle) both succeed.
- [ ] `npm run test:e2e` (Playwright smoke test) green, against a scratch DB.
- [ ] Build the installer: double-click `build-installer.bat` in the repo root (does
      everything below in one step and opens `dist-installer\` when done), or
      manually via `npm run package` from the repo root / `npm run dist` from
      `electron/` — builds `FlowPOS Setup x.y.z.exe` into `dist-installer/`. Confirm
      the version number in the output filename matches `electron/package.json`'s
      `version` (bump it before building if it doesn't — this is the version the
      customer-facing changelog entry should also use).

## 2. Changelog & docs

- [ ] `سجل-التغييرات.md`: new section at the top, following its own template
      (plain Arabic, grouped by ميزات جديدة/إصلاحات/أمان/واجهة الاستخدام/توثيق, ending
      with the commit hash and test count).
- [ ] `docs/roadmap.md`: add the release to the post-Phase-3 list if it closes a
      Milestone item from `docs/next-steps.md`.
- [ ] `docs/next-steps.md`: mark the closed item(s) done with a short verification
      note (what was actually checked, not just what was built).
- [ ] If user-facing features changed: `تقرير-مميزات-المنظومة.html` and
      `دليل-مميزات-منظومة-Flow.docx` reflect them (and don't claim anything that
      isn't literally true — e.g. do not claim DB encryption; see `docs/plan.md` §5).
- [ ] `AGENTS.md` ↔ `CLAUDE.md` still in sync if any convention changed.

## 3. Install verification (needs a human — see below)

A silent (`/S`) install of this NSIS package cannot be driven end-to-end by an
automated agent: it's `perMachine` (elevated), and Windows' UAC prompt for that
elevation has no non-interactive answer. A human needs to:

- [ ] On a clean Windows VM or a spare machine: run `FlowPOS Setup x.y.z.exe`
      interactively (not `/S`).
- [ ] Confirm the Windows Firewall rule was added:
      `Get-NetFirewallRule -DisplayName FlowPOS` (elevated PowerShell) shows it.
- [ ] Launch the app; confirm the license activation screen appears with a real
      machine code (not `----`); activate with a real license key from the vendor
      keygen tool (`D:\flowpos-vendor-keygen\keygen.mjs`, or double-click
      `issue-license.bat` in that same folder for a guided prompt — pass the machine
      code, customer name, and optional day count either as arguments or when asked;
      **never** commit that tool, `issue-license.bat`, or the private key to this repo).
- [ ] Log in, open a shift, record a cash sale, print an invoice (confirm it prints
      silently with no OS dialog, on the correct printer if one was configured in
      Settings), cancel the invoice with a manager PIN (confirm stock restores),
      close the shift.
- [ ] From a phone on the same WiFi: scan the QR code from the sidebar, confirm the
      page loads without any firewall prompt appearing.
- [ ] Restart the FlowPOS app (close and reopen, or restart the PC): confirm the
      license is still active and any logged-in cashier session survives (per
      `سجل-التغييرات.md` V1.4.5 and V1.5.4).
- [ ] **Upgrade path**: install the *previous* released version first, use it briefly
      (create a product, a sale), then install the *new* version over it. Confirm
      the database, uploads, and license all survived, and the new version's
      migrations applied cleanly.
- [ ] Uninstall: confirm the Windows Firewall rule was removed
      (`Get-NetFirewallRule -DisplayName FlowPOS` now returns nothing), and that
      `C:\ProgramData\FlowPOS\data` is left untouched (uninstalling must never
      delete customer data).

## 4. Handoff

- [ ] Customer receives the installer file — never source code, never this repo.
- [ ] Per-customer sales contract on file: software licensed per location, not sold.
- [ ] Customer has (or is pointed to) `docs/ops-guide.md`'s content in a form they
      can actually use (translated/adapted to Arabic if needed — this repo's version
      is in English for the development team).
