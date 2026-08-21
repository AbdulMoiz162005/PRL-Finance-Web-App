import React, { useEffect, useState } from 'react';
import { ShieldCheck, Layers, Tag, Building2, Users, FileSignature, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { MasterCrud } from '../components/CrudPage';
import { PageHeader, StatCard, Tabs, Card, Badge, DataTable, Spinner } from '../components/ui';
import { fmtDate, fmtMoney, fmtNum } from '../lib/format';
import { useAuth } from '../lib/auth';

const DICT_TABS = [
  { key: 'service-types', label: 'Service Types' },
  { key: 'cost-elements', label: 'Cost Elements' },
  { key: 'cost-centers', label: 'Cost Centers' },
  { key: 'tax-codes', label: 'Tax Codes' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'employees', label: 'Employees' },
  { key: 'contracts', label: 'Contract Watch' },
];

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: 'default' | 'green' | 'red' | 'blue' }> = ({ label, value, hint, icon, tone }) => (
  <StatCard label={label} value={value} hint={hint} icon={icon} tone={tone} />
);

export const ControlCentre: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('service-types');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api.get('/master/service-types'),
      api.get('/master/cost-elements'),
      api.get('/parties/suppliers'),
      api.get('/payroll/employees'),
      api.get('/surveyors/references'),
    ])
      .then(([st, ce, sp, emp, refs]) => {
        const active = (arr: any[], key: string) => (arr || []).filter((r) => r[key]).length;
        setStats({
          serviceTypes: (st.data.items || []).length,
          serviceTypesActive: active(st.data.items, 'is_active'),
          costElements: (ce.data.items || []).length,
          costElementsActive: active(ce.data.items, 'is_active'),
          suppliers: (sp.data.items || []).length,
          suppliersActive: (sp.data.items || []).filter((r: any) => r.status === 'active').length,
          employees: (emp.data.items || []).length,
          employeesActive: (emp.data.items || []).filter((r: any) => r.status === 'active').length,
          contracts: refs.data.contracts || [],
        });
      })
      .catch(() => {});
  }, []);

  const contracts = stats?.contracts || [];
  const expiringSoon = contracts.filter((c: any) => {
    if (!c.end_date) return false;
    const days = (new Date(c.end_date).getTime() - Date.now()) / 86400000;
    return days <= 30 && days > 0;
  });

  const canWrite = user && ['admin', 'accountant'].includes(user.role);

  return (
    <div>
      <PageHeader
        title="Control Centre"
        subtitle="Central governance of every dropdown source — inactive and expired entries never reach forms"
        actions={
          canWrite && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Governed mode
            </span>
          )
        }
      />

      {stats ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Service Types" value={<span>{stats.serviceTypesActive}<span className="text-sm text-slate-400">/{stats.serviceTypes}</span></span>} hint="active / total" icon={<Tag className="h-4 w-4" />} tone="blue" />
          <Stat label="Cost Elements" value={<span>{stats.costElementsActive}<span className="text-sm text-slate-400">/{stats.costElements}</span></span>} hint="active / total" icon={<Layers className="h-4 w-4" />} tone="blue" />
          <Stat label="Vendors" value={<span>{stats.suppliersActive}<span className="text-sm text-slate-400">/{stats.suppliers}</span></span>} hint="active / total" icon={<Building2 className="h-4 w-4" />} />
          <Stat label="Employees" value={<span>{stats.employeesActive}<span className="text-sm text-slate-400">/{stats.employees}</span></span>} hint="active / total" icon={<Users className="h-4 w-4" />} />
          <Stat label="Valid Contracts" value={contracts.length} hint={`${expiringSoon.length} expiring ≤30d`} icon={<FileSignature className="h-4 w-4" />} tone={expiringSoon.length ? 'red' : 'green'} />
        </div>
      ) : (
        <div className="mb-5 h-24"><Spinner /></div>
      )}

      <Tabs tabs={DICT_TABS} active={tab} onChange={setTab} />

      {tab === 'service-types' && (
        <MasterCrud
          base="/master/service-types"
          title="Service Types"
          subtitle="Surveyor service catalogue — feeds contract and invoice service dropdowns"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Service', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'cost-elements' && (
        <MasterCrud
          base="/master/cost-elements"
          title="Cost Elements"
          subtitle="Cost allocation codes used on invoices and pay order lines"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Element', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'cost-centers' && (
        <MasterCrud
          base="/master/cost-centers"
          title="Cost Centers"
          subtitle="Cost allocation centers — active centers appear in pay order cost allocations"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Name', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'description', header: 'Description', render: (r: any) => r.description || '—' },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'tax-codes' && (
        <MasterCrud
          base="/master/tax-codes"
          title="Tax Codes"
          subtitle="VAT / sales tax rates — only active codes are offered on invoices"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Name', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'rate', header: 'Rate', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtNum(r.rate, 0)}%</span> },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'rate', label: 'Rate (%)', type: 'number', step: 'any' },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'vendors' && (
        <MasterCrud
          base="/parties/suppliers"
          title="Vendors"
          subtitle="Supplier master — only active suppliers appear in invoice vendor dropdowns"
          writeRoles={['admin', 'accountant', 'manager']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Vendor', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'contact_person', header: 'Contact', render: (r: any) => r.contact_person || '—' },
            { key: 'email', header: 'Email', render: (r: any) => r.email || '—' },
            { key: 'payment_term_days', header: 'Terms (days)', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.payment_term_days}</span> },
            { key: 'status', header: 'Status', render: (r: any) => (r.status === 'active' ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'tax_id', label: 'Tax ID' },
            { key: 'contact_person', label: 'Contact person' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'address', label: 'Address', type: 'textarea' },
            { key: 'payment_term_days', label: 'Payment terms (days)', type: 'number' },
            { key: 'opening_balance', label: 'Opening balance', type: 'number', step: 'any' },
            { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'employees' && (
        <MasterCrud
          base="/payroll/employees"
          title="Employees"
          subtitle="Payroll staff — only active employees are selectable and included in payroll runs"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Employee', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'department_name', header: 'Department', render: (r: any) => r.department_name || '—' },
            { key: 'designation', header: 'Designation', render: (r: any) => r.designation || '—' },
            { key: 'basic_salary', header: 'Basic', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtMoney(r.basic_salary, 'PKR')}</span> },
            { key: 'status', header: 'Status', render: (r: any) => (r.status === 'active' ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'designation', label: 'Designation' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'join_date', label: 'Join date', type: 'date' },
            { key: 'basic_salary', label: 'Basic salary', type: 'number', step: 'any' },
            { key: 'allowances', label: 'Allowances', type: 'number', step: 'any' },
            { key: 'statutory_deductions', label: 'Statutory deductions', type: 'number', step: 'any' },
            { key: 'bank_name', label: 'Bank name' },
            { key: 'bank_account', label: 'Bank account' },
            { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'contracts' && (
        <div>
          {expiringSoon.length > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {expiringSoon.length} contract{expiringSoon.length > 1 ? 's' : ''} expire within 30 days. Expired contracts are automatically excluded from invoice dropdowns.
              </span>
            </div>
          )}
          <Card className="p-0">
            <DataTable
              columns={[
                { key: 'contract_code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.contract_code}</span> },
                { key: 'contractor', header: 'Contractor', render: (r: any) => <span className="font-medium">{r.contractor}</span> },
                { key: 'service_type', header: 'Service', render: (r: any) => <span className="text-xs">{r.service_type}</span> },
                { key: 'contract_value', header: 'Value', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtMoney(r.contract_value, 'PKR')}</span> },
                { key: 'remaining_amount', header: 'Remaining', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtMoney(r.remaining_amount, 'PKR')}</span> },
                { key: 'end_date', header: 'End date', render: (r: any) => (r.end_date ? <span className="tabular-nums">{fmtDate(r.end_date)}</span> : '—') },
                { key: '_expiry', header: 'Expiry', render: (r: any) => {
                  if (!r.end_date) return '—';
                  const days = Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86400000);
                  if (days <= 0) return <Badge status="inactive" label="Expired" />;
                  if (days <= 30) return <Badge status="pending" label={`${days}d`} />;
                  return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> {days}d</span>;
                } },
              ]}
              rows={contracts}
              loading={!stats}
              emptyMessage="No valid contracts"
            />
          </Card>
        </div>
      )}
    </div>
  );
};
