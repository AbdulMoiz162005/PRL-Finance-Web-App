# PRL Finance Web App

Refinery finance management system for **Pakistan Refinery Limited (PRL)**, Karachi — Korangi Creek (head office & Tankfarm) and Keamari Terminal branch.

A full-stack finance suite covering core accounting, approvals, and — newly added — automated **Surveyor Invoice Processing & Pay Order (F.D. 310) automation**.

## Features

### Core modules
- **Dashboard** — revenue/expense overview, cash position, top customers, recent activity
- **Journal Entries** — double-entry booking with approval workflow (threshold-based)
- **Sales Invoices / Purchase Bills** — invoice lifecycle and posting
- **Payments** — outgoing payments tracking
- **Inventory** — stock tracking
- **Payroll** — salary processing
- **Fixed Assets** — asset register
- **Tax Management** — VAT/GST style tax handling
- **Reports** — financial reporting
- **Budgets & Bank Reconciliation** — budget tracking and bank statement matching
- **Approval Inbox** — central approval decisioning
- **Audit Trail** — immutable audit logging
- **Chart of Accounts & Settings**

### Surveyor Invoices & Pay Orders (new)
Automated processing of surveyor service contracts and invoices with pay order generation in PRL F.D. 310 format:

- **Control Tower** — consolidated dashboard: invoice volume/value, pending approvals, contract coverage, vendor breakdown, monthly trend
- **Contracts** — surveyor service contracts (inspection, tanker handling, stock dipping, rental, etc.) with live utilization bars and overbilling alerts
- **Invoice processing** — data-entry validation, contract-aware automatic decisioning:
  - rejects unknown / closed / out-of-validity contracts
  - rejects vendor–contractor mismatches
  - flags **Overbilling** when the contract balance is exceeded
  - approve / reject / reopen workflow with a full approval log
- **Pay Orders (F.D. 310)** — manual pay order creation from approved invoices, plus **Auto Generate** which groups all approved un-billed invoices per vendor and creates draft pay orders with `Rupees in Words` amounts automatically
- **Per-Pay-Order document (F.D. 310)** — every pay order can be opened as a formal printable Pay Order document (PRL letterhead, payee/amount in figures & words, payment method, invoice schedule, approval chain and signatures) via **Print**, or exported as a **PDF** (`GET /api/surveyors/pay-orders/:id/pdf`)
- **Analysis** — value by vendor, service type, approval mix, monthly trend
- **Advanced UX** — light/dark theme toggle (system-aware default), clickable column sorting, status / vendor / contract / amount-range filters, and **CSV / PDF export + print** buttons on Contracts, Invoices, Pay Orders and the Approval Log (exports restricted to finance, audit and management roles)

## Tech Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind CSS + Recharts |
| Backend   | Node.js + Express + TypeScript               |
| Database  | PostgreSQL 15 (pg driver, SQL migrations + seeds) |

## Quick Start

Prerequisites: Node.js 18+, PostgreSQL 15 running locally.

```bash
# 1. Create the database (once)
psql -U postgres -c "CREATE USER refinery WITH PASSWORD 'refinery_dev';"
psql -U postgres -c "CREATE DATABASE refinery_finance OWNER refinery;"

# 2. Backend
cd backend
npm install
npm run migrate     # apply schema.sql
npm run seed        # seed core data + surveyor module data (idempotent for module tables)
npm run dev         # API on http://localhost:3001

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev         # Vite on http://localhost:5173, proxies /api -> :3001
```

The surveyor module seed (`backend/src/db/surveyor_seed.sql`) is idempotent — it resets only its own tables, so it can be re-applied anytime without touching the rest of the system:

```bash
psql -h localhost -U refinery -d refinery_finance -f backend/src/db/surveyor_seed.sql
```

## Demo Accounts

Seeded demo logins (password `Refinery@2026`):

| Role        | Email                          |
|-------------|--------------------------------|
| Admin       | admin@prl.com.pk               |
| Director    | director@prl.com.pk            |
| Accountant  | accountant@prl.com.pk          |
| Auditor     | auditor@prl.com.pk             |
| Manager     | ops@prl.com.pk                 |
| Operator    | operator@prl.com.pk            |

> All demo users belong to **Pakistan Refinery Limited (PRL)** — Korangi Creek, Karachi. Company currency is PKR.

## Surveyor Module Workflow

```
Invoice data entry (contract dropdown, auto vendor fill)
        │  automatic contract validation
        ▼
Pending ──approve──▶ Approved ──auto-generate──▶ Draft Pay Order (per vendor)
   │                    │                              │ issue
   │                    │                              ▼
   └──reject──┐         │                            Issued
              │         │                              │ pay
              ▼         ▼                              ▼
          Rejected   (reopen any time)               Paid
```

- Contracts must be `open` and cover the invoice date (`start_date ≤ date ≤ end_date`).
- Invoice `vendor` must match the contract `contractor`.
- Approving an invoice that exceeds the contract balance succeeds but records an `Overbilling` alert.
- An approved invoice is locked into a pay order; cancelling the pay order releases it back.

## API Overview (backend `/api`)

Auth via `POST /api/auth/login` → Bearer token.

| Module | Endpoints |
|--------|-----------|
| Surveyors | `GET/POST/PATCH/DELETE /api/surveyors/contracts`, `.../invoices`, `.../invoices/:id/approve\|reject\|reopen`, `GET/POST /api/surveyors/pay-orders`, `POST /api/surveyors/pay-orders/auto-generate`, `POST .../:id/issue\|pay\|cancel`, `GET .../pay-orders/:id/pdf` (formal F.D. 310 Pay Order document), `GET /api/surveyors/approval-log`, `GET /api/surveyors/dashboard`, `GET /api/surveyors/analysis` |
| Finance    | journal entries, invoices, payments, inventory, payroll, assets, tax, reports, budgets, reconciliations, approvals, audit, masters |

## Project Structure

```
backend/
  src/
    db/          schema.sql, seed.ts, surveyor_seed.sql
    routes/      index.ts, surveyors.ts, <core finance routes>
    middleware/  auth.ts
    config.ts, db.ts, utils.ts
frontend/
  src/
    pages/       Surveyors.tsx, Dashboard.tsx, <...>
    components/  Layout.tsx, ui.tsx
    lib/         api.ts, auth.tsx, format.ts
```
