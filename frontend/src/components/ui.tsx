import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Inbox, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { statusColor, statusLabel, fmtNum } from '../lib/format';

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className, label = 'Loading…' }) => (
  <div className={clsx('flex flex-col items-center justify-center py-14', className)}>
    <div className="relative h-10 w-10">
      <svg className="h-10 w-10 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.12" strokeWidth="3.5" className="text-slate-300 dark:text-slate-700" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="url(#spinGrad)" strokeWidth="3.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="spinGrad" x1="0" y1="0" x2="24" y2="24">
            <stop stopColor="#2e3c8f" />
            <stop offset="1" stopColor="#5f7bd0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pointer-events-none absolute inset-1 rounded-full bg-brand-500/20 blur-md" />
    </div>
    <p className="mt-3 text-xs font-medium text-slate-400 animate-pulse-soft">{label}</p>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('skeleton', className)} />
);

export const SkeletonBlock: React.FC<{ lines?: number; className?: string }> = ({ lines = 4, className }) => (
  <div className={clsx('space-y-2.5', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={clsx('h-4', i === lines - 1 && 'w-2/3')} />
    ))}
  </div>
);

export const CountUp: React.FC<{ value: number; duration?: number; formatter?: (n: number) => string; className?: string }> = ({
  value,
  duration = 700,
  formatter = (n) => fmtNum(n),
  className,
}) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      setDisplay(value);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{formatter(display)}</span>;
};

export const Empty: React.FC<{ message?: string }> = ({ message = 'No records found' }) => (
  <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500 animate-fade-in">
    <Inbox className="h-10 w-10 mb-2" />
    <p className="text-sm font-medium">{message}</p>
  </div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({
  title,
  subtitle,
  actions,
}) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div>
      <h1 className="text-xl font-bold text-slate-900 tracking-tight dark:text-slate-100">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5 dark:text-slate-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const Card: React.FC<{ title?: string; subtitle?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }> = ({
  title,
  subtitle,
  children,
  className,
  actions,
}) => (
  <div className={clsx('card p-5', className)}>
    {(title || actions) && (
      <div className="flex items-start justify-between mb-4">
        <div>
          {title && <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </div>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: 'default' | 'green' | 'red' | 'blue' }> = ({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}) => {
  const tones = {
    default: { chip: 'bg-slate-500/10 text-slate-500 dark:text-slate-300', value: 'text-slate-900 dark:text-slate-100' },
    green: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', value: 'text-emerald-600 dark:text-emerald-400' },
    red: { chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', value: 'text-rose-600 dark:text-rose-400' },
    blue: { chip: 'bg-brand-500/10 text-brand-600 dark:text-brand-400', value: 'text-brand-700 dark:text-brand-400' },
  };
  return (
    <div className="card card-hover relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-500/5 blur-2xl dark:bg-brand-500/10" />
      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone].chip)}>{icon}</span>}
      </div>
      <p className={clsx('relative mt-2 text-2xl font-bold tracking-tight tabular-nums', tones[tone].value)}>{value}</p>
      {hint && <p className="relative mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
};

export const Badge: React.FC<{ status?: string; label?: string }> = ({ status, label }) => (
  <span className={clsx('badge', statusColor(status))}>{label || statusLabel(status)}</span>
);

export const Money: React.FC<{ value: number | string | null | undefined; currency?: string; signed?: boolean }> = ({
  value,
  currency = 'USD',
  signed,
}) => {
  const v = Number(value ?? 0);
  const s = v < 0 ? '-' : signed ? '+' : '';
  const symbol = currency === 'USD' ? '$' : currency === 'NGN' ? '₦' : `${currency} `;
  return (
    <span className={clsx('tabular-nums', v < 0 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100')}>
      {s}{symbol}{fmtNum(Math.abs(v))}
    </span>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}> = ({ open, onClose, title, children, footer, size = 'lg' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in sm:p-8" onClick={onClose}>
      <div className={clsx('w-full rounded-2xl bg-white shadow-pop ring-1 ring-slate-900/5 animate-modal dark:bg-slate-900 dark:ring-white/10', sizes[size])} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 px-5 py-3.5 dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}> = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm' }) => (
  <Modal open={open} onClose={onClose} title={title} size="md"
    footer={
      <>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </>
    }>
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  </Modal>
);

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className }) => (
  <div className={className}>
    <label className="label">{label}</label>
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={clsx('input', props.className)} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={clsx('input', props.className)} />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea {...props} className={clsx('input', props.className)} />
);

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export const DataTable: React.FC<{
  columns: Column[];
  rows: any[];
  rowKey?: string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: any) => void;
  footer?: React.ReactNode;
}> = ({ columns, rows, rowKey = 'id', loading, emptyMessage, onRowClick, footer }) => {
  if (loading) return <Spinner />;
  if (!rows.length) return <Empty message={emptyMessage} />;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 sticky top-0 dark:bg-slate-900">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={clsx('th', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : '', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <tr key={row[rowKey]} className={clsx('tr-hover', onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(row)}>
              {columns.map((c) => (
                <td key={c.key} className={clsx('td', c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : '', c.className)}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  );
};

export const Tabs: React.FC<{
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (k: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 border-b border-slate-200 mb-4 dark:border-slate-800 overflow-x-auto">
    {tabs.map((t) => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        className={clsx(
          'whitespace-nowrap px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
          active === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
        )}
      >
        {t.label}
        {typeof t.count === 'number' && (
          <span className={clsx('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold', active === t.key ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
            {t.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

export const useAsync = <T,>(fn: () => Promise<T>, deps: unknown[] = []) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as { message?: string }).message || 'Failed to load'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error, reload: () => setLoading(true) };
};

export const sum = (arr: any[], key: string): number => arr.reduce((s, r) => s + Number(r[key] || 0), 0);
