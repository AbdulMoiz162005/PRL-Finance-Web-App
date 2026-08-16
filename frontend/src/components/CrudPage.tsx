import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, Column, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from './ui';

export interface CrudField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'email';
  options?: { value: string; label: string }[];
  required?: boolean;
  step?: string;
}

export interface MasterConfig {
  base: string;
  title: string;
  subtitle?: string;
  columns: Column[];
  fields: CrudField[];
  roles?: string[]; // roles allowed to see
  writeRoles?: string[];
  keyName?: string;
  search?: boolean;
}

export const MasterCrud: React.FC<MasterConfig> = ({
  base,
  title,
  subtitle,
  columns,
  fields,
  roles,
  writeRoles = ['admin', 'accountant'],
  keyName = 'code',
  search = true,
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const canWrite = user && writeRoles.includes(user.role);
  const visible = !roles || (user && roles.includes(user.role));

  const load = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const res = await api.get(base, { params: query ? { q: query } : {} });
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  if (!visible) return null;

  const openNew = () => {
    setForm({});
    setError('');
    setOpen(true);
  };
  const openEdit = (row: any) => {
    const f: Record<string, any> = {};
    for (const field of fields) f[field.key] = row[field.key];
    setForm(f);
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`${base}/${editing.id}`, form);
      } else {
        await api.post(base, form);
      }
      setOpen(false);
      load(q);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`${base}/${deleting.id}`);
      setDeleting(null);
      load(q);
    } catch (e) {
      setError(errMsg(e));
      setDeleting(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          canWrite && (
            <button className="btn-primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> New
            </button>
          )
        }
      />
      {search && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Card className="p-0">
        <DataTable
          columns={[
            ...columns,
            ...(canWrite
              ? [
                  {
                    key: '_actions',
                    header: '',
                    className: 'text-right',
                    render: (row: any) => (
                      <div className="flex justify-end gap-1">
                        <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" onClick={(e) => { e.stopPropagation(); setEditing(row); openEdit(row); }}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600" onClick={(e) => { e.stopPropagation(); setDeleting(row); }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
          rows={items}
          loading={loading}
          emptyMessage={`No ${title.toLowerCase()} found`}
          onRowClick={canWrite ? (r) => { setEditing(r); openEdit(r); } : undefined}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${title.replace(/s$/, '')}` : `New ${title.replace(/s$/, '')}`}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {f.type === 'select' ? (
                <Select value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required={f.required}>
                  <option value="">— select —</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              ) : f.type === 'textarea' ? (
                <Textarea rows={3} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : (
                <Input
                  type={f.type || 'text'}
                  step={f.step}
                  value={form[f.key] ?? ''}
                  required={f.required}
                  onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete record"
        message={`Delete ${deleting?.[keyName] || deleting?.name || 'this record'}? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
};
