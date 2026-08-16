import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Eye, CheckCircle2, Undo2, Trash2, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from '../components/ui';
import { fmtDate, fmtNum, todayISO } from '../lib/format';

interface Acct { id: string; code: string; name: string; type: string; normal_balance: string; }
interface Line { account_id: string; cost_center_id?: string; description: string; debit: number; credit: number; }

export const JournalEntries: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailLines, setDetailLines] = useState<any[]>([]);
  const [composer, setComposer] = useState(false);
  const [reversing, setReversing] = useState<any>(null);
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [error, setError] = useState('');

  const canEdit = user && ['accountant', 'admin', 'director'].includes(user.role);

  const load = useCallback(async (status: string, search = '') => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search) params.q = search;
    try {
      const res = await api.get('/journal-entries', { params });
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab, q); }, [tab, q]);

  useEffect(() => {
    api.get('/master/accounts').then((r) => setAccounts(r.data.items.filter((a: any) => a.is_postable)));
    api.get('/master/cost-centers').then((r) => setCostCenters(r.data.items));
  }, []);

  const openDetail = async (row: any) => {
    try {
      const res = await api.get(`/journal-entries/${row.id}`);
      setDetail(res.data.item);
      setDetailLines(res.data.lines || []);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const post = async (row: any) => {
    try {
      await api.post(`/journal-entries/${row.id}/post`);
      load(tab, q);
      if (detail?.id === row.id) openDetail(row);
    } catch (e) { setError(errMsg(e)); }
  };

  const reverse = async (reason: string) => {
    try {
      await api.post(`/journal-entries/${reversing.id}/reverse`, { reason });
      setReversing(null);
      load(tab, q);
      if (detail?.id === reversing.id) setDetail(null);
    } catch (e) { setError(errMsg(e)); setReversing(null); }
  };

  const del = async (row: any) => {
    try {
      await api.delete(`/journal-entries/${row.id}`);
      load(tab, q);
    } catch (e) { setError(errMsg(e)); }
  };

  const counts = useMemo(() => {
    const c = { all: items.length, draft: 0, posted: 0, reversed: 0, pending: 0 };
    for (const i of items) {
      c[i.status as keyof typeof c] = (c[i.status as keyof typeof c] || 0) + 1;
      if (i.approval_status === 'pending') c.pending += 1;
    }
    return c;
  }, [items]);

  const columns = [
    { key: 'entry_no', header: 'Entry #', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.entry_no}</span> },
    { key: 'entry_date', header: 'Date', render: (r: any) => fmtDate(r.entry_date) },
    { key: 'description', header: 'Description', render: (r: any) => <span className="whitespace-normal max-w-xs">{r.description || '—'}</span> },
    { key: 'type', header: 'Type', render: (r: any) => <span className="capitalize">{r.type}</span> },
    { key: 'total_debit', header: 'Total', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.total_debit)}</span> },
    { key: 'status', header: 'Status', render: (r: any) => (
        <div className="flex flex-col gap-1">
          <Badge status={r.status} />
          {r.approval_status === 'pending' && <Badge status="pending" label="Awaiting approval" />}
        </div>
      ) },
    { key: '_a', header: '', className: 'text-right', render: (r: any) => (
        <div className="flex justify-end gap-1">
          <button className="rounded p-1.5 text-slate-400 hover:text-brand-600" title="View" onClick={() => openDetail(r)}><Eye className="h-4 w-4" /></button>
          {canEdit && r.status === 'draft' && r.approval_status === 'not_required' && (
            <button className="rounded p-1.5 text-slate-400 hover:text-emerald-600" title="Post" onClick={() => post(r)}><CheckCircle2 className="h-4 w-4" /></button>
          )}
          {canEdit && r.status === 'posted' && (
            <button className="rounded p-1.5 text-slate-400 hover:text-amber-600" title="Reverse" onClick={() => setReversing(r)}><Undo2 className="h-4 w-4" /></button>
          )}
          {canEdit && r.status === 'draft' && (
            <button className="rounded p-1.5 text-slate-400 hover:text-rose-600" title="Delete" onClick={() => del(r)}><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      ) },
  ];

  return (
    <div>
      <PageHeader
        title="Journal Entries"
        subtitle="Double-entry bookkeeping with approval workflow"
        actions={canEdit && <button className="btn-primary" onClick={() => setComposer(true)}><Plus className="h-4 w-4" /> New Entry</button>}
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Tabs
        tabs={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'draft', label: 'Drafts', count: counts.draft },
          { key: 'pending', label: 'Awaiting approval', count: counts.pending },
          { key: 'posted', label: 'Posted', count: counts.posted },
          { key: 'reversed', label: 'Reversed', count: counts.reversed },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search entries..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No journal entries found" />
      </Card>

      {composer && (
        <JournalComposer
          accounts={accounts}
          costCenters={costCenters}
          onClose={() => setComposer(false)}
          onDone={() => { setComposer(false); load(tab, q); }}
        />
      )}

      {detail && (
        <JournalDetail item={detail} lines={detailLines} onClose={() => setDetail(null)} />
      )}

      <ReverseDialog
        open={!!reversing}
        entryNo={reversing?.entry_no}
        onClose={() => setReversing(null)}
        onConfirm={reverse}
      />
    </div>
  );
};

const JournalComposer: React.FC<{
  accounts: Acct[];
  costCenters: any[];
  onClose: () => void;
  onDone: () => void;
}> = ({ accounts, costCenters, onClose, onDone }) => {
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([
    { account_id: '', cost_center_id: '', description: '', debit: 0, credit: 0 },
    { account_id: '', cost_center_id: '', description: '', debit: 0, credit: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const c = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    return { debit: d, credit: c, diff: d - c };
  }, [lines]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/journal-entries', {
        entry_date: date,
        reference: reference || null,
        description: description || null,
        lines: lines
          .filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
          .map((l) => ({
            account_id: l.account_id,
            cost_center_id: l.cost_center_id || null,
            description: l.description || null,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
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
      title="New Journal Entry"
      size="xl"
      footer={
        <>
          <span className={`mr-auto text-sm ${totals.diff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totals.diff === 0 ? 'Balanced' : `Out of balance: ${fmtNum(Math.abs(totals.diff))}`}
            {' '}· Dr {fmtNum(totals.debit)} / Cr {fmtNum(totals.credit)}
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving...' : 'Create'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Field label="Entry date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Reference"><Input placeholder="e.g. INV-2026-00002" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="Description" className="sm:col-span-1"><Input placeholder="Entry description" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Account</th>
              <th className="th">Cost center</th>
              <th className="th">Description</th>
              <th className="th text-right">Debit</th>
              <th className="th text-right">Credit</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="td">
                  <Select className="min-w-[220px]" value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })}>
                    <option value="">— select account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="td">
                  <Select className="min-w-[130px]" value={l.cost_center_id || ''} onChange={(e) => setLine(i, { cost_center_id: e.target.value || undefined })}>
                    <option value="">— none —</option>
                    {costCenters.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="td">
                  <Input className="min-w-[120px]" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                </td>
                <td className="td text-right">
                  <Input type="number" step="any" className="w-28 text-right" value={l.debit} onChange={(e) => setLine(i, { debit: Number(e.target.value), credit: 0 })} />
                </td>
                <td className="td text-right">
                  <Input type="number" step="any" className="w-28 text-right" value={l.credit} onChange={(e) => setLine(i, { credit: Number(e.target.value), debit: 0 })} />
                </td>
                <td className="td">
                  <button className="rounded p-1.5 text-slate-400 hover:text-rose-600" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="btn-ghost mt-2"
        onClick={() => setLines((ls) => [...ls, { account_id: '', cost_center_id: '', description: '', debit: 0, credit: 0 }])}
      >
        <Plus className="h-4 w-4" /> Add line
      </button>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};

const JournalDetail: React.FC<{ item: any; lines: any[]; onClose: () => void }> = ({ item, lines, onClose }) => {
  return (
    <Modal open onClose={onClose} title={`${item.entry_no} · ${item.description || ''}`} size="xl"
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div><p className="label">Date</p><p className="text-sm font-medium">{fmtDate(item.entry_date)}</p></div>
        <div><p className="label">Type</p><p className="text-sm font-medium capitalize">{item.type}</p></div>
        <div><p className="label">Reference</p><p className="text-sm font-medium">{item.reference || '—'}</p></div>
        <div><p className="label">Status</p><Badge status={item.status} /></div>
      </div>
      <DataTable
        columns={[
          { key: 'account_code', header: 'Account', render: (r: any) => <span className="font-mono text-xs">{r.account_code} · {r.account_name}</span> },
          { key: 'cost_center', header: 'Cost center', render: (r: any) => r.cc_code ? `${r.cc_code} ${r.cc_name}` : '—' },
          { key: 'description', header: 'Description', render: (r: any) => r.description || '—' },
          { key: 'debit', header: 'Debit', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.debit)}</span> },
          { key: 'credit', header: 'Credit', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.credit)}</span> },
        ]}
        rows={lines}
        rowKey="id"
      />
      {item.approval_status === 'pending' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          This entry is pending approval and cannot be posted yet.
        </p>
      )}
    </Modal>
  );
};

const ReverseDialog: React.FC<{ open: boolean; entryNo?: string; onClose: () => void; onConfirm: (reason: string) => void }> = ({ open, entryNo, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Reverse journal entry" size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Reverse</button>
        </>
      }>
      <p className="text-sm text-slate-600 mb-3">
        A reversing entry will be created for <span className="font-semibold">{entryNo}</span>, and the original will be marked reversed.
      </p>
      <Field label="Reason"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being reversed?" /></Field>
    </Modal>
  );
};
