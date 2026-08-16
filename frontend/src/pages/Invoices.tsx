import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Eye, Ban, CheckCircle2, XCircle, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Modal, PageHeader, Input, ConfirmDialog } from '../components/ui';
import { InvoiceModal, Party } from '../components/InvoiceModal';
import { fmtDate, fmtNum } from '../lib/format';

const KIND = {
  sale: { label: 'Sales Invoices', base: '/invoices', party: 'Customer', invoiceNo: 'invoice_no', invoiceDate: 'invoice_date', partyCol: 'customer_name' },
  purchase: { label: 'Purchase Bills', base: '/purchase-invoices', party: 'Supplier', invoiceNo: 'bill_no', invoiceDate: 'bill_date', partyCol: 'supplier_name' },
};

export const Invoices: React.FC<{ kind: 'sale' | 'purchase' }> = ({ kind }) => {
  const k = KIND[kind];
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailLines, setDetailLines] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [voiding, setVoiding] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const canCreate = user && ['accountant', 'admin', 'director', 'manager'].includes(user.role);
  const canApprove = user && ['director', 'admin', 'manager'].includes(user.role);
  const canVoid = user && ['accountant', 'admin', 'director'].includes(user.role);

  const load = useCallback(async (st: string, search = '') => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (st) params.status = st;
    if (search) params.q = search;
    try {
      const res = await api.get(k.base, { params });
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [k.base]);

  useEffect(() => { load(status, q); }, [status, q]);

  useEffect(() => {
    const partyEp = kind === 'sale' ? '/parties/customers' : '/parties/suppliers';
    api.get(partyEp).then((r) => setParties(r.data.items));
    api.get('/catalog/products').then((r) => setProducts(r.data.items.filter((p: any) => p.is_active)));
  }, [kind]);

  const openDetail = async (row: any) => {
    setNotice('');
    setError('');
    try {
      const res = await api.get(`${k.base}/${row.id}`);
      setDetail(res.data.item);
      setDetailLines(res.data.lines || []);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const approve = async () => {
    try {
      await api.post(`${k.base}/${detail.id}/approve`);
      setDetail(null);
      load(status, q);
    } catch (e) { setError(errMsg(e)); }
  };

  const reject = async () => {
    try {
      await api.post(`${k.base}/${detail.id}/reject`, { comment: 'Rejected from review' });
      setDetail(null);
      load(status, q);
    } catch (e) { setError(errMsg(e)); }
  };

  const doVoid = async () => {
    try {
      await api.post(`${k.base}/${voiding.id}/void`, { reason: 'Voided' });
      setVoiding(null);
      if (detail?.id === voiding.id) setDetail(null);
      load(status, q);
    } catch (e) { setError(errMsg(e)); setVoiding(null); }
  };

  const columns = [
    { key: k.invoiceNo, header: '#', render: (r: any) => <span className="font-mono text-xs font-semibold">{r[k.invoiceNo]}</span> },
    { key: k.partyCol, header: k.party, render: (r: any) => <span className="font-medium">{r[k.partyCol] || '—'}</span> },
    { key: k.invoiceDate, header: 'Date', render: (r: any) => fmtDate(r[k.invoiceDate]) },
    { key: 'due_date', header: 'Due', render: (r: any) => fmtDate(r.due_date) },
    { key: 'total', header: 'Total', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.total)}</span> },
    { key: 'amount_paid', header: 'Paid', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.amount_paid)}</span> },
    { key: 'balance', header: 'Balance', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(Number(r.total) - Number(r.amount_paid))}</span> },
    { key: 'status', header: 'Status', render: (r: any) => (
        <div className="flex flex-col gap-1">
          <Badge status={r.status} />
          {r.approval_status === 'pending' && <Badge status="pending" label="Awaiting approval" />}
        </div>
      ) },
    { key: '_a', header: '', className: 'text-right', render: (r: any) => (
        <button className="rounded p-1.5 text-slate-400 hover:text-brand-600" onClick={() => openDetail(r)}><Eye className="h-4 w-4" /></button>
      ) },
  ];

  return (
    <div>
      <PageHeader
        title={k.label}
        subtitle={kind === 'sale' ? 'Sales invoices drive revenue GL and inventory dispatch' : 'Purchase bills drive expense GL and stock intake'}
        actions={canCreate && <button className="btn-primary" onClick={() => setOpenForm(true)}><Plus className="h-4 w-4" /> New {kind === 'sale' ? 'Invoice' : 'Bill'}</button>}
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['', 'issued', 'partially_paid', 'paid', 'draft', 'void'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${status === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
          >
            {s === '' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
        <div className="relative ml-auto max-w-xs w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage={`No ${k.label.toLowerCase()} found`} />
      </Card>

      {openForm && (
        <InvoiceModal
          kind={kind}
          open={openForm}
          onClose={() => setOpenForm(false)}
          onDone={(res) => {
            setOpenForm(false);
            load(status, q);
            setNotice(
              res.approval_status === 'pending'
                ? `${k.label.slice(0, -1)} ${res.item[k.invoiceNo]} created and routed for approval.`
                : `${k.label.slice(0, -1)} ${res.item[k.invoiceNo]} created, posted to GL and inventory.`,
            );
          }}
          parties={parties}
          products={products}
        />
      )}

      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`${detail[k.invoiceNo]} · ${detail[k.partyCol] || ''}`}
          size="xl"
          footer={
            <div className="flex items-center gap-2">
              <Badge status={detail.status} />
              {detail.approval_status === 'pending' && canApprove && (
                <>
                  <button className="btn-danger" onClick={reject}><XCircle className="h-4 w-4" /> Reject</button>
                  <button className="btn-primary" onClick={approve}><CheckCircle2 className="h-4 w-4" /> Approve</button>
                </>
              )}
              {canVoid && Number(detail.amount_paid) === 0 && detail.status !== 'void' && (
                <button className="btn-ghost text-rose-600" onClick={() => setVoiding(detail)}><Ban className="h-4 w-4" /> Void</button>
              )}
              <button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div><p className="label">Date</p><p className="text-sm font-medium">{fmtDate(detail[k.invoiceDate])}</p></div>
            <div><p className="label">Due date</p><p className="text-sm font-medium">{fmtDate(detail.due_date)}</p></div>
            <div><p className="label">Reference</p><p className="text-sm font-medium">{detail.reference || '—'}</p></div>
            <div><p className="label">Created by</p><p className="text-sm font-medium">{detail.created_by_name || '—'}</p></div>
          </div>
          <DataTable
            columns={[
              { key: 'product_code', header: 'Product', render: (r: any) => r.product_code ? <span className="font-mono text-xs">{r.product_code} · {r.product_name}</span> : <span className="text-slate-400">Service / other</span> },
              { key: 'description', header: 'Description', render: (r: any) => r.description || '—' },
              { key: 'quantity', header: 'Qty', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtNum(r.quantity, 0)}</span> },
              { key: 'unit_price', header: 'Unit price', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.unit_price)}</span> },
              { key: 'tax_amount', header: 'Tax', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.tax_amount)}</span> },
              { key: 'line_total', header: 'Total', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.line_total)}</span> },
            ]}
            rows={detailLines}
            rowKey="id"
          />
          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <p className="text-slate-500">Subtotal: <span className="tabular-nums font-semibold text-slate-800">${fmtNum(detail.subtotal)}</span></p>
            <p className="text-slate-500">Tax: <span className="tabular-nums font-semibold text-slate-800">${fmtNum(detail.tax_amount)}</span></p>
            <p className="text-base font-bold">Total: ${fmtNum(detail.total)}</p>
            <p className="text-slate-500">Paid: <span className="tabular-nums font-semibold text-emerald-600">${fmtNum(detail.amount_paid)}</span></p>
            <p className="text-slate-500">Balance: <span className="tabular-nums font-semibold text-rose-600">${fmtNum(Number(detail.total) - Number(detail.amount_paid))}</span></p>
          </div>
          {detail.approval_status === 'pending' && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              This document exceeds the approval threshold and is awaiting approval. GL and inventory postings happen on approval.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </Modal>
      )}

      <ConfirmDialog
        open={!!voiding}
        onClose={() => setVoiding(null)}
        onConfirm={doVoid}
        title={`Void ${k.label.slice(0, -1)}`}
        message={`Void ${voiding?.[k.invoiceNo]}? This will remove any pending approvals and mark it void.`}
        confirmLabel="Void"
      />
    </div>
  );
};
