import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, FileText, Scale, BadgeDollarSign, ScrollText, BarChart3,
  Plus, CheckCircle2, XCircle, RotateCcw, Send, Banknote, Ban, Search, ShieldAlert, Zap,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api, errMsg } from '../lib/api';
import { Badge, Card, Empty, PageHeader, Spinner, StatCard } from '../components/ui';
import { fmtDate } from '../lib/format';
import clsx from 'clsx';

const PKR = (n: number | string | null | undefined): string =>
  `Rs ${Number(n ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

const invStatus = (s?: string | null) => s?.toLowerCase() || 'pending';
const poStatus = (s?: string | null) => s?.toLowerCase() || 'draft';

type Tab = 'tower' | 'contracts' | 'invoices' | 'payorders' | 'log' | 'analysis';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'tower', label: 'Control Tower', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'contracts', label: 'Contracts', icon: <Scale className="h-4 w-4" /> },
  { key: 'invoices', label: 'Invoices', icon: <FileText className="h-4 w-4" /> },
  { key: 'payorders', label: 'Pay Orders', icon: <BadgeDollarSign className="h-4 w-4" /> },
  { key: 'log', label: 'Approval Log', icon: <ScrollText className="h-4 w-4" /> },
  { key: 'analysis', label: 'Analysis', icon: <BarChart3 className="h-4 w-4" /> },
];

const PIE_COLORS = ['#0f766e', '#b45309', '#1d4ed8', '#be123c', '#6d28d9', '#0e7490'];

export const Surveyors: React.FC = () => {
  const [tab, setTab] = useState<Tab>('tower');

  return (
    <div>
      <PageHeader
        title="Surveyor Invoices & Pay Orders"
        subtitle="Surveyor service contracts, invoice processing and PRL F.D. 310 pay order automation"
      />
      <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'tower' && <Tower />}
      {tab === 'contracts' && <Contracts />}
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'payorders' && <PayOrders />}
      {tab === 'log' && <ApprovalLog />}
      {tab === 'analysis' && <Analysis />}
    </div>
  );
};

/* ------------------------------- Control Tower ------------------------------ */

const Tower: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/surveyors/dashboard').then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  if (!data) return <Spinner />;
  const s = data.summary;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Invoices" value={s.total_invoices} icon={<FileText className="h-4 w-4" />} hint={`${s.pending_count} pending`} />
        <StatCard label="Invoice Value" value={PKR(s.total_amount)} icon={<BadgeDollarSign className="h-4 w-4" />} tone="blue" hint={`Approved ${PKR(s.approved_amount)}`} />
        <StatCard label="Pending Approval" value={PKR(s.pending_amount)} icon={<ShieldAlert className="h-4 w-4" />} tone={s.pending_count > 0 ? 'red' : 'green'} hint={`${s.pending_count} invoices to review`} />
        <StatCard label="Contract Coverage" value={PKR(s.contract_value)} icon={<Scale className="h-4 w-4" />} hint={`${s.open_contracts} open · consumed ${PKR(s.contract_consumed)}`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Vendors" subtitle="Invoice volumes per surveyor" className="lg:col-span-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="py-2">Vendor</th>
                  <th className="py-2 text-right">Count</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.vendors.map((v: any) => (
                  <tr key={v.vendor} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{v.vendor}</td>
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
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => PKR(v)} labelFormatter={(l: any) => `Month ${l}`} />
              <Bar dataKey="amount" name="Amount" fill="#0f766e" radius={[4, 4, 0, 0]} />
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
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="py-2">Invoice</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r: any) => (
                  <tr key={r.invoice_no + r.created_at} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{r.invoice_no}</td>
                    <td className="py-2">{r.vendor}</td>
                    <td className="py-2 text-right">{PKR(r.amount)}</td>
                    <td className="py-2">
                      <Badge status={r.approval_status} label={r.approval_status || '—'} />
                      {r.alert && <Badge status="alert" label={r.alert} />}
                    </td>
                    <td className="py-2 text-slate-500">{fmtDate(r.created_at)}</td>
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

  const load = useCallback(() => {
    setLoading(true);
    api.get('/surveyors/contracts').then((r) => setItems(r.data.items || [])).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

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
      <div className="flex justify-end mb-4">
        <button onClick={() => setEditing({ ...emptyContract })} className="btn btn-primary">
          <Plus className="h-4 w-4" /> New Contract
        </button>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? <Empty message="No contracts" /> : (
        <div className="overflow-x-auto card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Contractor</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3">Utilization</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{c.contract_code}</td>
                  <td className="px-4 py-2.5">{c.contractor}</td>
                  <td className="px-4 py-2.5">{c.service_type}</td>
                  <td className="px-4 py-2.5 text-right">{PKR(c.contract_value)}</td>
                  <td className="px-4 py-2.5 text-right">{PKR(c.used_amount)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                        <div className={clsx('h-full rounded-full', utilization(c) > 100 ? 'bg-rose-500' : utilization(c) > 80 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, utilization(c))}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{Math.round(utilization(c))}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</td>
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
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{editing.id ? 'Edit Contract' : 'New Surveyor Contract'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contract Code" value={editing.contract_code} onChange={(v) => setEditing({ ...editing, contract_code: v })} placeholder="PM-TNS-25" />
              <Field label="Contractor" value={editing.contractor} onChange={(v) => setEditing({ ...editing, contractor: v })} />
              <Field label="Service Type" value={editing.service_type} onChange={(v) => setEditing({ ...editing, service_type: v })} placeholder="Inspection / Surveying" />
              <Field label="Contract Value" value={editing.contract_value} onChange={(v) => setEditing({ ...editing, contract_value: v })} type="number" />
              <Field label="Start Date" value={(editing.start_date || '').slice(0, 10)} onChange={(v) => setEditing({ ...editing, start_date: v })} type="date" />
              <Field label="End Date" value={(editing.end_date || '').slice(0, 10)} onChange={(v) => setEditing({ ...editing, end_date: v })} type="date" />
              <div>
                <label className="text-xs font-semibold text-slate-600">Status</label>
                <select className="input mt-1" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                  <option value="hold">hold</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-600">Notes</label>
              <textarea className="input mt-1" rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string }> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="text-xs font-semibold text-slate-600">{label}</label>
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
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/surveyors/invoices', { params: { status: status || undefined, vendor: vendor || undefined, search: q || undefined } })
      .then((r) => setItems(r.data.items || []))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [status, vendor, q]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get('/surveyors/dashboard').then((r) => setVendors((r.data.vendors || []).map((v: any) => v.vendor))).catch(() => {});
    api.get('/surveyors/contracts').then((r) => setContracts(r.data.items || [])).catch(() => {});
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
      className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', status === value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
    >
      {label}
    </button>
  );

  return (
    <div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {filterBtn('All', '')}
        {filterBtn('Pending', 'pending')}
        {filterBtn('Approved', 'approved')}
        {filterBtn('Rejected', 'rejected')}
        <div className="ml-auto flex items-center gap-2">
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
              <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Tanker</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{i.invoice_no}</td>
                  <td className="px-4 py-2.5">{i.vendor}</td>
                  <td className="px-4 py-2.5 text-xs">{i.contract_code || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{i.tanker_name || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{PKR(i.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(i.invoice_date)}</td>
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
                      <button className="text-slate-500 hover:underline text-xs mr-2" disabled={!!busy} onClick={() => act(i.id, 'reopen')}>
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

const InvoiceModal: React.FC<{ value: any; contracts: any[]; vendors: string[]; onChange: (v: any) => void; onClose: () => void; onSave: () => void }> = ({ value, contracts, vendors, onChange, onClose, onSave }) => {
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900 mb-4">{value.id ? 'Edit Invoice' : 'New Surveyor Invoice'}</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Invoice No" value={value.invoice_no} onChange={(v) => onChange({ ...value, invoice_no: v })} />
          <Field label="Serial No" value={value.serial_no} onChange={(v) => onChange({ ...value, serial_no: v })} />
          <div>
            <label className="text-xs font-semibold text-slate-600">Vendor</label>
            <select className="input mt-1" value={value.vendor || ''} onChange={(e) => onChange({ ...value, vendor: e.target.value })}>
              <option value="">Select vendor…</option>
              {Array.from(new Set([...vendors, ...contracts.map((c) => c.contractor)])).filter(Boolean).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Contract</label>
            <select className="input mt-1" value={value.contract_code || ''} onChange={(e) => selectContract(e.target.value)}>
              <option value="">No contract (manual entry)</option>
              {contracts.map((c) => {
                const rem = Number(c.contract_value) - Number(c.used_amount);
                const full = rem <= 0;
                return (
                  <option key={c.id} value={c.contract_code} disabled={c.status !== 'open'}>
                    {c.contract_code} — {c.contractor} · {c.service_type} · {c.status}{full ? ' · FULLY CONSUMED' : ''}
                  </option>
                );
              })}
            </select>
            {selectedContract && (
              <p className={clsx('text-[11px] mt-1', remaining !== null && remaining < Number(value.amount || 0) ? 'text-rose-600 font-semibold' : 'text-slate-500')}>
                Balance: {PKR(remaining)} of {PKR(selectedContract.contract_value)}
                {remaining !== null && remaining < Number(value.amount || 0) ? ' — amount exceeds contract balance (Overbilling)' : ''}
              </p>
            )}
          </div>
          <Field label="Tanker Name" value={value.tanker_name} onChange={(v) => onChange({ ...value, tanker_name: v })} />
          <Field label="Amount" value={value.amount} onChange={(v) => onChange({ ...value, amount: v })} type="number" />
          <Field label="Invoice Date" value={(value.invoice_date || '').slice(0, 10)} onChange={(v) => onChange({ ...value, invoice_date: v })} type="date" />
          <div>
            <label className="text-xs font-semibold text-slate-600">Services Month</label>
            <select className="input mt-1" value={(value.services_month || '').slice(0, 7)} onChange={(e) => onChange({ ...value, services_month: `${e.target.value}-01` })}>
              <option value="">Select month…</option>
              {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Field label="Item No" value={value.item_no} onChange={(v) => onChange({ ...value, item_no: v })} />
          <Field label="Service Type 1" value={value.service_type_1} onChange={(v) => onChange({ ...value, service_type_1: v })} />
          <Field label="Service Type 2" value={value.service_type_2} onChange={(v) => onChange({ ...value, service_type_2: v })} />
          <Field label="Service Type 3" value={value.service_type_3} onChange={(v) => onChange({ ...value, service_type_3: v })} />
          <Field label="Cost Element" value={value.cost_element} onChange={(v) => onChange({ ...value, cost_element: v })} />
          <Field label="Invoice Status" value={value.invoice_status} onChange={(v) => onChange({ ...value, invoice_status: v })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
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

  const load = useCallback(() => {
    setLoading(true);
    api.get('/surveyors/pay-orders').then((r) => setItems(r.data.items || [])).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, []);

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
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 card px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">Auto-generate from approved invoices:</span>
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
        <div className="ml-auto">
          <button onClick={openNew} className="btn"><Plus className="h-4 w-4" /> Manual Pay Order</button>
        </div>
      </div>
      {loading ? <Spinner /> : items.length === 0 ? <Empty message="No pay orders yet" /> : (
        <div className="overflow-x-auto card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3">PO No</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Amount in Words</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cheque</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.pay_order_no}</td>
                  <td className="px-4 py-2.5">{p.vendor}</td>
                  <td className="px-4 py-2.5 capitalize">{p.pay_method}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{PKR(p.amount)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[220px] truncate">{p.amount_in_words}</td>
                  <td className="px-4 py-2.5"><Badge status={p.status} label={p.status} /></td>
                  <td className="px-4 py-2.5 text-xs">{p.cheque_no || '—'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button className="text-slate-500 hover:underline text-xs mr-2" onClick={() => viewLines(p.id)}>Lines</button>
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

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">New Pay Order (F.D. 310)</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Field label="Vendor" value={form.vendor} onChange={(v) => setForm({ ...form, vendor: v })} />
              <div>
                <label className="text-xs font-semibold text-slate-600">Pay Method</label>
                <select className="input mt-1" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value })}>
                  <option value="cheque">cheque</option>
                  <option value="bank transfer">bank transfer</option>
                  <option value="online transfer">online transfer</option>
                </select>
              </div>
              <Field label="Order No" value={form.order_no} onChange={(v) => setForm({ ...form, order_no: v })} placeholder="WIRE-…" />
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600">Narrative</label>
              <textarea className="input mt-1" rows={2} value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Select approved invoices ({selected.size})</p>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {candidates.length === 0 ? <Empty message="No approved invoices available" /> : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Vendor</th>
                      <th className="px-3 py-2">Tanker</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id} className={clsx('border-t border-slate-100 cursor-pointer', selected.has(c.id) && 'bg-brand-50')} onClick={() => {
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
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{detail.item.pay_order_no}</h3>
                <p className="text-xs text-slate-500">{detail.item.amount_in_words}</p>
              </div>
              <Badge status={detail.item.status} label={detail.item.status} />
            </div>
            <div className="text-sm text-slate-600 mb-4">
              <p><span className="font-semibold">Vendor:</span> {detail.item.vendor} · <span className="font-semibold">Method:</span> {detail.item.pay_method} · <span className="font-semibold">Order:</span> {detail.item.order_no || '—'}</p>
              {detail.item.narrative && <p className="mt-1 text-xs text-slate-500">{detail.item.narrative}</p>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50">
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Tanker</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(detail.lines || []).map((l: any) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2">{l.invoice_no}</td>
                    <td className="px-3 py-2 text-xs">{l.tanker_name || '—'}</td>
                    <td className="px-3 py-2 text-right">{PKR(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-5 flex justify-end">
              <button className="btn" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
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
      {loading ? <Spinner /> : items.length === 0 ? <Empty message="No approval activity yet" /> : (
        <div className="overflow-x-auto card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase bg-slate-50">
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
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5"><Badge status={l.action === 'Rejected' ? 'Rejected' : l.action === 'Approved' ? 'Approved' : 'Pending'} label={l.action} /></td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{l.invoice_no}</td>
                  <td className="px-4 py-2.5 text-xs">{l.contract_code || '—'}</td>
                  <td className="px-4 py-2.5 text-right">{PKR(l.amount)}</td>
                  <td className="px-4 py-2.5 text-xs">{l.user_email || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[240px] truncate">{l.remarks || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(l.created_at)}</td>
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

  useEffect(() => {
    api.get('/surveyors/analysis').then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  if (!data) return <Spinner />;

  const byApproval = [
    { name: 'Approved', value: Number(data.by_approval?.approved_count ?? 0) },
    { name: 'Pending', value: Number(data.by_approval?.pending_count ?? 0) },
    { name: 'Rejected', value: Number(data.by_approval?.rejected_count ?? 0) },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Value by Vendor">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.by_vendor}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="vendor" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => PKR(v)} />
            <Bar dataKey="total_amount" name="Amount" fill="#0f766e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Value by Service Type">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.by_service} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="service_type" width={120} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => PKR(v)} />
            <Bar dataKey="total_amount" name="Amount" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Approval Mix">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={byApproval} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>
              {byApproval.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Monthly Trend">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.by_month}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => PKR(v)} />
            <Bar dataKey="total_amount" name="Amount" fill="#b45309" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
