import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Badge, Card, DataTable, Input, PageHeader } from '../components/ui';
import { fmtDate } from '../lib/format';

export const Audit: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get('/audit-logs', { params: q ? { q } : { limit: 300 } })
        .then((r) => setItems(r.data.items || []))
        .catch((e) => setError(errMsg(e)))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const columns = [
    { key: 'created_at', header: 'Timestamp', render: (r: any) => <span className="tabular-nums text-xs">{new Date(r.created_at).toLocaleString('en-GB')}</span> },
    { key: 'user_email', header: 'User', render: (r: any) => <span>{r.user_email}</span> },
    { key: 'action', header: 'Action', render: (r: any) => <Badge status="issued" label={r.action} /> },
    { key: 'entity', header: 'Entity', render: (r: any) => <span className="font-mono text-xs">{r.entity}</span> },
    { key: 'entity_id', header: 'Entity ID', render: (r: any) => <span className="font-mono text-[11px] text-slate-400">{String(r.entity_id).slice(0, 8)}</span> },
    { key: 'details', header: 'Details', render: (r: any) => (
        <span className="whitespace-normal max-w-sm block text-xs text-slate-500">
          {r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details).slice(0, 160)) : '—'}
        </span>
      ) },
  ];

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Immutable record of every financial action taken in the system" />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search user, action, entity..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No audit records" />
      </Card>
    </div>
  );
};
