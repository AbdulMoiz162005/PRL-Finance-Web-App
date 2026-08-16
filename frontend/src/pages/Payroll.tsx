import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Eye, CheckCircle2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, DataTable, Field, Input, Modal, PageHeader, Select, Tabs } from '../components/ui';
import { fmtDate, fmtNum } from '../lib/format';

export const Payroll: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('runs');
  const [runs, setRuns] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRun, setOpenRun] = useState(false);
  const [openEmp, setOpenEmp] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLines, setDetailLines] = useState<any[]>([]);
  const [error, setError] = useState('');

  const canEdit = user && ['accountant', 'admin', 'director'].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, e, d] = await Promise.all([
        api.get('/payroll/runs'),
        api.get('/payroll/employees'),
        api.get('/master/departments'),
      ]);
      setRuns(r.data.items || []);
      setEmployees(e.data.items || []);
      setDepartments(d.data.items || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (row: any) => {
    try {
      const res = await api.get(`/payroll/runs/${row.id}`);
      setDetail(res.data.item);
      setDetailLines(res.data.lines || []);
    } catch (e) { setError(errMsg(e)); }
  };

  const postRun = async (row: any) => {
    try {
      await api.post(`/payroll/runs/${row.id}/post`);
      load();
      if (detail?.id === row.id) openDetail(row);
    } catch (e) { setError(errMsg(e)); }
  };

  const runColumns = [
    { key: 'run_no', header: 'Run #', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.run_no}</span> },
    { key: 'period', header: 'Period', render: (r: any) => <span>{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</span> },
    { key: 'employee_count', header: 'Staff', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.employee_count}</span> },
    { key: 'total_gross', header: 'Gross', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.total_gross)}</span> },
    { key: 'total_deductions', header: 'Deductions', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.total_deductions)}</span> },
    { key: 'total_net', header: 'Net pay', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.total_net)}</span> },
    { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
    { key: '_a', header: '', className: 'text-right', render: (r: any) => (
        <div className="flex justify-end gap-1">
          <button className="rounded p-1.5 text-slate-400 hover:text-brand-600" onClick={() => openDetail(r)}><Eye className="h-4 w-4" /></button>
          {canEdit && r.status === 'draft' && (
            <button className="rounded p-1.5 text-slate-400 hover:text-emerald-600" title="Post" onClick={() => postRun(r)}><CheckCircle2 className="h-4 w-4" /></button>
          )}
        </div>
      ) },
  ];

  const empColumns = [
    { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', header: 'Name', render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: 'department_name', header: 'Department', render: (r: any) => r.department_name || '—' },
    { key: 'designation', header: 'Designation', render: (r: any) => r.designation || '—' },
    { key: 'basic_salary', header: 'Basic', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.basic_salary)}</span> },
    { key: 'allowances', header: 'Allowances', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.allowances)}</span> },
    { key: 'statutory_deductions', header: 'Statutory', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.statutory_deductions)}</span> },
    { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Monthly payroll runs with automatic salary, allowance and statutory GL posting"
        actions={
          canEdit && (
            <>
              <button className="btn-secondary" onClick={() => setOpenEmp(true)}><Plus className="h-4 w-4" /> Employee</button>
              <button className="btn-primary" onClick={() => setOpenRun(true)}><Plus className="h-4 w-4" /> New Run</button>
            </>
          )
        }
      />
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Tabs
        tabs={[{ key: 'runs', label: 'Payroll runs' }, { key: 'employees', label: 'Employees' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'runs' ? (
        <Card className="p-0"><DataTable columns={runColumns} rows={runs} loading={loading} emptyMessage="No payroll runs yet" /></Card>
      ) : (
        <Card className="p-0"><DataTable columns={empColumns} rows={employees} loading={loading} emptyMessage="No employees yet" /></Card>
      )}

      {openRun && (
        <RunForm onClose={() => setOpenRun(false)} onDone={() => { setOpenRun(false); load(); }} />
      )}
      {openEmp && (
        <EmployeeForm departments={departments} onClose={() => setOpenEmp(false)} onDone={() => { setOpenEmp(false); load(); }} />
      )}

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`${detail.run_no} · ${fmtDate(detail.period_start)} → ${fmtDate(detail.period_end)}`}
          size="xl"
          footer={<button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div><p className="label">Gross</p><p className="text-sm font-semibold">${fmtNum(detail.total_gross)}</p></div>
            <div><p className="label">Deductions</p><p className="text-sm font-semibold">${fmtNum(detail.total_deductions)}</p></div>
            <div><p className="label">Net pay</p><p className="text-sm font-semibold">${fmtNum(detail.total_net)}</p></div>
            <div><p className="label">Status</p><Badge status={detail.status} /></div>
          </div>
          <DataTable
            columns={[
              { key: 'employee_code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.employee_code}</span> },
              { key: 'employee_name', header: 'Employee', render: (r: any) => <span className="font-medium">{r.employee_name}</span> },
              { key: 'department_name', header: 'Department', render: (r: any) => r.department_name || '—' },
              { key: 'basic_salary', header: 'Basic', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.basic_salary)}</span> },
              { key: 'allowances', header: 'Allowances', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.allowances)}</span> },
              { key: 'gross', header: 'Gross', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.gross)}</span> },
              { key: 'statutory_deductions', header: 'Statutory', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.statutory_deductions)}</span> },
              { key: 'net', header: 'Net', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.net)}</span> },
            ]}
            rows={detailLines}
            rowKey="id"
          />
        </Modal>
      )}
    </div>
  );
};

const RunForm: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ period_start: defaultStart, period_end: defaultEnd });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/payroll/runs', form);
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
      title="Generate Payroll Run"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.period_start || !form.period_end} onClick={submit}>{saving ? 'Saving...' : 'Generate'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Period start"><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></Field>
        <Field label="Period end"><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
        </Field>
      </div>
      <p className="mt-3 text-xs text-slate-500">Creates a draft run for all active employees. Post it to generate the payroll GL entry.</p>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};

const EmployeeForm: React.FC<{ departments: any[]; onClose: () => void; onDone: () => void }> = ({ departments, onClose, onDone }) => {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/payroll/employees', form);
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
      title="New Employee"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !form.code || !form.name} onClick={submit}>{saving ? 'Saving...' : 'Save'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Code"><Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="EMP-001" /></Field>
        <Field label="Name"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Department">
          <Select value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">— none —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Designation"><Input value={form.designation || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
        <Field label="Basic salary"><Input type="number" step="any" value={form.basic_salary ?? ''} onChange={(e) => setForm({ ...form, basic_salary: Number(e.target.value) })} /></Field>
        <Field label="Allowances"><Input type="number" step="any" value={form.allowances ?? ''} onChange={(e) => setForm({ ...form, allowances: Number(e.target.value) })} /></Field>
        <Field label="Statutory deductions"><Input type="number" step="any" value={form.statutory_deductions ?? ''} onChange={(e) => setForm({ ...form, statutory_deductions: Number(e.target.value) })} /></Field>
        <Field label="Join date"><Input type="date" value={form.join_date || ''} onChange={(e) => setForm({ ...form, join_date: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Bank name"><Input value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
        <Field label="Bank account"><Input value={form.bank_account || ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></Field>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
};
