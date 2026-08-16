import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { fmtDate, fmtNum, todayISO } from '../lib/format';

export const Payments: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const canCreate = user && ['accountant', 'admin', 'director'].includes(user.role);

  const load = useCallback(async (t: string, search = '') => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (t) params.type = t;
    if (search) params.q = search;
    try {
      const res = await api.get('/payments', { params });
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(type, q); }, [type, q]);

  const columns = [
    { key: 'payment_no', header: '#', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.payment_no}</span> },
    { key: 'payment_date', header: 'Date', render: (r: any) => fmtDate(r.payment_date) },
    { key: 'type', header: 'Type', render: (r: any) => <Badge status={r.type === 'incoming' ? 'issued' : 'open'} label={r.type === 'incoming' ? 'Incoming' : 'Outgoing'} /> },
    { key: 'party_name', header: 'Party', render: (r: any) => <span className="font-medium">{r.party_name || '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (r: any) => <span className={`tabular-nums font-semibold ${r.type === 'incoming' ? 'text-emerald-600' : 'text-slate-800'}`}>${fmtNum(r.amount)}</span> },
    { key: 'bank_name', header: 'Bank account', render: (r: any) => r.bank_name || '—' },
    { key: 'method', header: 'Method', render: (r: any) => <span className="capitalize">{String(r.method || 'bank_transfer').replace(/_/g, ' ')}</span> },
    { key: 'reference', header: 'Reference', render: (r: any) => r.reference || '—' },
    { key: 'invoice_no', header: 'Invoice', render: (r: any) => <span className="font-mono text-xs">{r.invoice_no || r.bill_no || '—'}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Payments & Receipts"
        subtitle="Record incoming customer receipts and outgoing supplier payments with automatic GL"
        actions={canCreate && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Record Payment</button>}
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['', 'incoming', 'outgoing'].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${type === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
          >
            {t === '' ? 'All' : t === 'incoming' ? 'Incoming' : 'Outgoing'}
          </button>
        ))}
        <div className="relative ml-auto max-w-xs w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No payments found" />
      </Card>

      {open && (
        <PaymentForm
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); load(type, q); }}
        />
      )}
    </div>
  );
};

const PaymentForm: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [banks, setBanks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ payment_date: todayISO(), type: 'incoming', method: 'bank_transfer', amount: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/catalog/bank-accounts').then((r) => setBanks(r.data.items.filter((b: any) => b.is_active)));
    api.get('/parties/customers').then((r) => setCustomers(r.data.items));
    api.get('/parties/suppliers').then((r) => setSuppliers(r.data.items));
    api.get('/invoices', { params: { status: 'issued' } }).then((r) => setInvoices(r.data.items));
    api.get('/purchase-invoices', { params: { status: 'issued' } }).then((r) => setBills(r.data.items));
  }, []);

  const parties = form.type === 'incoming' ? customers : suppliers;
  const docs = form.type === 'incoming' ? invoices : bills;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const body: any = {
        payment_date: form.payment_date,
        type: form.type,
        amount: Number(form.amount),
        bank_account_id: form.bank_account_id,
        method: form.method,
        reference: form.reference || null,
        notes: form.notes || null,
      };
      if (form.party_id) body.party_type = form.type === 'incoming' ? 'customer' : 'supplier';
      if (form.party_id) body.party_id = form.party_id;
      if (form.document_id) {
        if (form.type === 'incoming') body.invoice_id = form.document_id;
        else body.purchase_invoice_id = form.document_id;
      }
      await api.post('/payments', body);
      onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const docOptions = docs.map((d) => ({
    value: d.id,
    label: `${d.invoice_no || d.bill_no} · ${d.customer_name || d.supplier_name || ''} · ${fmtNum(Number(d.total) - Number(d.amount_paid))} due`,
  }));

  return (
    <Modal
      open
      onClose={onClose}
      title="Record Payment / Receipt"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.bank_account_id || Number(form.amount) <= 0} onClick={submit}>
            {saving ? 'Saving...' : 'Record'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Direction">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, party_id: '', document_id: '' })}>
            <option value="incoming">Incoming (customer receipt)</option>
            <option value="outgoing">Outgoing (supplier payment)</option>
          </Select>
        </Field>
        <Field label="Payment date">
          <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
        </Field>
        <Field label="Bank account">
          <Select value={form.bank_account_id || ''} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
            <option value="">— select —</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name} · {b.bank_name} · {b.account_number}</option>
            ))}
          </Select>
        </Field>
        <Field label="Amount">
          <Input type="number" step="any" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        </Field>
        <Field label={form.type === 'incoming' ? 'Customer' : 'Supplier'}>
          <Select value={form.party_id || ''} onChange={(e) => setForm({ ...form, party_id: e.target.value })}>
            <option value="">— none —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={form.type === 'incoming' ? 'Invoice (optional)' : 'Bill (optional)'}>
          <Select value={form.document_id || ''} onChange={(e) => setForm({ ...form, document_id: e.target.value })}>
            <option value="">— none —</option>
            {docOptions.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Method">
          <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="pos">POS</option>
          </Select>
        </Field>
        <Field label="Reference">
          <Input value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Payment reference" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
