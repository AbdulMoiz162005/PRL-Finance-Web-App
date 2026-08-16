import React, { useCallback, useEffect, useState } from 'react';
import { Plus, TrendingDown, Eye, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select, Tabs } from '../components/ui';
import { fmtDate, fmtNum } from '../lib/format';

export const Assets: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('assets');
  const [assets, setAssets] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deprecating, setDeprecating] = useState<any>(null);
  const [error, setError] = useState('');

  const canEdit = user && ['accountant', 'admin', 'director'].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([api.get('/assets'), api.get('/assets/schedule')]);
      setAssets(a.data.items || []);
      setSchedule(s.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalNbv = schedule.reduce((s, r) => s + Number(r.net_book_value || 0), 0);
  const totalCost = assets.reduce((s, r) => s + Number(r.cost || 0), 0);
  const totalAccDep = assets.reduce((s, r) => s + Number(r.accumulated_depreciation || 0), 0);

  const assetColumns = [
    { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', header: 'Asset', render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: 'category', header: 'Category', render: (r: any) => <span className="capitalize">{String(r.category || '').replace(/_/g, ' ')}</span> },
    { key: 'purchase_date', header: 'Purchased', render: (r: any) => fmtDate(r.purchase_date) },
    { key: 'cost', header: 'Cost', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.cost)}</span> },
    { key: 'accumulated_depreciation', header: 'Accum. dep.', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.accumulated_depreciation)}</span> },
    { key: 'useful_life_months', header: 'Life (mo)', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.useful_life_months}</span> },
    { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
    { key: '_a', header: '', className: 'text-right', render: (r: any) =>
        canEdit && r.status === 'active' ? (
          <button className="rounded p-1.5 text-slate-400 hover:text-amber-600" title="Depreciate" onClick={() => setDeprecating(r)}>
            <TrendingDown className="h-4 w-4" />
          </button>
        ) : null },
  ];

  const scheduleColumns = [
    { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', header: 'Asset', render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: 'cost', header: 'Cost', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.cost)}</span> },
    { key: 'monthly_depreciation', header: 'Monthly dep.', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.monthly_depreciation)}</span> },
    { key: 'months_elapsed', header: 'Months elapsed', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.months_elapsed}</span> },
    { key: 'accumulated_depreciation', header: 'Accum. dep.', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.accumulated_depreciation)}</span> },
    { key: 'net_book_value', header: 'Net book value', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.net_book_value)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Fixed Assets"
        subtitle="Refinery plant, equipment and infrastructure with straight-line depreciation"
        actions={canEdit && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Asset</button>}
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4"><p className="label">Gross cost</p><p className="text-2xl font-bold tabular-nums">${fmtNum(totalCost)}</p></div>
        <div className="card p-4"><p className="label">Accumulated depreciation</p><p className="text-2xl font-bold tabular-nums text-amber-600">${fmtNum(totalAccDep)}</p></div>
        <div className="card p-4"><p className="label">Net book value</p><p className="text-2xl font-bold tabular-nums text-brand-600">${fmtNum(totalNbv)}</p></div>
      </div>
      <Tabs
        tabs={[{ key: 'assets', label: 'Assets' }, { key: 'schedule', label: 'Depreciation schedule' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'assets' ? (
        <Card className="p-0"><DataTable columns={assetColumns} rows={assets} loading={loading} emptyMessage="No assets found" /></Card>
      ) : (
        <Card className="p-0"><DataTable columns={scheduleColumns} rows={schedule} loading={loading} emptyMessage="No assets found" /></Card>
      )}

      {open && <AssetForm onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}

      {deprecating && (
        <DepreciateDialog asset={deprecating} onClose={() => setDeprecating(null)} onDone={() => { setDeprecating(null); load(); }} />
      )}
    </div>
  );
};

const AssetForm: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [form, setForm] = useState<any>({ depreciation_method: 'straight_line', status: 'active', salvage_value: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/assets', form);
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
      title="New Fixed Asset"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.code || !form.name || !form.cost} onClick={submit}>{saving ? 'Saving...' : 'Save'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Code"><Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FA-001" /></Field>
        <Field label="Name"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Category">
          <Select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">— select —</option>
            <option value="plant_and_machinery">Plant & machinery</option>
            <option value="storage_tanks">Storage tanks</option>
            <option value="vehicles">Vehicles</option>
            <option value="office_equipment">Office equipment</option>
            <option value="furniture_and_fixtures">Furniture & fixtures</option>
            <option value="buildings">Buildings</option>
            <option value="infrastructure">Infrastructure</option>
          </Select>
        </Field>
        <Field label="Location"><Input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        <Field label="Purchase date"><Input type="date" value={form.purchase_date || ''} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
        <Field label="Cost"><Input type="number" step="any" min={0} value={form.cost ?? ''} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></Field>
        <Field label="Salvage value"><Input type="number" step="any" min={0} value={form.salvage_value ?? 0} onChange={(e) => setForm({ ...form, salvage_value: Number(e.target.value) })} /></Field>
        <Field label="Useful life (months)"><Input type="number" min={1} value={form.useful_life_months ?? ''} onChange={(e) => setForm({ ...form, useful_life_months: Number(e.target.value) })} /></Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};

const DepreciateDialog: React.FC<{ asset: any; onClose: () => void; onDone: () => void }> = ({ asset, onClose, onDone }) => {
  const [months, setMonths] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/assets/${asset.id}/depreciate`, { months });
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
      title="Run Depreciation"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Posting...' : 'Post Depreciation'}</button>
        </>
      }
    >
      <p className="text-sm text-slate-600 mb-3">
        Post straight-line depreciation for <span className="font-semibold">{asset.code} · {asset.name}</span>. This creates a GL entry debiting depreciation expense and crediting accumulated depreciation.
      </p>
      <Field label="Months to depreciate">
        <Input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
      </Field>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
