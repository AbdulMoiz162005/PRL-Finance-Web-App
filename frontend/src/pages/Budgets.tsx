import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Eye } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { fmtNum } from '../lib/format';

export const Budgets: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | ''>('');
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [error, setError] = useState('');

  const canCreate = user && ['admin', 'director', 'accountant'].includes(user.role);
  const canFinalize = user && ['admin', 'director'].includes(user.role);

  const load = useCallback(async (y: number | '') => {
    setLoading(true);
    try {
      const res = await api.get('/budgets', { params: y ? { year: y } : {} });
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year]);

  const openDetail = async (row: any) => {
    try {
      const res = await api.get(`/budgets/${row.id}`);
      setDetail(res.data.item);
      setDetailItems(res.data.items || []);
    } catch (e) { setError(errMsg(e)); }
  };

  const finalize = async (row: any) => {
    try {
      await api.post(`/budgets/${row.id}/finalize`);
      load(year);
      if (detail?.id === row.id) openDetail(row);
    } catch (e) { setError(errMsg(e)); }
  };

  const columns = [
    { key: 'name', header: 'Budget', render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: 'fiscal_year', header: 'Fiscal year', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.fiscal_year}</span> },
    { key: 'total_budget', header: 'Total budget', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.total_budget)}</span> },
    { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
    { key: 'created_by_name', header: 'Created by', render: (r: any) => r.created_by_name || '—' },
    { key: '_a', header: '', className: 'text-right', render: (r: any) => (
        <div className="flex justify-end gap-1">
          <button className="rounded p-1.5 text-slate-400 hover:text-brand-600" onClick={() => openDetail(r)}><Eye className="h-4 w-4" /></button>
          {canFinalize && r.status === 'draft' && (
            <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700" onClick={() => finalize(r)}>Finalize</button>
          )}
        </div>
      ) },
  ];

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Annual budget planning with monthly line items"
        actions={canCreate && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Budget</button>}
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="mb-4 flex items-center gap-2">
        <Select className="w-32" value={year === '' ? '' : String(year)} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}>
          <option value="">All years</option>
          <option value="2026">2026</option>
          <option value="2027">2027</option>
        </Select>
      </div>
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No budgets found" />
      </Card>

      {open && <BudgetForm onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(year); }} />}

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`${detail.name} · FY ${detail.fiscal_year}`}
          size="xl"
          footer={<button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>}
        >
          <DataTable
            columns={[
              { key: 'account_code', header: 'Account', render: (r: any) => <span className="font-mono text-xs">{r.account_code} · {r.account_name}</span> },
              { key: 'month', header: 'Month', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.month}</span> },
              { key: 'cc_code', header: 'Cost center', render: (r: any) => r.cc_code ? `${r.cc_code} · ${r.cc_name}` : '—' },
              { key: 'amount', header: 'Amount', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.amount)}</span> },
            ]}
            rows={detailItems}
            rowKey="id"
            emptyMessage="No budget line items"
          />
        </Modal>
      )}
    </div>
  );
};

const BudgetForm: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ fiscal_year: new Date().getFullYear(), name: '', items: [{ account_id: '', cost_center_id: '', month: 1, amount: 0 }] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/master/accounts').then((r) => setAccounts(r.data.items.filter((a: any) => a.is_postable)));
    api.get('/master/cost-centers').then((r) => setCostCenters(r.data.items));
  }, []);

  const setItem = (i: number, patch: any) =>
    setForm((f: any) => ({ ...f, items: f.items.map((it: any, idx: number) => (idx === i ? { ...it, ...patch } : it)) }));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/budgets', {
        fiscal_year: Number(form.fiscal_year),
        name: form.name,
        items: form.items.filter((it: any) => it.account_id).map((it: any) => ({
          account_id: it.account_id,
          cost_center_id: it.cost_center_id || null,
          month: Number(it.month),
          amount: Number(it.amount || 0),
        })),
      });
      onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New Budget"
      size="xl"
      footer={
        <>
          <span className="mr-auto text-sm text-slate-500">
            Total: <span className="font-bold">${fmtNum(form.items.reduce((s: number, it: any) => s + Number(it.amount || 0), 0))}</span>
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.name} onClick={submit}>{saving ? 'Saving...' : 'Create'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Field label="Budget name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FY2026 Operating" /></Field>
        <Field label="Fiscal year"><Input type="number" value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: Number(e.target.value) })} /></Field>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Account</th>
              <th className="th">Cost center</th>
              <th className="th text-right">Month</th>
              <th className="th text-right">Amount</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {form.items.map((it: any, i: number) => (
              <tr key={i}>
                <td className="td">
                  <Select className="min-w-[240px]" value={it.account_id} onChange={(e) => setItem(i, { account_id: e.target.value })}>
                    <option value="">— select —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="td">
                  <Select className="min-w-[140px]" value={it.cost_center_id || ''} onChange={(e) => setItem(i, { cost_center_id: e.target.value })}>
                    <option value="">— none —</option>
                    {costCenters.map((c) => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </Select>
                </td>
                <td className="td text-right">
                  <Select className="w-20" value={it.month} onChange={(e) => setItem(i, { month: Number(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, m) => (
                      <option key={m + 1} value={m + 1}>{m + 1}</option>
                    ))}
                  </Select>
                </td>
                <td className="td text-right">
                  <Input type="number" step="any" className="w-32 text-right" value={it.amount} onChange={(e) => setItem(i, { amount: Number(e.target.value) })} />
                </td>
                <td className="td">
                  <button className="rounded p-1.5 text-slate-400 hover:text-rose-600" onClick={() => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-ghost mt-2" onClick={() => setForm((f: any) => ({ ...f, items: [...f.items, { account_id: '', cost_center_id: '', month: 1, amount: 0 }] }))}>
        <Plus className="h-4 w-4" /> Add line
      </button>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
