import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Inbox, Loader2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { statusColor, statusLabel, fmtNum } from '../lib/format';

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('flex items-center justify-center py-12', className)}>
    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
  </div>
);

export const Empty: React.FC<{ message?: string }> = ({ message = 'No records found' }) => (
  <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
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
    default: 'text-slate-900 dark:text-slate-100',
    green: 'text-emerald-600',
    red: 'text-rose-600',
    blue: 'text-brand-600',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
      </div>
      <p className={clsx('mt-2 text-2xl font-bold tracking-tight', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onClick={onClose}>
      <div className={clsx('w-full rounded-xl bg-white shadow-pop dark:bg-slate-900 dark:border dark:border-slate-800', sizes[size])} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">{footer}</div>}
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
