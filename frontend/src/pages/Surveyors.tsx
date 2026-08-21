import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, FileText, Scale, BadgeDollarSign, ScrollText, BarChart3,
  Plus, CheckCircle2, XCircle, RotateCcw, Send, Banknote, Ban, Search, ShieldAlert, Zap,
  ChevronsUpDown, ArrowUp, ArrowDown, FileDown, FileType2 as FilePdf, Printer,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, errMsg } from '../lib/api';
import { Badge, Card, CountUp, Empty, PageHeader, Spinner, StatCard } from '../components/ui';
import { BarGradient, ChartTip, PIE_COLORS, useChartTheme } from '../components/charts';
import { PayOrderDoc } from '../components/PayOrderDoc';
import { fmtDate, fmtNum } from '../lib/format';
import clsx from 'clsx';

const PKR = (n: number | string | null | undefined): string =>
  `Rs ${Number(n ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

const pkCount = (n: number) => `Rs ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

// Union a governed dropdown's options with the value already on a record so
// legacy free-text entries stay editable while new entries are steered to masters.
const optionSet = (opts: string[], current?: string): string[] => {
  const set = new Set((opts || []).filter(Boolean));
  if (current) set.add(current);
  return Array.from(set);
};

const invStatus = (s?: string | null) => s?.toLowerCase() || 'pending';
const poStatus = (s?: string | null) => s?.toLowerCase() || 'draft';

const downloadExport = async (fmt: 'csv' | 'pdf', type: string) => {
  try {
    const r = await api.get(`/surveyors/export/${fmt}`, { params: { type }, responseType: 'blob' });
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `surveyors_${type}_${new Date().toISOString().slice(0, 10)}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    window.alert(errMsg(e));
  }
};

const downloadPayOrderPdf = async (p: any) => {
  try {
    const r = await api.get(`/surveyors/pay-orders/${p.id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pay_Order_${p.pay_order_no || p.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    window.alert(errMsg(e));
  }
};

// Reusable sortable table header
type SortDir = 'asc' | 'desc';
interface SortState { by: string; dir: SortDir }
const toggleSort = (prev: SortState, col: string): SortState =>
  prev.by === col ? { by: col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by: col, dir: 'asc' };

const SortTh: React.FC<{
  label: string; col: string; sort: SortState; onSort: (col: string) => void;
  align?: 'right'; className?: string;
}> = ({ label, col, sort, onSort, align, className }) => (
  <th
    className={clsx(
      'px-4 py-3 text-left text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400 whitespace-nowrap select-none cursor-pointer hover:text-brand-600 dark:hover:text-brand-400',
      align === 'right' && 'text-right',
      className,
    )}
    onClick={() => onSort(col)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sort.by !== col && <ChevronsUpDown className="h-3 w-3 opacity-50" />}
      {sort.by === col && sort.dir === 'asc' && <ArrowUp className="h-3 w-3" />}
      {sort.by === col && sort.dir === 'desc' && <ArrowDown className="h-3 w-3" />}
    </span>
  </th>
);

const ExportButtons: React.FC<{ type: string; onPrint?: () => void }> = ({ type, onPrint }) => (
  <div className="flex items-center gap-1.5 no-print">
    <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => downloadExport('csv', type)} title="Export CSV">
      <FileDown className="h-3.5 w-3.5" /> CSV
    </button>
    <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => downloadExport('pdf', type)} title="Export PDF">
      <FilePdf className="h-3.5 w-3.5" /> PDF
    </button>
    <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onPrint || (() => window.print())} title="Print">
      <Printer className="h-3.5 w-3.5" /> Print
    </button>
  </div>
);

type Tab = 'tower' | 'contracts' | 'invoices' | 'payorders' | 'log' | 'analysis';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'tower', label: 'Control Tower', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'contracts', label: 'Contracts', icon: <Scale className="h-4 w-4" /> },
  { key: 'invoices', label: 'Invoices', icon: <FileText className="h-4 w-4" /> },
  { key: 'payorders', label: 'Pay Orders', icon: <BadgeDollarSign className="h-4 w-4" /> },
  { key: 'log', label: 'Approval Log', icon: <ScrollText className="h-4 w-4" /> },
  { key: 'analysis', label: 'Analysis', icon: <BarChart3 className="h-4 w-4" /> },
];

export const Surveyors: React.FC = () => {
  const [tab, setTab] = useState<Tab>('tower');

  return (
    <div>
      <PageHeader
        title="Surveyor Invoices & Pay Orders"
        subtitle="Surveyor service contracts, invoice processing and PRL F.D. 310 pay order automation"
      />
      <div className="flex gap-1 border-b border-slate-200 mb-5 dark:border-slate-800 overflow-x-auto no-print">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:text-slate-200',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade-in">
        {tab === 'tower' && <Tower />}
        {tab === 'contracts' && <Contracts />}
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'payorders' && <PayOrders />}
        {tab === 'log' && <ApprovalLog />}
        {tab === 'analysis' && <Analysis />}
      </div>
    </div>
  );
};

/* ------------------------------- Control Tower ------------------------------ */

const Tower: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const t = useChartTheme();

  useEffect(() => {
    api.get('/surveyors/dashboard').then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>;
  if (!data) return <Spinner label="Loading surveyor control tower…" />;
  const s = data.summary;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <StatCard label="Total Invoices" value={<CountUp value={Number(s.total_invoices)} formatter={(n) => fmtNum(n, 0)} />} icon={<FileText className="h-4 w-4" />} hint={`${s.pending_count} pending`} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <StatCard label="Invoice Value" value={<CountUp value={Number(s.total_amount)} formatter={pkCount} />} icon={<BadgeDollarSign className="h-4 w-4" />} tone="blue" hint={`Approved ${PKR(s.approved_amount)}`} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <StatCard label="Pending Approval" value={<CountUp value={Number(s.pending_amount)} formatter={pkCount} />} icon={<ShieldAlert className="h-4 w-4" />} tone={s.pending_count > 0 ? 'red' : 'green'} hint={`${s.pending_count} invoices to review`} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <StatCard label="Contract Coverage" value={<CountUp value={Number(s.contract_value)} formatter={pkCount} />} icon={<Scale className="h-4 w-4" />} hint={`${s.open_contracts} open · consumed ${PKR(s.contract_consumed)}`} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Vendors" subtitle="Invoice volumes per surveyor" className="lg:col-span-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">
                  <th className="py-2">Vendor</th>
                  <th className="py-2 text-right">Count</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.vendors.map((v: any) => (
                  <tr key={v.vendor} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-200">{v.vendor}</td>
                    <td className="py-2 text-right">{v.invoice_count}</td>
                    <td className="py-2 text-right">{PKR(v.total_amount)}</td>
                    <td className="py-2 text-right">
                      <Badge status={v.pending_count > 0 ? 'Pending' : 'Approved'} label={String(v.pending_count)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Monthly Invoice Volume" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.monthly} barCategoryGap="30%">
              <defs>
                <BarGradient id="towerBar" from="#0b6b2d" to="#0b6b2d" />
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTip fmt={PKR} labelFmt={(l: any) => `Month ${l}`} />} cursor={{ fill: t.cursor }} />
              <Bar dataKey="amount" name="Amount" fill="url(#towerBar)" radius={[6, 6, 2, 2]} maxBarSize={42} animationDuration={800} style={{ filter: 'drop-shadow(0 3px 5px rgba(11,107,45,0.25))' }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Recent Invoices" className="mt-4">
        {data.recent.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">
                  <th className="py-2">Invoice</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r: any) => (
                  <tr key={r.invoice_no + r.created_at} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-200">{r.invoice_no}</td>
                    <td className="py-2">{r.vendor}</td>
                    <td className="py-2 text-right">{PKR(r.amount)}</td>
                    <td className="py-2">
                      <Badge status={r.approval_status} label={r.approval_status || '—'} />
                      {r.alert && <Badge status="alert" label={r.alert} />}
                    </td>
                    <td className="py-2 text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

/* --------------------------------- Contracts -------------------------------- */

const emptyContract = { contractor: '', service_type: '', contract_code: '', contract_value: '', start_date: '', end_date: '', status: 'open', notes: '' };

const Contracts: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortState>({ by: '', dir: 'asc' });
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/surveyors/contracts', {
      params: { search: q || undefined, status: status || undefined, sort_by: sort.by || undefined, sort_dir: sort.dir },
    })
      .then((r) => setItems(r.data.items || []))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [q, status, sort]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get('/surveyors/references').then((r) => setServiceTypes(r.data.serviceTypes || [])).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) await api.patch(`/surveyors/contracts/${editing.id}`, editing);
      else await api.post('/surveyors/contracts', editing);
      setEditing(null);
      load();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  const remove = async (c: any) => {
    if (!window.confirm(`Delete contract ${c.contract_code}?`)) return;
    try { await api.delete(`/surveyors/contracts/${c.id}`); load(); }
    catch (e) { setError(errMsg(e)); }
  };

  const utilization = (c: any): number => {
    const v = Number(c.contract_value);
    return v > 0 ? Math.min(100, (Number(c.used_amount) / v) * 100) : 0;
  };

  return (
    <div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
          <input className="input pl-8 w-56" placeholder="Search contracts…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="hold">hold</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <ExportButtons type="contracts" />
          <button onClick={() => setEditing({ ...emptyContract })} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New Contract
          </button>
        </div>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? <Empty message="No contracts" /> : (
        <div className="overflow-x-auto card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
                <SortTh label="Code" col="contract_code" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Contractor" col="contractor" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Service" col="service_type" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Value" col="contract_value" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} align="right" />
                <th className="px-4 py-3 text-right text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">Used</th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">Utilization</th>
                <SortTh label="Period" col="start_date" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Status" col="status" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <th className="px-4 py-3 text-right text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400 no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-200">{c.contract_code}</td>
                  <td className="px-4 py-2.5">{c.contractor}</td>
                  <td className="px-4 py-2.5">{c.service_type}</td>
                  <td className="px-4 py-2.5 text-right">{PKR(c.contract_value)}</td>
                  <td className="px-4 py-2.5 text-right">{PKR(c.used_amount)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={clsx('h-full rounded-full', utilization(c) > 100 ? 'bg-rose-500' : utilization(c) > 80 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, utilization(c))}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{Math.round(utilization(c))}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</td>
                  <td className="px-4 py-2.5"><Badge status={c.status === 'overbilled' ? 'alert' : c.status} label={c.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="text-brand-600 hover:underline text-xs mr-2" onClick={() => setEditing({ ...c })}>Edit</button>
                    <button className="text-rose-500 hover:underline text-xs" onClick={() => remove(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop ring-1 ring-slate-900/5 dark:bg-slate-900 dark:shadow-none dark:ring-white/10 max-h-[90vh] overflow-y-auto animate-modal">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{editing.id ? 'Edit Contract' : 'New Surveyor Contract'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contract Code" value={editing.contract_code} onChange={(v) => setEditing({ ...editing, contract_code: v })} placeholder="PM-TNS-25" />
              <Field label="Contractor" value={editing.contractor} onChange={(v) => setEditing({ ...editing, contractor: v })} />
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Service Type</label>
                <select className="input mt-1" value={editing.service_type || ''} onChange={(e) => setEditing({ ...editing, service_type: e.target.value })}>
                  <option value="">Select service type…</option>
                  {optionSet(serviceTypes, editing.service_type).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Field label="Contract Value" value={editing.contract_value} onChange={(v) => setEditing({ ...editing, contract_value: v })} type="number" />
              <Field label="Start Date" value={(editing.start_date || '').slice(0, 10)} onChange={(v) => setEditing({ ...editing, start_date: v })} type="date" />
              <Field label="End Date" value={(editing.end_date || '').slice(0, 10)} onChange={(v) => setEditing({ ...editing, end_date: v })} type="date" />
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
                <select className="input mt-1" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                  <option value="hold">hold</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Notes</label>
              <textarea className="input mt-1" rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string }> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
    <input className="input mt-1" type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

/* ---------------------------------- Invoices --------------------------------- */

const InvoicesTab: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [vendor, setVendor] = useState('');
  const [vendors, setVendors] = useState<string[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [costElements, setCostElements] = useState<{ code: string; name: string }[]>([]);
  const [contract, setContract] = useState('');
  const [q, setQ] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sort, setSort] = useState<SortState>({ by: '', dir: 'asc' });
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/surveyors/invoices', {
      params: {
        status: status || undefined, vendor: vendor || undefined, contract: contract || undefined,
        search: q || undefined, min_amount: minAmount || undefined, max_amount: maxAmount || undefined,
        sort_by: sort.by || undefined, sort_dir: sort.dir,
      },
    })
      .then((r) => setItems(r.data.items || []))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [status, vendor, contract, q, minAmount, maxAmount, sort]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get('/surveyors/dashboard').then((r) => setVendors((r.data.vendors || []).map((v: any) => v.vendor))).catch(() => {});
    api.get('/surveyors/contracts').then((r) => setContracts(r.data.items || [])).catch(() => {});
    api.get('/surveyors/references').then((r) => {
      setServiceTypes(r.data.serviceTypes || []);
      setCostElements(r.data.costElements || []);
    }).catch(() => {});
  }, []);

  const act = async (id: string, action: 'approve' | 'reject' | 'reopen', remarks?: string) => {
    setBusy(id + action);
    try {
      await api.post(`/surveyors/invoices/${id}/${action}`, { remarks });
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(''); }
  };

  const save = async () => {
    try {
      if (editing.id) await api.patch(`/surveyors/invoices/${editing.id}`, editing);
      else await api.post('/surveyors/invoices', editing);
      setEditing(null);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const filterBtn = (label: string, value: string) => (
    <button
      onClick={() => setStatus(value)}
      className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', status === value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')}
    >
      {label}
    </button>
  );

  return (
    <div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
        {filterBtn('All', '')}
        {filterBtn('Pending', 'pending')}
        {filterBtn('Approved', 'approved')}
        {filterBtn('Rejected', 'rejected')}
        <select className="input w-44" value={contract} onChange={(e) => setContract(e.target.value)}>
          <option value="">All contracts</option>
          {contracts.map((c) => <option key={c.id} value={c.contract_code}>{c.contract_code}</option>)}
        </select>
        <input className="input w-28" type="number" placeholder="Min Rs" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} title="Minimum amount" />
        <input className="input w-28" type="number" placeholder="Max Rs" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} title="Maximum amount" />
        <div className="ml-auto flex items-center gap-2">
          <ExportButtons type="invoices" />
          <select className="input w-40" value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="">All vendors</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
            <input className="input pl-8 w-48" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button onClick={() => setEditing({ vendor, validation: 'Valid', invoice_status: 'Received', approval_status: 'Pending' })} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? <Empty message="No invoices match" /> : (
        <div className="overflow-x-auto card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
                <SortTh label="Invoice" col="invoice_no" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Vendor" col="vendor" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Contract" col="contract" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Tanker" col="tanker_name" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Amount" col="amount" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} align="right" />
                <SortTh label="Date" col="invoice_date" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Status" col="approval_status" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <th className="px-4 py-3 text-right text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400 no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-200">{i.invoice_no}</td>
                  <td className="px-4 py-2.5">{i.vendor}</td>
                  <td className="px-4 py-2.5 text-xs">{i.contract_code || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{i.tanker_name || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{PKR(i.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmtDate(i.invoice_date)}</td>
                  <td className="px-4 py-2.5">
                    <Badge status={i.approval_status} label={i.approval_status || '—'} />
                    {i.alert && <span className="ml-1"><Badge status="alert" label={i.alert} /></span>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {invStatus(i.approval_status) === 'pending' && (
                      <>
                        <button className="text-emerald-600 hover:underline text-xs mr-2" disabled={!!busy} onClick={() => act(i.id, 'approve', 'Approved on desk review')}>
                          <CheckCircle2 className="h-3.5 w-3.5 inline mr-0.5" />Approve
                        </button>
                        <button className="text-rose-500 hover:underline text-xs mr-2" disabled={!!busy} onClick={() => { const r = window.prompt('Reject remarks'); if (r !== null) act(i.id, 'reject', r || 'Rejected'); }}>
                          <XCircle className="h-3.5 w-3.5 inline mr-0.5" />Reject
                        </button>
                      </>
                    )}
                    {invStatus(i.approval_status) !== 'pending' && (
                      <button className="text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:underline text-xs mr-2" disabled={!!busy} onClick={() => act(i.id, 'reopen')}>
                        <RotateCcw className="h-3.5 w-3.5 inline mr-0.5" />Reopen
                      </button>
                    )}
                    <button className="text-brand-600 hover:underline text-xs" onClick={() => setEditing({ ...i, invoice_date: (i.invoice_date || '').slice(0, 10) })}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <InvoiceModal
          value={editing}
          contracts={contracts}
          vendors={vendors}
          serviceTypes={serviceTypes}
          costElements={costElements}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
};

const monthOptions = (): string[] => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

const InvoiceModal: React.FC<{ value: any; contracts: any[]; vendors: string[]; serviceTypes: string[]; costElements: { code: string; name: string }[]; onChange: (v: any) => void; onClose: () => void; onSave: () => void }> = ({ value, contracts, vendors, serviceTypes, costElements, onChange, onClose, onSave }) => {
  const selectContract = (code: string) => {
    const c = contracts.find((x) => x.contract_code === code);
    onChange({
      ...value,
      contract_code: code,
      vendor: code && c ? c.contractor : value.vendor,
      service_type_1: code && c ? c.service_type : value.service_type_1,
    });
  };
  const selectedContract = contracts.find((c) => c.contract_code === value.contract_code);
  const remaining = selectedContract ? Number(selectedContract.contract_value) - Number(selectedContract.used_amount) : null;
  const today = new Date().toISOString().slice(0, 10);
  const validContract = (c: any): boolean => {
    if (c.status !== 'open') return false;
    if (c.end_date && String(c.end_date).slice(0, 10) < today) return false;
    return Number(c.contract_value) - Number(c.used_amount) > 0;
  };
  const contractOptions = optionSet(
    contracts.filter((c) => validContract(c)).map((c) => c.contract_code),
    value.contract_code,
  );
  const vendorOptions = Array.from(new Set([...vendors, ...contracts.map((c) => c.contractor)])).filter(Boolean);
  const serviceOptions = (v?: string) => optionSet(serviceTypes, v);
  const costElementOptions = optionSet(costElements.map((c) => c.code), value.cost_element);
  const costLabel = (code: string) => {
    const hit = costElements.find((c) => c.code === code);
    return hit ? `${hit.code} · ${hit.name}` : code;
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-pop ring-1 ring-slate-900/5 dark:bg-slate-900 dark:shadow-none dark:ring-white/10 max-h-[90vh] overflow-y-auto animate-modal">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{value.id ? 'Edit Invoice' : 'New Surveyor Invoice'}</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Invoice No" value={value.invoice_no} onChange={(v) => onChange({ ...value, invoice_no: v })} />
          <Field label="Serial No" value={value.serial_no} onChange={(v) => onChange({ ...value, serial_no: v })} />
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vendor</label>
            <select className="input mt-1" value={value.vendor || ''} onChange={(e) => onChange({ ...value, vendor: e.target.value })}>
              <option value="">Select vendor…</option>
              {vendorOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Contract</label>
            <select className="input mt-1" value={value.contract_code || ''} onChange={(e) => selectContract(e.target.value)}>
              <option value="">No contract (manual entry)</option>
              {contractOptions.map((code) => {
                const c = contracts.find((x) => x.contract_code === code);
                if (!c) return <option key={code} value={code}>{code} (archived)</option>;
                const rem = Number(c.contract_value) - Number(c.used_amount);
                const full = rem <= 0;
                return (
                  <option key={c.id} value={c.contract_code} disabled={!validContract(c)}>
                    {c.contract_code} — {c.contractor} · {c.service_type} · {c.status}{full ? ' · FULLY CONSUMED' : ''}
                  </option>
                );
              })}
            </select>
            {selectedContract && (
              <p className={clsx('text-[11px] mt-1', remaining !== null && remaining < Number(value.amount || 0) ? 'text-rose-600 font-semibold' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500')}>
                Balance: {PKR(remaining)} of {PKR(selectedContract.contract_value)}
                {remaining !== null && remaining < Number(value.amount || 0) ? ' — amount exceeds contract balance (Overbilling)' : ''}
              </p>
            )}
          </div>
          <Field label="Tanker Name" value={value.tanker_name} onChange={(v) => onChange({ ...value, tanker_name: v })} />
          <Field label="Amount" value={value.amount} onChange={(v) => onChange({ ...value, amount: v })} type="number" />
          <Field label="Invoice Date" value={(value.invoice_date || '').slice(0, 10)} onChange={(v) => onChange({ ...value, invoice_date: v })} type="date" />
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Services Month</label>
            <select className="input mt-1" value={(value.services_month || '').slice(0, 7)} onChange={(e) => onChange({ ...value, services_month: `${e.target.value}-01` })}>
              <option value="">Select month…</option>
              {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Field label="Item No" value={value.item_no} onChange={(v) => onChange({ ...value, item_no: v })} />
          {['service_type_1', 'service_type_2', 'service_type_3'].map((key) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Service Type {key.slice(-1)}</label>
              <select className="input mt-1" value={value[key] || ''} onChange={(e) => onChange({ ...value, [key]: e.target.value })}>
                <option value="">Select service…</option>
                {serviceOptions(value[key]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cost Element</label>
            <select className="input mt-1" value={value.cost_element || ''} onChange={(e) => onChange({ ...value, cost_element: e.target.value })}>
              <option value="">Select cost element…</option>
              {costElementOptions.map((code) => <option key={code} value={code}>{costLabel(code)}</option>)}
            </select>
          </div>
          <Field label="Invoice Status" value={value.invoice_status} onChange={(v) => onChange({ ...value, invoice_status: v })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* --------------------------------- Pay Orders -------------------------------- */

const PayOrders: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ vendor: '', pay_method: 'cheque', order_no: '', narrative: '' });
  const [busy, setBusy] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [autoVendor, setAutoVendor] = useState('');
  const [vendors, setVendors] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sort, setSort] = useState<SortState>({ by: '', dir: 'asc' });

  const load = useCallback(() => {
    setLoading(true);
    api.get('/surveyors/pay-orders', {
      params: {
        status: statusFilter || undefined, min_amount: minAmount || undefined, max_amount: maxAmount || undefined,
        sort_by: sort.by || undefined, sort_dir: sort.dir,
      },
    })
      .then((r) => setItems(r.data.items || []))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [statusFilter, minAmount, maxAmount, sort]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get('/surveyors/dashboard').then((r) => setVendors((r.data.vendors || []).map((v: any) => v.vendor))).catch(() => {});
  }, []);

  const autoGenerate = async () => {
    setBusy('auto');
    setError('');
    setInfo('');
    try {
      const r = await api.post('/surveyors/pay-orders/auto-generate', { vendor: autoVendor || undefined, pay_method: form.pay_method });
      const gen = r.data.items || [];
      setInfo(r.data.message || `Generated ${gen.length} pay order(s)`);
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(''); }
  };

  const openNew = async () => {
    setShowNew(true);
    setSelected(new Set());
    try {
      const r = await api.get('/surveyors/invoices', { params: { status: 'Approved' } });
      setCandidates(r.data.items || []);
    } catch (e) { setError(errMsg(e)); }
  };

  const create = async () => {
    if (selected.size === 0) { setError('Select at least one invoice'); return; }
    try {
      await api.post('/surveyors/pay-orders', { ...form, invoice_ids: [...selected] });
      setShowNew(false);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const poAct = async (id: string, action: 'issue' | 'pay' | 'cancel') => {
    setBusy(id + action);
    try {
      const extra = action === 'issue' ? {} : {};
      await api.post(`/surveyors/pay-orders/${id}/${action}`, extra);
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(''); }
  };

  const viewLines = async (id: string) => {
    try {
      const r = await api.get(`/surveyors/pay-orders/${id}`);
      setDetail(r.data);
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      {info && <p className="mb-3 text-sm text-emerald-600 font-medium">{info}</p>}
      <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
        <select className="input w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="issued">issued</option>
          <option value="paid">paid</option>
          <option value="cancelled">cancelled</option>
        </select>
        <input className="input w-28" type="number" placeholder="Min Rs" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} title="Minimum amount" />
        <input className="input w-28" type="number" placeholder="Max Rs" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} title="Maximum amount" />
        <div className="flex items-center gap-2 card px-3 py-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Auto-generate from approved invoices:</span>
          <select className="input w-44" value={autoVendor} onChange={(e) => setAutoVendor(e.target.value)}>
            <option value="">All vendors</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className="input w-36" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value })}>
            <option value="cheque">cheque</option>
            <option value="bank transfer">bank transfer</option>
            <option value="online transfer">online transfer</option>
          </select>
          <button className="btn btn-primary" onClick={autoGenerate} disabled={!!busy}>
            <Zap className="h-4 w-4" /> {busy === 'auto' ? 'Generating…' : 'Auto Generate'}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ExportButtons type="pay-orders" />
          <button onClick={openNew} className="btn"><Plus className="h-4 w-4" /> Manual Pay Order</button>
        </div>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? <Empty message="No pay orders yet" /> : (
        <div className="overflow-x-auto card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
                <SortTh label="PO No" col="pay_order_no" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Vendor" col="vendor" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Method" col="pay_method" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Amount" col="amount" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} align="right" />
                <th className="px-4 py-3 text-left text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">Amount in Words</th>
                <SortTh label="Status" col="status" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <SortTh label="Cheque" col="cheque_no" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} />
                <th className="px-4 py-3 text-right text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400 no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-200">{p.pay_order_no}</td>
                  <td className="px-4 py-2.5">{p.vendor}</td>
                  <td className="px-4 py-2.5 capitalize">{p.pay_method}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{PKR(p.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-[220px] truncate">{p.amount_in_words}</td>
                  <td className="px-4 py-2.5"><Badge status={p.status} label={p.status} /></td>
                  <td className="px-4 py-2.5 text-xs">{p.cheque_no || '—'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button className="text-brand-600 hover:underline text-xs mr-2" onClick={() => viewLines(p.id)}>
                      <Printer className="h-3.5 w-3.5 inline mr-0.5" />Print
                    </button>
                    <button className="text-brand-600 hover:underline text-xs mr-2" onClick={() => downloadPayOrderPdf(p)}>
                      <FilePdf className="h-3.5 w-3.5 inline mr-0.5" />PDF
                    </button>
                    {poStatus(p.status) === 'draft' && (
                      <button className="text-brand-600 hover:underline text-xs mr-2" disabled={!!busy} onClick={() => poAct(p.id, 'issue')}>
                        <Send className="h-3.5 w-3.5 inline mr-0.5" />Issue
                      </button>
                    )}
                    {poStatus(p.status) === 'issued' && (
                      <>
                        <button className="text-emerald-600 hover:underline text-xs mr-2" disabled={!!busy} onClick={() => poAct(p.id, 'pay')}>
                          <Banknote className="h-3.5 w-3.5 inline mr-0.5" />Pay
                        </button>
                        <button className="text-amber-600 hover:underline text-xs mr-2" disabled={!!busy} onClick={() => poAct(p.id, 'cancel')}>
                          <Ban className="h-3.5 w-3.5 inline mr-0.5" />Cancel
                        </button>
                      </>
                    )}
                    {poStatus(p.status) === 'draft' && (
                      <button className="text-amber-600 hover:underline text-xs" disabled={!!busy} onClick={() => poAct(p.id, 'cancel')}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-pop ring-1 ring-slate-900/5 dark:bg-slate-900 dark:shadow-none dark:ring-white/10 max-h-[90vh] overflow-y-auto animate-modal">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">New Pay Order (F.D. 310)</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Field label="Vendor" value={form.vendor} onChange={(v) => setForm({ ...form, vendor: v })} />
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pay Method</label>
                <select className="input mt-1" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value })}>
                  <option value="cheque">cheque</option>
                  <option value="bank transfer">bank transfer</option>
                  <option value="online transfer">online transfer</option>
                </select>
              </div>
              <Field label="Order No" value={form.order_no} onChange={(v) => setForm({ ...form, order_no: v })} placeholder="WIRE-…" />
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Narrative</label>
              <textarea className="input mt-1" rows={2} value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select approved invoices ({selected.size})</p>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {candidates.length === 0 ? <Empty message="No approved invoices available" /> : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Vendor</th>
                      <th className="px-3 py-2">Tanker</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id} className={clsx('border-t border-slate-100 dark:border-slate-800 cursor-pointer', selected.has(c.id) && 'bg-brand-50')} onClick={() => {
                        const next = new Set(selected);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        setSelected(next);
                      }}>
                        <td className="px-3 py-2">
                          <input type="checkbox" readOnly checked={selected.has(c.id)} className="accent-teal-700" />
                        </td>
                        <td className="px-3 py-2 font-medium">{c.invoice_no}</td>
                        <td className="px-3 py-2">{c.vendor}</td>
                        <td className="px-3 py-2 text-xs">{c.tanker_name || '—'}</td>
                        <td className="px-3 py-2 text-right">{PKR(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={create}>Create Pay Order</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {detail && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in print:static print:bg-white print:p-0">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-pop ring-1 ring-slate-900/5 dark:bg-slate-900 dark:shadow-none dark:ring-white/10 max-h-[90vh] overflow-y-auto pay-order-print animate-modal">
            <div className="flex items-center justify-between mb-4 no-print">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{detail.item.pay_order_no}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Formal Pay Order (F.D. 310) · {detail.item.amount_in_words}</p>
              </div>
              <Badge status={detail.item.status} label={detail.item.status} />
            </div>
            <PayOrderDoc item={detail.item} lines={detail.lines || []} />
            <div className="mt-5 flex justify-end gap-2 no-print">
              <button className="btn" onClick={() => setDetail(null)}>Close</button>
              <button className="btn" onClick={() => downloadPayOrderPdf(detail.item)}>
                <FilePdf className="h-4 w-4" /> Download PDF
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

/* -------------------------------- Approval Log ------------------------------- */

const ApprovalLog: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/surveyors/approval-log', { params: { limit: 100 } })
      .then((r) => setItems(r.data.items || []))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end mb-3 no-print">
        <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => window.print()} title="Print">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? <Empty message="No approval activity yet" /> : (
        <div className="overflow-x-auto card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:text-slate-500">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-2.5"><Badge status={l.action === 'Rejected' ? 'Rejected' : l.action === 'Approved' ? 'Approved' : 'Pending'} label={l.action} /></td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-200">{l.invoice_no}</td>
                  <td className="px-4 py-2.5 text-xs">{l.contract_code || '—'}</td>
                  <td className="px-4 py-2.5 text-right">{PKR(l.amount)}</td>
                  <td className="px-4 py-2.5 text-xs">{l.user_email || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-[240px] truncate">{l.remarks || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------- Analysis --------------------------------- */

const Analysis: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const t = useChartTheme();

  useEffect(() => {
    api.get('/surveyors/analysis').then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">{error}</div>;
  if (!data) return <Spinner label="Crunching surveyor analysis…" />;

  const byApprovalRows = data.by_approval || [];
  const countOf = (s: string) => Number((byApprovalRows.find((r: any) => r.approval_status === s) || {}).invoice_count ?? 0);
  const amountOf = (s: string) => Number((byApprovalRows.find((r: any) => r.approval_status === s) || {}).total_amount ?? 0);
  const byApproval = [
    { name: 'Approved', value: countOf('Approved') },
    { name: 'Pending', value: countOf('Pending') },
    { name: 'Rejected', value: countOf('Rejected') },
  ].filter((d) => d.value > 0);

  const totalValue = (data.by_vendor || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
  const totalCount = (data.by_vendor || []).reduce((s: number, r: any) => s + Number(r.invoice_count || 0), 0);
  const pendingValue = amountOf('Pending');

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <StatCard label="Invoice Value" value={<CountUp value={totalValue} formatter={pkCount} />} icon={<BarChart3 className="h-4 w-4" />} hint={`${totalCount} invoices`} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <StatCard label="Avg Invoice" value={<CountUp value={totalCount ? totalValue / totalCount : 0} formatter={pkCount} />} icon={<BadgeDollarSign className="h-4 w-4" />} tone="blue" />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <StatCard label="Pending Value" value={<CountUp value={pendingValue} formatter={pkCount} />} icon={<ShieldAlert className="h-4 w-4" />} tone="red" hint="Awaiting approval" />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <StatCard label="Approved Mix" value={<CountUp value={countOf('Approved')} formatter={(n) => `${fmtNum(n, 0)} / ${totalCount}`} />} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" hint="approved invoices" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Value by Vendor" subtitle="Total invoice value per surveyor">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_vendor} barCategoryGap="30%">
              <defs>
                <BarGradient id="byVendor" from="#0b74b8" to="#0b74b8" />
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grid} />
              <XAxis dataKey="vendor" tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTip fmt={PKR} />} cursor={{ fill: t.cursor }} />
              <Bar dataKey="total_amount" name="Amount" fill="url(#byVendor)" radius={[6, 6, 2, 2]} maxBarSize={40} animationDuration={800} style={{ filter: 'drop-shadow(0 3px 5px rgba(11,116,184,0.25))' }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Value by Service Type" subtitle="Split by service_type_3">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_service} layout="vertical" margin={{ left: 10, right: 10 }} barCategoryGap="30%">
              <defs>
                <BarGradient id="byService" from="#1d4ed8" to="#1d4ed8" />
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={t.grid} />
              <XAxis type="number" tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="service" width={140} tick={{ fontSize: 10, fill: t.tick }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip fmt={PKR} />} cursor={{ fill: t.cursor }} />
              <Bar dataKey="total_amount" name="Amount" fill="url(#byService)" radius={[0, 6, 6, 0]} maxBarSize={22} animationDuration={800} style={{ filter: 'drop-shadow(0 2px 4px rgba(29,78,216,0.25))' }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Approval Mix">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byApproval} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} stroke={t.dark ? '#0f172a' : '#ffffff'} strokeWidth={2} label={({ name, value }: any) => `${name} ${value}`} labelLine={false} animationDuration={800}>
                {byApproval.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTip fmt={(v) => `${v} invoices`} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Monthly Trend">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.by_month} barCategoryGap="30%">
              <defs>
                <BarGradient id="byMonth" from="#c9a227" to="#c9a227" />
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTip fmt={PKR} />} cursor={{ fill: t.cursor }} />
              <Bar dataKey="total_amount" name="Amount" fill="url(#byMonth)" radius={[6, 6, 2, 2]} maxBarSize={42} animationDuration={800} style={{ filter: 'drop-shadow(0 3px 5px rgba(201,162,39,0.25))' }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};
