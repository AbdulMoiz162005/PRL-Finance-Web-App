import React, { useCallback, useEffect, useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select, StatCard } from '../components/ui';
import { fmtDate, fmtNum, todayISO, monthStart, monthEnd } from '../lib/format';

export const Tax: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const canEdit = user && ['accountant', 'admin', 'director'].includes(user.role);

  const load = useCallback(async () => {
    try {
      const from = monthStart(-1);
      const to = monthEnd(-1);
      const [s, r] = await Promise.all([
        api.get('/tax/summary', { params: { from, to } }),
        api.get('/tax/returns'),
      ]);
      setSummary(s.data);
      setReturns(r.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const file = async (row: any) => {
    try {
      await api.post(`/tax/returns/${row.id}/file`);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader
        title="Tax Management"
        subtitle="VAT output vs input, withholding tax and filing of periodic returns"
        actions={canEdit && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Generate Return</button>}
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      {summary && (
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Output VAT" value={`$${fmtNum(summary.output_tax)}`} tone="green" />
          <StatCard label="Input VAT" value={`$${fmtNum(summary.input_tax)}`} tone="red" />
          <StatCard label="Net payable" value={`$${fmtNum(summary.net_payable)}`} tone={Number(summary.net_payable) > 0 ? 'blue' : 'green'} hint={`${summary.from} → ${summary.to}`} />
          <StatCard label="Withholding" value={`$${fmtNum(summary.withholding)}`} />
        </div>
      )}
      <Card className="p-0">
        <DataTable
          columns={[
            { key: 'period', header: 'Period', render: (r: any) => <span>{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</span> },
            { key: 'type', header: 'Type', render: (r: any) => <span className="uppercase text-xs font-semibold">{r.type}</span> },
            { key: 'output_tax', header: 'Output', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.output_tax)}</span> },
            { key: 'input_tax', header: 'Input', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.input_tax)}</span> },
            { key: 'net_payable', header: 'Net payable', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.net_payable)}</span> },
            { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status || 'draft'} label={(r.status || 'draft') === 'filed' ? 'Filed' : 'Draft'} /> },
            { key: '_a', header: '', className: 'text-right', render: (r: any) =>
                r.status !== 'filed' && canEdit ? (
                  <button className="btn-ghost text-emerald-600" onClick={() => file(r)}><CheckCircle2 className="h-4 w-4" /> File</button>
                ) : null },
          ]}
          rows={returns}
          emptyMessage="No tax returns yet"
        />
      </Card>

      {open && (
        <TaxForm onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />
      )}
    </div>
  );
};

const TaxForm: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [form, setForm] = useState<any>({ type: 'vat', period_start: monthStart(-1), period_end: monthEnd(-1) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/tax/returns/generate', form);
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
      title="Generate Tax Return"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.period_start || !form.period_end} onClick={submit}>{saving ? 'Saving...' : 'Generate'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="vat">VAT</option>
            <option value="wht">Withholding tax</option>
          </Select>
        </Field>
        <Field label="Period start"><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></Field>
        <Field label="Period end"><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></Field>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
