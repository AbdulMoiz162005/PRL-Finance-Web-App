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
- Date: 2026-08-16
- Context: Discovered by Agent while pulling and verifying the PRL-Finance-Web-App repository
- Category: Build Methods
- Instructions:
  - Backend requires a local PostgreSQL 15 instance; create user `refinery` and database `refinery_finance` (credentials default in backend/src/config.ts) before starting.
  - Initialization order: `npm run migrate` then `npm run seed` in /workspace/backend, then start backend with `npm run dev` (port 3001) and frontend with `npm run dev` in /workspace/frontend (port 5173, proxies /api to 3001).
  - Seed data provides demo logins in the form `role@meridianrefinery.ng` (e.g. admin/director/accountant/auditor/ops/operator) with a shared demo password.
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
