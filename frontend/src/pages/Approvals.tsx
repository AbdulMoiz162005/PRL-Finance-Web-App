import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Modal, PageHeader, Select, Textarea } from '../components/ui';
import { fmtDate, fmtNum } from '../lib/format';

const ENTITY_LABEL: Record<string, string> = {
  journal: 'Journal Entry',
  invoice: 'Sales Invoice',
  purchase_invoice: 'Purchase Bill',
};

export const Approvals: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<any>(null);
  const [error, setError] = useState('');

  const canApprove = user && ['director', 'admin', 'manager'].includes(user.role);

  const load = useCallback(async (st: string) => {
    setLoading(true);
    try {
      const res = await api.get('/approvals', { params: { status: st } });
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status); }, [status]);

  const decide = async (decision: 'approved' | 'rejected') => {
    try {
      await api.post(`/approvals/${reviewing.id}/decision`, { decision, comment: reviewing.comment || null });
      setReviewing(null);
      load(status);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const columns = [
    { key: 'entity_no', header: 'Document', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.entity_no}</span> },
    { key: 'entity_type', header: 'Type', render: (r: any) => <Badge status="pending" label={ENTITY_LABEL[r.entity_type] || r.entity_type} /> },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.amount)}</span> },
    { key: 'requested_by_name', header: 'Requested by', render: (r: any) => r.requested_by_name || '—' },
    { key: 'requested_at', header: 'Requested', render: (r: any) => fmtDate(r.requested_at) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
    { key: 'reviewed_by_name', header: 'Reviewed by', render: (r: any) => r.reviewed_by_name || '—' },
    { key: '_a', header: '', className: 'text-right', render: (r: any) =>
        status === 'pending' && canApprove ? (
          <button className="rounded p-1.5 text-slate-400 hover:text-brand-600" onClick={() => setReviewing(r)}><Eye className="h-4 w-4" /></button>
        ) : null },
  ];

  return (
    <div>
      <PageHeader
        title="Approval Inbox"
        subtitle="Documents above the approval threshold routed to managers, directors and administrators"
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="mb-4 flex gap-2">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors capitalize ${status === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No approval requests" />
      </Card>

      {reviewing && (
        <Modal
          open
          onClose={() => setReviewing(null)}
          title={`Review ${reviewing.entity_no}`}
          size="md"
          footer={
            status === 'pending' && canApprove ? (
              <>
                <button className="btn-danger" onClick={() => decide('rejected')}><XCircle className="h-4 w-4" /> Reject</button>
                <button className="btn-primary" onClick={() => decide('approved')}><CheckCircle2 className="h-4 w-4" /> Approve</button>
              </>
            ) : (
              <button className="btn-secondary" onClick={() => setReviewing(null)}>Close</button>
            )
          }
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><p className="label">Document</p><p className="text-sm font-mono font-semibold">{reviewing.entity_no}</p></div>
            <div><p className="label">Type</p><p className="text-sm font-medium">{ENTITY_LABEL[reviewing.entity_type] || reviewing.entity_type}</p></div>
            <div><p className="label">Amount</p><p className="text-sm font-bold">${fmtNum(reviewing.amount)}</p></div>
            <div><p className="label">Requested by</p><p className="text-sm font-medium">{reviewing.requested_by_name || '—'}</p></div>
          </div>
          <Field label="Comment">
            <Textarea
              rows={3}
              value={reviewing.comment || ''}
              onChange={(e) => setReviewing({ ...reviewing, comment: e.target.value })}
              placeholder="Review comment (optional)"
              disabled={status !== 'pending'}
            />
          </Field>
          {status !== 'pending' && <p className="mt-2 text-xs text-slate-500">Reviewed {fmtDate(reviewing.reviewed_at)}</p>}
        </Modal>
      )}
    </div>
  );
};
