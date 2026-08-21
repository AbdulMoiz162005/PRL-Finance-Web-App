# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-08-19
- Context: Discovered by Agent while fixing modal alignment bugs and applying the UI/UX refresh
- Category: Troubleshooting & Debugging
- Instructions:
  - A `transform` on an ancestor (e.g. a retained translateY from an entrance animation with `animation-fill-mode: both`) makes that ancestor the containing block for `position: fixed` descendants, breaking modal centering (forms render half-visible or clipped inside the content column). Page-entrance wrappers must be opacity-only fades, and any modal overlay must be rendered via `createPortal(..., document.body)` (see frontend/src/pages/Surveyors.tsx).
  - Shared chart theming lives in frontend/src/components/charts.tsx (`useChartTheme` via MutationObserver on <html> class, `ChartTip` glass tooltip, `BarGradient`/`AreaGradient`, `PIE_COLORS`); new recharts usages should consume it instead of hardcoding grid/tick colors.
  - `CountUp` (frontend/src/components/ui.tsx) animates numeric StatCard values and respects `prefers-reduced-motion`.

[Project Knowledge Summary]
- Date: 2026-08-16
- Context: Discovered by Agent while pulling and verifying the PRL-Finance-Web-App repository
- Category: Build Methods
- Instructions:
  - Backend requires a local PostgreSQL 15 instance; create user `refinery` and database `refinery_finance` (credentials default in backend/src/config.ts) before starting.
  - Initialization order: `npm run migrate` then `npm run seed` in /workspace/backend, then start backend with `npm run dev` (port 3001) and frontend with `npm run dev` in /workspace/frontend (port 5173, proxies /api to 3001).
  - Seed data provides demo logins in the form `role@prl.com.pk` (e.g. admin/director/accountant/auditor/ops/operator) with a shared demo password `Refinery@2026`.
  - The journal posting workflow requires approval for amounts above the approval threshold (default 50000): create entry -> approve via /api/approvals/:id/decision -> post via /api/journal-entries/:id/post.

[Project Knowledge Summary]
- Date: 2026-08-16
- Context: Discovered by Agent while verifying git ignore rules of the PRL-Finance-Web-App repository
- Category: Troubleshooting & Debugging
- Instructions:
  - The ignore rules file was originally committed as `gitignore` (without the leading dot), so Git ignored no files. Git only honors a file named `.gitignore`; the file must be renamed/committed with the leading dot.
  - Test data created during API smoke tests (journal entries, invoice, payment) may exist in the dev database; rerun migrate + seed against a fresh database to restore a clean seed state.

[Project Knowledge Summary]
- Date: 2026-08-16
- Context: Discovered by Agent while building the Surveyor Invoices & Pay Orders module
- Category: Troubleshooting & Debugging
- Instructions:
  - The surveyor module seed lives in backend/src/db/surveyor_seed.sql and is idempotent: it deletes its own tables first, so it can be re-applied alone with `psql -f surveyor_seed.sql` against the dev database without running the full (non-idempotent) seed.ts.
  - When re-extracting data from the source workbook `Surveyors Invoices 2025-26 Rev-10 (3).xlsm` (Master_Data sheet), the approver columns start at V (col 22 = Approved By, col 23 = Approval Date, col 24 = Snapshot). Using 1-based indexing in a Python generator script, approved_by = row[21] and approved_at = row[22]; earlier code mis-mapped these and fed a person's name into the timestamptz column.
  - Pay order status flow is enforced server-side: draft -> issued -> paid, with draft/issued -> cancelled; paid and cancelled are terminal. The invoice lock check must exclude pay orders with status 'cancelled' or reopen is blocked after a cancelled PO.
  - Invoice data entry and approval run contract-aware automatic checks: unknown/closed contracts, dates outside the contract validity window, and vendor-contractor mismatches are rejected with 400/409; exceeding the contract balance is allowed but flags alert='Overbilling'. The approved-invoice lock and pay order numbering must run inside the transaction using the transaction client (nextEntryNo accepts an optional client), otherwise multi-group auto-generation hits unique violations.

[Project Knowledge Summary]
- Date: 2026-08-16
- Context: Discovered by Agent while releasing v1.0.0 of the PRL-Finance-Web-App repository
- Category: Workflow & Collaboration
- Instructions:
  - Release process for github.com/AbdulMoiz162005/PRL-Finance-Web-App: commit on main, push, then `git tag -a v1.0.0 -m <msg>` + `git push origin <tag>`; create the GitHub release via the API with a token retrieved from the git credential helper (`printf "protocol=https\nhost=github.com\n" | git credential fill | sed -n 's/^password=//p'`) and `curl -X POST https://api.github.com/repos/<owner>/<repo>/releases` with the JSON body in a file. `gh` CLI is not logged in and cannot be used. Store the token in /tmp/prl_token and re-fetch when the API returns "Bad credentials".

[Project Knowledge Summary]
- Date: 2026-08-16
- Context: Discovered by Agent while rebranding to PRL and adding dark theme / sorting / export (v1.1.0)
- Category: Environment Configuration
- Instructions:
  - Company branding is Pakistan Refinery Limited (Korangi Creek, Karachi), currency PKR, NTN tax id `NTN-0001234-5`, company id `00000000-0000-4000-8000-000000000001`. Demo users are `*@prl.com.pk` (Ahmed Raza director, Bilal Khan finance, Sana Malik accountant, Usman Tariq auditor, Farhan Qureshi ops, Imran Sheikh operator), password `Refinery@2026`.
  - Frontend theme is class-based dark mode (`darkMode: 'class'` in tailwind.config.js): an inline script in index.html reads localStorage `rf_theme` (falling back to prefers-color-scheme) and toggles `.dark` on <html> before paint; Layout.tsx has the toggle button. New pages should add `dark:` variants to hardcoded slate/white classes.
  - Backend sort/filter conventions: list endpoints accept `sort_by` (whitelisted via sortSpec map), `sort_dir`, `min_amount`/`max_amount`; adding a new sortable column requires adding it to the whitelist map in surveyors.ts.
  - Export endpoints `/api/surveyors/export/csv` and `/export/pdf` (pdfkit, server-rendered A4) support types `invoices`/`contracts`/`pay-orders` and are restricted to admin/director/accountant/auditor (403 otherwise). Frontend downloads via axios `responseType: 'blob'` and prints with `window.print()` (`.no-print` elements are hidden by the print CSS).
  - After changing tailwind.config.js or index.html, the Vite dev server must be restarted (run as a managed background terminal; port 5173).

[Project Knowledge Summary]
- Date: 2026-08-17
- Context: Discovered by Agent while adding per-Pay-Order print/PDF export and PRL branding (v1.1.x)
- Category: Build Methods
- Instructions:
  - Official PRL logo lives at frontend/public/prl-logo.png (source: https://www.prl.com.pk/wp-content/uploads/2025/03/PRL_NEW_LOGO.png); brand palette navy #2e3c8f, blue #0b74b8, emerald #0b6b2d, red #d71920 is in tailwind.config.js (brand + prl scales).
  - Individual Pay Order documents: frontend component frontend/src/components/PayOrderDoc.tsx renders the formal F.D. 310 layout (print via .pay-order-print CSS in index.css); backend GET /api/surveyors/pay-orders/:id/pdf generates the same document with pdfkit (restricted to admin/director/accountant/auditor).
  - When embedding a binary as a TS string constant for pdfkit doc.image(), write the base64 on a SINGLE line — adjacent quoted string-literal lines get truncated by the esbuild/tsx transform and the decoded buffer silently comes back tiny.

[Project Knowledge Summary]
- Date: 2026-08-20
- Context: Discovered by Agent while building the central command/governance module (dropdown masters)
- Category: Troubleshooting & Debugging
- Instructions:
  - Backend search params: list endpoints read `search` (parseSearch in src/routes/parse.ts reads req.query.search), but the generic MasterCrud frontend component sends `?q=`. Curl/API tests against master endpoints must use `?search=` or search silently returns the first row.
  - `npm run seed` is NOT idempotent for base tables (seed.sql raw inserts, companies_pkey duplicate on re-run). Only surveyor_seed.sql is re-runnable (deletes module tables first). To apply dictionary seeds to an existing DB, run just the surveyor seed file via a tsx one-liner instead of the full seed.
  - Dropdown governance pattern: management CRUD (makeCrud) lists ALL rows including inactive; separate read-only `/options/*` reference endpoints (or a consolidated `/surveyors/references`) filter to active/valid for dropdowns, unioning master values with distinct legacy values so old records stay selectable. New dictionary tables: service_types, cost_elements (company-scoped, code/name/is_active). Surveyor dropdown sources: /surveyors/references (serviceTypes, costElements, vendors, valid contracts = open + unexpired + balance>0).
  - Custom GET options endpoints in master.ts use the shared optionList helper (table + labelExpr), and pay attention that makeCrud's company filter is `where <table>.company_id = $1` with search params appended as $2.
