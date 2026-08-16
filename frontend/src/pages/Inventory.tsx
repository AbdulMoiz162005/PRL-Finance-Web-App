import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select, Tabs } from '../components/ui';
import { fmtDate, fmtNum, fmtQty, todayISO } from '../lib/format';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('stock');
  const [stock, setStock] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const canCreate = user && ['accountant', 'admin', 'manager'].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([api.get('/inventory/stock'), api.get('/inventory/transactions')]);
      setStock(s.data.items || []);
      setTxns(t.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalValue = stock.reduce((s, r) => s + Number(r.stock_value || 0), 0);

  const stockColumns = [
    { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', header: 'Product', render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: 'category', header: 'Category', render: (r: any) => <span className="capitalize">{String(r.category || '').replace(/_/g, ' ')}</span> },
    { key: 'current_qty', header: 'Qty on hand', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">{fmtQty(r.current_qty)} <span className="text-xs text-slate-400">{r.unit}</span></span> },
    { key: 'avg_cost', header: 'Avg cost', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.avg_cost)}</span> },
    { key: 'stock_value', header: 'Stock value', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.stock_value)}</span> },
  ];

  const txnColumns = [
    { key: 'trx_date', header: 'Date', render: (r: any) => fmtDate(r.trx_date) },
    { key: 'type', header: 'Type', render: (r: any) => <Badge status={r.type === 'receipt' || r.type === 'purchase' ? 'issued' : r.type === 'issue' || r.type === 'sale' ? 'open' : 'pending'} label={r.type} /> },
    { key: 'product_code', header: 'Product', render: (r: any) => <span className="font-mono text-xs">{r.product_code} · {r.product_name}</span> },
    { key: 'quantity', header: 'Qty', align: 'right' as const, render: (r: any) => <span className={`tabular-nums font-semibold ${Number(r.quantity) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{Number(r.quantity) > 0 ? '+' : ''}{fmtQty(r.quantity)}</span> },
    { key: 'unit_cost', header: 'Unit cost', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.unit_cost)}</span> },
    { key: 'total_value', header: 'Value', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.total_value)}</span> },
    { key: 'storage_name', header: 'Storage', render: (r: any) => r.storage_name || '—' },
    { key: 'notes', header: 'Notes', render: (r: any) => r.notes || r.reference_type || '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Refined product stock across storage tanks, valued at average cost"
        actions={
          canCreate && (
            <button className="btn-primary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Stock Movement
            </button>
          )
        }
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Tabs
        tabs={[{ key: 'stock', label: 'Stock on hand' }, { key: 'transactions', label: 'Transactions' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'stock' ? (
        <>
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-4"><p className="label">Total stock value</p><p className="text-2xl font-bold tabular-nums">${fmtNum(totalValue)}</p></div>
            <div className="card p-4"><p className="label">Products tracked</p><p className="text-2xl font-bold">{stock.length}</p></div>
            <div className="card p-4"><p className="label">Valuation method</p><p className="text-2xl font-bold">Average cost</p></div>
          </div>
          <Card className="p-0"><DataTable columns={stockColumns} rows={stock} loading={loading} emptyMessage="No stock found" /></Card>
        </>
      ) : (
        <Card className="p-0"><DataTable columns={txnColumns} rows={txns} loading={loading} emptyMessage="No inventory transactions found" /></Card>
      )}

      {open && <StockForm onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
};

const StockForm: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [storages, setStorages] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ type: 'receipt', trx_date: todayISO(), quantity: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/catalog/products').then((r) => setProducts(r.data.items.filter((p: any) => p.is_active && p.category !== 'service')));
    api.get('/catalog/storages').then((r) => setStorages(r.data.items));
  }, []);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/inventory/transactions', {
        product_id: form.product_id,
        storage_id: form.storage_id || null,
        type: form.type,
        quantity: Number(form.quantity),
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        trx_date: form.trx_date,
        notes: form.notes || null,
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
      title="New Stock Movement"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.product_id || !form.quantity} onClick={submit}>{saving ? 'Saving...' : 'Save'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Product">
          <Select value={form.product_id || ''} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">— select —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Movement type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="receipt">Receipt (in)</option>
            <option value="issue">Issue (out)</option>
            <option value="adjustment">Adjustment</option>
          </Select>
        </Field>
        <Field label="Quantity">
          <Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
        </Field>
        <Field label="Unit cost (optional)">
          <Input type="number" step="any" min={0} value={form.unit_cost ?? ''} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.trx_date} onChange={(e) => setForm({ ...form, trx_date: e.target.value })} />
        </Field>
        <Field label="Storage tank">
          <Select value={form.storage_id || ''} onChange={(e) => setForm({ ...form, storage_id: e.target.value })}>
            <option value="">— none —</option>
            {storages.map((s) => (
              <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
