import React, { useCallback, useEffect, useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { fmtDate, fmtNum, monthEnd } from '../lib/format';

export const Reconciliations: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const canCreate = user && ['accountant', 'admin', 'director'].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reconciliations');
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const close = async (row: any) => {
    try {
      await api.post(`/reconciliations/${row.id}/close`);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const columns = [
    { key: 'bank_account_name', header: 'Bank account', render: (r: any) => <span className="font-medium">{r.bank_account_name}</span> },
    { key: 'period_end', header: 'Period end', render: (r: any) => fmtDate(r.period_end) },
    { key: 'book_balance', header: 'Book balance', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.book_balance)}</span> },
    { key: 'statement_balance', header: 'Statement balance', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.statement_balance)}</span> },
    { key: 'difference', header: 'Difference', align: 'right' as const, render: (r: any) => (
        <span className={`tabular-nums font-semibold ${Number(r.difference) === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {Number(r.difference) === 0 ? 'Reconciled' : `$${fmtNum(r.difference)}`}
        </span>
      ) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
    { key: '_a', header: '', className: 'text-right', render: (r: any) =>
        r.status !== 'reconciled' && canCreate ? (
          <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700" onClick={() => close(r)}><CheckCircle2 className="h-3.5 w-3.5 inline" /> Mark Reconciled</button>
        ) : null },
  ];

  return (
    <div>
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Compare book cash balances against bank statement balances"
        actions={canCreate && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Reconciliation</button>}
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No reconciliations yet" />
      </Card>

      {open && (
        <ReconForm onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />
      )}
    </div>
  );
};

const ReconForm: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [banks, setBanks] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ period_end: monthEnd(-1), statement_balance: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/catalog/bank-accounts').then((r) => setBanks(r.data.items.filter((b: any) => b.is_active)));
  }, []);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/reconciliations', {
        bank_account_id: form.bank_account_id,
        period_end: form.period_end,
        statement_balance: Number(form.statement_balance),
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
      title="New Bank Reconciliation"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.bank_account_id} onClick={submit}>{saving ? 'Saving...' : 'Create'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Bank account">
          <Select value={form.bank_account_id || ''} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
            <option value="">— select —</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name} · {b.bank_name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Period end"><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></Field>
        <Field label="Statement balance"><Input type="number" step="any" value={form.statement_balance} onChange={(e) => setForm({ ...form, statement_balance: Number(e.target.value) })} /></Field>
        <Field label="Notes"><Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
      <p className="mt-3 text-xs text-slate-500">The system computes the book balance and the difference automatically. A difference of zero means the account is reconciled.</p>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
