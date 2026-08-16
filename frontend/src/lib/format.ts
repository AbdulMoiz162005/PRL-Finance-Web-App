export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  department?: string;
  companyId: string;
  companyName: string;
  currency: string;
}

export const fmtMoney = (n: number | string | null | undefined, currency = 'USD', digits = 2): string => {
  const v = Number(n ?? 0);
  const symbol = currency === 'USD' ? '$' : currency === 'NGN' ? '₦' : `${currency} `;
  return `${symbol}${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

export const fmtNum = (n: number | string | null | undefined, digits = 2): string =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtQty = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

export const fmtDate = (d?: string | null): string =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const yearStart = (): string => `${new Date().getFullYear()}-01-01`;

export const monthStart = (offset = 0): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).toISOString().slice(0, 10);
};

export const monthEnd = (offset = 0): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1 + offset, 0).toISOString().slice(0, 10);
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  director: 'Director',
  accountant: 'Accountant',
  auditor: 'Auditor',
  manager: 'Operations Manager',
  operator: 'Operator',
};

export const ROLE_TIER: Record<string, number> = {
  operator: 1,
  accountant: 2,
  manager: 3,
  auditor: 3,
  director: 4,
  admin: 5,
};

export const statusColor = (s?: string): string => {
  switch (s) {
    case 'posted':
    case 'paid':
    case 'approved':
    case 'active':
    case 'issued':
    case 'final':
    case 'reconciled':
    case 'filed':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'pending':
    case 'partially_paid':
    case 'open':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'draft':
    case 'not_required':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    case 'void':
    case 'rejected':
    case 'reversed':
    case 'inactive':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
};

export const statusLabel = (s?: string): string =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
