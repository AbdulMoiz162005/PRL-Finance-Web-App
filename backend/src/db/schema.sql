-- ============================================================================
-- Refinery Terminal Finance System  -  Supabase PostgreSQL Schema
-- Run against a fresh Supabase database (SQL editor or psql). Idempotent.
-- ============================================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('admin','director','accountant','auditor','manager','operator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_type as enum ('asset','liability','equity','revenue','expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cash_flow_category as enum ('operating','investing','financing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entity_status as enum ('active','inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type journal_status as enum ('draft','posted','reversed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending','approved','rejected','not_required');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('draft','issued','partially_paid','paid','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_type as enum ('incoming','outgoing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash','bank_transfer','cheque','card','bank_deposit','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inventory_trx_type as enum ('opening','purchase','sale','receipt','issue','transfer_in','transfer_out','adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_status as enum ('active','disposed','sold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payroll_status as enum ('draft','posted');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Company / Organization
-- ---------------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Refinery Terminal',
  legal_name text,
  tax_id text,
  address text,
  phone text,
  email text,
  currency text not null default 'USD',
  fiscal_year_start date,
  registration_no text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Users & Authentication
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role user_role not null default 'operator',
  status entity_status not null default 'active',
  phone text,
  title text,
  department text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  user_email text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_logs (entity, entity_id);
create index if not exists idx_audit_created on audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------
create table if not exists chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  type account_type not null,
  subtype text,
  cash_flow_category cash_flow_category default 'operating',
  parent_id uuid references chart_of_accounts(id) on delete set null,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  normal_balance text not null default 'debit',
  opening_balance numeric(18,2) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

-- ---------------------------------------------------------------------------
-- Tax & payment terms
-- ---------------------------------------------------------------------------
create table if not exists tax_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  rate numeric(5,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists payment_terms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  days integer not null default 30,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Business partners
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  tax_id text,
  contact_person text,
  phone text,
  email text,
  address text,
  credit_limit numeric(18,2) not null default 0,
  payment_term_days integer not null default 30,
  opening_balance numeric(18,2) not null default 0,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  tax_id text,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_term_days integer not null default 30,
  opening_balance numeric(18,2) not null default 0,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

-- ---------------------------------------------------------------------------
-- Products (refined products & services) and storage
-- ---------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null default 'fuel',
  unit text not null default 'litres',
  tax_code_id uuid references tax_codes(id) on delete set null,
  valuation_method text not null default 'avg',
  opening_qty numeric(18,3) not null default 0,
  opening_unit_cost numeric(18,2) not null default 0,
  sales_account_id uuid references chart_of_accounts(id) on delete set null,
  cogs_account_id uuid references chart_of_accounts(id) on delete set null,
  inventory_account_id uuid references chart_of_accounts(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists storages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null default 'tank',
  capacity numeric(18,3),
  product_id uuid references products(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

-- ---------------------------------------------------------------------------
-- Bank accounts
-- ---------------------------------------------------------------------------
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  bank_name text,
  account_number text,
  currency text not null default 'USD',
  coa_id uuid references chart_of_accounts(id) on delete set null,
  opening_balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fixed assets
-- ---------------------------------------------------------------------------
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null,
  location text,
  purchase_date date not null,
  cost numeric(18,2) not null default 0,
  salvage_value numeric(18,2) not null default 0,
  useful_life_months integer not null default 60,
  depreciation_method text not null default 'straight_line',
  accumulated_depreciation numeric(18,2) not null default 0,
  status asset_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

-- ---------------------------------------------------------------------------
-- Employees (payroll)
-- ---------------------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  department_id uuid references departments(id) on delete set null,
  designation text,
  phone text,
  email text,
  join_date date,
  basic_salary numeric(18,2) not null default 0,
  allowances numeric(18,2) not null default 0,
  statutory_deductions numeric(18,2) not null default 0,
  bank_name text,
  bank_account text,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

-- ---------------------------------------------------------------------------
-- Journal entries (general ledger)
-- ---------------------------------------------------------------------------
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_no text not null unique,
  entry_date date not null,
  type text not null default 'general',
  reference text,
  description text,
  status journal_status not null default 'draft',
  approval_status approval_status not null default 'not_required',
  total_debit numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  created_by uuid references users(id) on delete set null,
  posted_by uuid references users(id) on delete set null,
  posted_at timestamptz,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  reversal_reason text,
  reversed_entry_id uuid references journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_je_date on journal_entries (entry_date);
create index if not exists idx_je_status on journal_entries (status, approval_status);

create table if not exists journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id),
  cost_center_id uuid references cost_centers(id) on delete set null,
  description text,
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_jel_account on journal_entry_lines (account_id);
create index if not exists idx_jel_entry on journal_entry_lines (entry_id);

-- ---------------------------------------------------------------------------
-- Sales invoices (receivables)
-- ---------------------------------------------------------------------------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_no text not null unique,
  invoice_date date not null,
  due_date date,
  customer_id uuid not null references customers(id),
  subtotal numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  status invoice_status not null default 'draft',
  approval_status approval_status not null default 'not_required',
  reference text,
  notes text,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  journal_entry_id uuid references journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inv_customer on invoices (customer_id, invoice_date);

create table if not exists invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  description text,
  quantity numeric(18,3) not null default 1,
  unit_price numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Purchase invoices (payables)
-- ---------------------------------------------------------------------------
create table if not exists purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  bill_no text not null unique,
  bill_date date not null,
  due_date date,
  supplier_id uuid not null references suppliers(id),
  subtotal numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  status invoice_status not null default 'draft',
  approval_status approval_status not null default 'not_required',
  reference text,
  notes text,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  journal_entry_id uuid references journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_po_supplier on purchase_invoices (supplier_id, bill_date);

create table if not exists purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references purchase_invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  description text,
  quantity numeric(18,3) not null default 1,
  unit_price numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  payment_no text not null unique,
  payment_date date not null,
  type payment_type not null,
  party_type text not null,
  party_id uuid,
  invoice_id uuid references invoices(id) on delete set null,
  purchase_invoice_id uuid references purchase_invoices(id) on delete set null,
  bank_account_id uuid references bank_accounts(id) on delete set null,
  amount numeric(18,2) not null default 0,
  method payment_method not null default 'bank_transfer',
  reference text,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_invoice on payments (invoice_id);
create index if not exists idx_payment_purchase on payments (purchase_invoice_id);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table if not exists inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id),
  storage_id uuid references storages(id) on delete set null,
  type inventory_trx_type not null,
  quantity numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  total_value numeric(18,2) not null default 0,
  reference_type text,
  reference_id uuid,
  trx_date date not null,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_inv_product on inventory_transactions (product_id, trx_date);

-- ---------------------------------------------------------------------------
-- Payroll
-- ---------------------------------------------------------------------------
create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  run_no text not null unique,
  period_start date not null,
  period_end date not null,
  status payroll_status not null default 'draft',
  total_gross numeric(18,2) not null default 0,
  total_deductions numeric(18,2) not null default 0,
  total_net numeric(18,2) not null default 0,
  processed_by uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references employees(id),
  basic_salary numeric(18,2) not null default 0,
  allowances numeric(18,2) not null default 0,
  gross numeric(18,2) not null default 0,
  statutory_deductions numeric(18,2) not null default 0,
  net numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_payroll_line on payroll_lines (run_id, employee_id);

-- ---------------------------------------------------------------------------
-- Budgets
-- ---------------------------------------------------------------------------
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_year integer not null,
  name text not null,
  status text not null default 'draft',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_budget_year on budgets (company_id, fiscal_year, name);

create table if not exists budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id),
  cost_center_id uuid references cost_centers(id) on delete set null,
  month integer not null,
  amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_item on budget_items (budget_id, month);

-- ---------------------------------------------------------------------------
-- Tax returns
-- ---------------------------------------------------------------------------
create table if not exists tax_returns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null default 'vat',
  period_start date not null,
  period_end date not null,
  output_tax numeric(18,2) not null default 0,
  input_tax numeric(18,2) not null default 0,
  net_payable numeric(18,2) not null default 0,
  status text not null default 'draft',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, type, period_start, period_end)
);

-- ---------------------------------------------------------------------------
-- Bank reconciliation
-- ---------------------------------------------------------------------------
create table if not exists bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id),
  period_end date not null,
  statement_balance numeric(18,2) not null default 0,
  book_balance numeric(18,2) not null default 0,
  difference numeric(18,2) not null default 0,
  notes text,
  status text not null default 'open',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bank_account_id, period_end)
);

-- ---------------------------------------------------------------------------
-- Approval rules & requests
-- ---------------------------------------------------------------------------
create table if not exists approval_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  min_amount numeric(18,2) not null default 0,
  max_amount numeric(18,2),
  role user_role not null default 'director',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  entity_no text,
  amount numeric(18,2) not null default 0,
  status approval_status not null default 'pending',
  requested_by uuid references users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_approval_status on approval_requests (status, entity_type);
