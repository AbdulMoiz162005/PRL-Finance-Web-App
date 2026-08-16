import React, { useCallback, useEffect, useState } from 'react';
import { Plus, KeyRound, Pencil, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Tabs } from '../components/ui';
import { fmtNum, ROLE_LABEL } from '../lib/format';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('company');

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company profile, users and approval rules" />
      <Tabs
        tabs={[
          { key: 'company', label: 'Company' },
          { key: 'users', label: 'Users & Roles' },
          { key: 'approval', label: 'Approval Rules' },
          { key: 'password', label: 'Change Password' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'company' && <CompanyTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'approval' && <ApprovalRulesTab />}
      {tab === 'password' && <PasswordTab />}
    </div>
  );
};

const CompanyTab: React.FC = () => {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings/company').then((r) => setForm(r.data.company));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      const res = await api.put('/settings/company', form);
      setForm(res.data.company);
      setMsg('Company settings updated.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;
  return (
    <div className="max-w-2xl">
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Legal name"><Input value={form.legal_name || ''} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} /></Field>
          <Field label="Tax ID"><Input value={form.tax_id || ''} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></Field>
          <Field label="Registration no."><Input value={form.registration_no || ''} onChange={(e) => setForm({ ...form, registration_no: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Currency">
            <Select value={form.currency || 'USD'} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="USD">USD</option>
              <option value="NGN">NGN</option>
            </Select>
          </Field>
          <Field label="Fiscal year start"><Input type="date" value={form.fiscal_year_start || ''} onChange={(e) => setForm({ ...form, fiscal_year_start: e.target.value })} /></Field>
          <Field label="Address" className="sm:col-span-2">
            <Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
        </div>
        {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </Card>
    </div>
  );
};

const UsersTab: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [resetting, setResetting] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: search ? { q: search } : {} });
      setItems(res.data.items || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const columns = [
    { key: 'name', header: 'Name', render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: 'email', header: 'Email', render: (r: any) => <span className="font-mono text-xs">{r.email}</span> },
    { key: 'role', header: 'Role', render: (r: any) => <Badge status={r.role === 'admin' ? 'issued' : r.role === 'director' ? 'posted' : 'pending'} label={ROLE_LABEL[r.role] || r.role} /> },
    { key: 'department', header: 'Department', render: (r: any) => r.department || '—' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
    { key: 'last_login_at', header: 'Last login', render: (r: any) => r.last_login_at ? new Date(r.last_login_at).toLocaleString('en-GB') : '—' },
    { key: '_a', header: '', className: 'text-right', render: (r: any) => (
        <div className="flex justify-end gap-1">
          <button className="rounded p-1.5 text-slate-400 hover:text-brand-600" title="Edit" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></button>
          <button className="rounded p-1.5 text-slate-400 hover:text-amber-600" title="Reset password" onClick={() => setResetting(r)}><KeyRound className="h-4 w-4" /></button>
        </div>
      ) },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search users..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> New User</button>
      </div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Card className="p-0">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No users found" />
      </Card>

      {open && (
        <UserForm editing={editing} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(q); }} />
      )}
      {resetting && (
        <ResetDialog user={resetting} onClose={() => setResetting(null)} />
      )}
    </div>
  );
};

const UserForm: React.FC<{ editing: any | null; onClose: () => void; onDone: () => void }> = ({ editing, onClose, onDone }) => {
  const [form, setForm] = useState<any>(
    editing
      ? { name: editing.name, email: editing.email, role: editing.role, department: editing.department, status: editing.status }
      : { name: '', email: '', role: 'accountant', department: '', status: 'active', password: '' },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, { name: form.name, role: form.role, department: form.department, status: form.status });
      } else {
        await api.post('/users', form);
      }
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
      title={editing ? `Edit ${editing.name}` : 'New User'}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.name || !form.role} onClick={submit}>{saving ? 'Saving...' : 'Save'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        {!editing && <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>}
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {['admin', 'director', 'accountant', 'auditor', 'manager', 'operator'].map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Department"><Input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
        {!editing && <Field label="Password"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" /></Field>}
        {editing && (
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </Select>
          </Field>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};

const ResetDialog: React.FC<{ user: any; onClose: () => void }> = ({ user, onClose }) => {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/users/${user.id}/reset-password`, { password });
      onClose();
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
      title={`Reset password · ${user.name}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || password.length < 8} onClick={submit}>{saving ? 'Saving...' : 'Reset Password'}</button>
        </>
      }
    >
      <Field label="New password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" /></Field>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};

const ApprovalRulesTab: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  useEffect(() => {
    api.get('/settings/approval-threshold').then((r) => setRules(r.data.rules || []));
  }, []);

  return (
    <div className="max-w-2xl">
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Rule tiers" value={rules.length} />
        <StatCard label="Highest authority" value={rules.length ? (ROLE_LABEL[rules[rules.length - 1].role] || rules[rules.length - 1].role) : '—'} />
        <StatCard label="Base threshold" value="Configured server-side" />
      </div>
      <Card className="p-0">
        <DataTable
          columns={[
            { key: 'role', header: 'Approver role', render: (r: any) => <span className="font-medium">{ROLE_LABEL[r.role] || r.role}</span> },
            { key: 'min_amount', header: 'From amount', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.min_amount)}</span> },
            { key: 'max_amount', header: 'Up to amount', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.max_amount ? `$${fmtNum(r.max_amount)}` : 'Unlimited'}</span> },
          ]}
          rows={rules}
          rowKey="role"
          emptyMessage="No approval rules configured"
        />
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Documents below the server-side <span className="font-mono">APPROVAL_THRESHOLD</span> skip approval. Documents within a tier are routed to that role. Rules are seeded and managed in the database.
      </p>
    </div>
  );
};

const PasswordTab: React.FC = () => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setMsg('');
    setError('');
    if (form.newPassword !== form.confirm) {
      setError('New passwords do not match.');
      setSaving(false);
      return;
    }
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setMsg('Password updated.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <Card>
        <div className="space-y-3">
          <Field label="Current password"><Input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
          <Field label="New password"><Input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
          <Field label="Confirm new password"><Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
        </div>
        {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving...' : 'Update Password'}</button>
        </div>
      </Card>
    </div>
  );
};
