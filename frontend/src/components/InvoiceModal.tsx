import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Field, Input, Modal, Select, Textarea } from './ui';
import { fmtNum, todayISO } from '../lib/format';

interface Line {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
}

export interface Party {
  id: string;
  name: string;
  code: string;
}

export const InvoiceModal: React.FC<{
  kind: 'sale' | 'purchase';
  open: boolean;
  onClose: () => void;
  onDone: (result: { approval_status: string; item: any }) => void;
  parties: Party[];
  products: { id: string; name: string; code: string; unit: string }[];
}> = ({ kind, open, onClose, onDone, parties, products }) => {
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const net = Number(l.quantity) * Number(l.unit_price) - Number(l.discount);
      subtotal += net;
      tax += (net * Number(l.tax_rate)) / 100;
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setSaving(true);
    setError('');
    const endpoint = kind === 'sale' ? '/invoices' : '/purchase-invoices';
    const body = {
      [`${kind === 'sale' ? 'invoice' : 'bill'}_date`]: date,
      due_date: dueDate || null,
      [`${kind === 'sale' ? 'customer' : 'supplier'}_id`]: partyId,
      reference: reference || null,
      notes: notes || null,
      lines: lines.map((l) => ({
        product_id: l.product_id || null,
        description: l.description || null,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        discount: Number(l.discount),
        tax_rate: Number(l.tax_rate),
      })),
    };
    try {
      const res = await api.post(endpoint, body);
      onDone({ approval_status: res.data.item.approval_status, item: res.data.item });
      setPartyId('');
      setLines([{ description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0 }]);
      setNotes('');
      setReference('');
      setDueDate('');
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === 'sale' ? 'New Sales Invoice' : 'New Purchase Bill'}
      size="xl"
      footer={
        <>
          <span className="mr-auto text-sm text-slate-500">
            Total: <span className="font-bold text-slate-900 tabular-nums">${fmtNum(totals.total)}</span>
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !partyId || !lines.length} onClick={submit}>
            {saving ? 'Saving...' : 'Create'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Field label={kind === 'sale' ? 'Customer' : 'Supplier'}>
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">— select —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={kind === 'sale' ? 'Invoice date' : 'Bill date'}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Reference">
          <Input placeholder="PO / contract ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50">
              <th className="th">Product</th>
              <th className="th">Description</th>
              <th className="th text-right">Qty</th>
              <th className="th text-right">Unit price</th>
              <th className="th text-right">Discount</th>
              <th className="th text-right">Tax %</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="td">
                  <Select value={l.product_id || ''} onChange={(e) => setLine(i, { product_id: e.target.value || undefined })}>
                    <option value="">— none —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="td">
                  <Input className="min-w-[140px]" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Line description" />
                </td>
                <td className="td text-right">
                  <Input type="number" className="w-20 text-right" min={0} step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                </td>
                <td className="td text-right">
                  <Input type="number" className="w-28 text-right" min={0} step="any" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} />
                </td>
                <td className="td text-right">
                  <Input type="number" className="w-24 text-right" min={0} step="any" value={l.discount} onChange={(e) => setLine(i, { discount: Number(e.target.value) })} />
                </td>
                <td className="td text-right">
                  <Input type="number" className="w-20 text-right" min={0} step="any" value={l.tax_rate} onChange={(e) => setLine(i, { tax_rate: Number(e.target.value) })} />
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
        onClick={() => setLines((ls) => [...ls, { description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0 }])}
      >
        <Plus className="h-4 w-4" /> Add line
      </button>

      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
        <p className="text-slate-500">Subtotal: <span className="tabular-nums font-semibold text-slate-800">${fmtNum(totals.subtotal)}</span></p>
        <p className="text-slate-500">Tax: <span className="tabular-nums font-semibold text-slate-800">${fmtNum(totals.tax)}</span></p>
        <p className="text-base font-bold text-slate-900">Total: ${fmtNum(totals.total)}</p>
      </div>

      <Field label="Notes" className="mt-3">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
