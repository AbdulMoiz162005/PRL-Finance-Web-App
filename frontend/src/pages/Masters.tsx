import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { MasterCrud } from '../components/CrudPage';
import { Tabs } from '../components/ui';
import { fmtDate, fmtNum } from '../lib/format';

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];
const SUBTYPES = [
  { value: 'current', label: 'Current' },
  { value: 'cash', label: 'Cash' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'contra', label: 'Contra' },
  { value: 'long_term', label: 'Long-term' },
  { value: 'operating_revenue', label: 'Operating revenue' },
  { value: 'other_income', label: 'Other income' },
  { value: 'cost_of_sales', label: 'Cost of sales' },
  { value: 'operating_expense', label: 'Operating expense' },
];
const CASH_FLOW_CATS = [
  { value: 'operating', label: 'Operating' },
  { value: 'investing', label: 'Investing' },
  { value: 'financing', label: 'Financing' },
];
const PRODUCT_CATS = [
  { value: 'refined_product', label: 'Refined product' },
  { value: 'crude_oil', label: 'Crude oil' },
  { value: 'feedstock', label: 'Feedstock' },
  { value: 'service', label: 'Service' },
];

export const Masters: React.FC = () => {
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [taxCodes, setTaxCodes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  useEffect(() => {
    api.get('/master/accounts').then((r) => setAccounts(r.data.items));
    api.get('/master/tax-codes').then((r) => setTaxCodes(r.data.items));
    api.get('/catalog/products').then((r) => setProducts(r.data.items));
    api.get('/master/cost-centers').then((r) => setCostCenters(r.data.items));
  }, []);

  const acctOptions = accounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  const taxOptions = taxCodes.map((t) => ({ value: t.id, label: `${t.code} · ${t.name} (${t.rate}%)` }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));
  const ccOptions = costCenters.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }));

  const tabs = [
    { key: 'accounts', label: 'Chart of Accounts' },
    { key: 'customers', label: 'Customers' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'products', label: 'Products' },
    { key: 'storages', label: 'Storage Tanks' },
    { key: 'bank-accounts', label: 'Bank Accounts' },
    { key: 'cost-centers', label: 'Cost Centers' },
    { key: 'tax-codes', label: 'Tax Codes' },
    { key: 'payment-terms', label: 'Payment Terms' },
    { key: 'departments', label: 'Departments' },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Master Data</h1>
      <p className="mb-5 text-sm text-slate-500">Chart of accounts, parties, catalog and reference data</p>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'accounts' && (
        <MasterCrud
          base="/master/accounts"
          title="Chart of Accounts"
          subtitle="General ledger accounts used for double-entry posting"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Account', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'type', header: 'Type', render: (r: any) => <span className="capitalize text-xs">{r.type}</span> },
            { key: 'subtype', header: 'Subtype', render: (r: any) => <span className="text-xs text-slate-500 capitalize">{String(r.subtype || '').replace(/_/g, ' ')}</span> },
            { key: 'normal_balance', header: 'Balance', render: (r: any) => <span className="text-xs uppercase">{r.normal_balance}</span> },
            { key: 'is_postable', header: 'Postable', render: (r: any) => (r.is_postable ? 'Yes' : 'No') },
            { key: 'opening_balance', header: 'Opening', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.opening_balance)}</span> },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'type', label: 'Type', type: 'select', options: ACCOUNT_TYPES, required: true },
            { key: 'subtype', label: 'Subtype', type: 'select', options: SUBTYPES },
            { key: 'normal_balance', label: 'Normal balance', type: 'select', options: [{ value: 'debit', label: 'Debit' }, { value: 'credit', label: 'Credit' }] },
            { key: 'cash_flow_category', label: 'Cash flow category', type: 'select', options: CASH_FLOW_CATS },
            { key: 'parent_id', label: 'Parent account', type: 'select', options: acctOptions },
            { key: 'opening_balance', label: 'Opening balance', type: 'number', step: 'any' },
            { key: 'is_postable', label: 'Postable', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
            { key: 'description', label: 'Description', type: 'textarea' },
          ]}
        />
      )}

      {tab === 'customers' && (
        <MasterCrud
          base="/parties/customers"
          title="Customers"
          subtitle="Offtakers and buyers of refined products"
          writeRoles={['admin', 'accountant', 'manager']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Customer', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'contact_person', header: 'Contact', render: (r: any) => r.contact_person || '—' },
            { key: 'phone', header: 'Phone', render: (r: any) => r.phone || '—' },
            { key: 'email', header: 'Email', render: (r: any) => r.email || '—' },
            { key: 'credit_limit', header: 'Credit limit', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.credit_limit)}</span> },
            { key: 'opening_balance', header: 'Opening bal.', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.opening_balance)}</span> },
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
            { key: 'credit_limit', label: 'Credit limit', type: 'number', step: 'any' },
            { key: 'payment_term_days', label: 'Payment terms (days)', type: 'number' },
            { key: 'opening_balance', label: 'Opening balance', type: 'number', step: 'any' },
            { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'suppliers' && (
        <MasterCrud
          base="/parties/suppliers"
          title="Suppliers"
          subtitle="Feedstock, crude and consumables vendors"
          writeRoles={['admin', 'accountant', 'manager']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Supplier', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'contact_person', header: 'Contact', render: (r: any) => r.contact_person || '—' },
            { key: 'phone', header: 'Phone', render: (r: any) => r.phone || '—' },
            { key: 'email', header: 'Email', render: (r: any) => r.email || '—' },
            { key: 'payment_term_days', header: 'Terms (days)', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.payment_term_days}</span> },
            { key: 'opening_balance', header: 'Opening bal.', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.opening_balance)}</span> },
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

      {tab === 'products' && (
        <MasterCrud
          base="/catalog/products"
          title="Products"
          subtitle="Refined products, crude and feedstocks with GL account mappings"
          writeRoles={['admin', 'accountant', 'manager']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Product', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'category', header: 'Category', render: (r: any) => <span className="capitalize text-xs">{String(r.category || '').replace(/_/g, ' ')}</span> },
            { key: 'unit', header: 'Unit', render: (r: any) => r.unit || '—' },
            { key: 'tax_rate', header: 'Tax', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtNum(r.tax_rate, 0)}%</span> },
            { key: 'sales_account_code', header: 'Sales acct', render: (r: any) => <span className="font-mono text-[11px]">{r.sales_account_code || '—'}</span> },
            { key: 'inventory_account_code', header: 'Inventory acct', render: (r: any) => <span className="font-mono text-[11px]">{r.inventory_account_code || '—'}</span> },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'category', label: 'Category', type: 'select', options: PRODUCT_CATS },
            { key: 'unit', label: 'Unit' },
            { key: 'tax_code_id', label: 'Tax code', type: 'select', options: taxOptions },
            { key: 'valuation_method', label: 'Valuation method', type: 'select', options: [{ value: 'average', label: 'Average cost' }, { value: 'fifo', label: 'FIFO' }] },
            { key: 'sales_account_id', label: 'Sales account', type: 'select', options: acctOptions },
            { key: 'cogs_account_id', label: 'COGS account', type: 'select', options: acctOptions },
            { key: 'inventory_account_id', label: 'Inventory account', type: 'select', options: acctOptions },
            { key: 'opening_qty', label: 'Opening qty', type: 'number', step: 'any' },
            { key: 'opening_unit_cost', label: 'Opening unit cost', type: 'number', step: 'any' },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'storages' && (
        <MasterCrud
          base="/catalog/storages"
          title="Storage Tanks"
          subtitle="Refinery storage tanks and depot facilities"
          writeRoles={['admin', 'manager']}
          columns={[
            { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code}</span> },
            { key: 'name', header: 'Storage', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'kind', header: 'Kind', render: (r: any) => <span className="capitalize text-xs">{r.kind}</span> },
            { key: 'capacity', header: 'Capacity', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtNum(r.capacity, 0)}</span> },
            { key: 'product_name', header: 'Product', render: (r: any) => r.product_name || '—' },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'tank', label: 'Tank' }, { value: 'depot', label: 'Depot' }, { value: 'warehouse', label: 'Warehouse' }] },
            { key: 'capacity', label: 'Capacity', type: 'number', step: 'any' },
            { key: 'product_id', label: 'Primary product', type: 'select', options: productOptions },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'bank-accounts' && (
        <MasterCrud
          base="/catalog/bank-accounts"
          title="Bank Accounts"
          subtitle="Cash accounts used for receipts and payments"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'name', header: 'Account', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'bank_name', header: 'Bank', render: (r: any) => r.bank_name || '—' },
            { key: 'account_number', header: 'Number', render: (r: any) => <span className="font-mono text-xs">{r.account_number}</span> },
            { key: 'currency', header: 'Currency', render: (r: any) => r.currency },
            { key: 'coa_code', header: 'GL account', render: (r: any) => <span className="font-mono text-[11px]">{r.coa_code} · {r.coa_name}</span> },
            { key: 'opening_balance', header: 'Opening', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.opening_balance)}</span> },
            { key: 'is_active', header: 'Status', render: (r: any) => (r.is_active ? <span className="text-emerald-600 text-xs font-semibold">ACTIVE</span> : <span className="text-rose-600 text-xs font-semibold">INACTIVE</span>) },
          ]}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'bank_name', label: 'Bank name' },
            { key: 'account_number', label: 'Account number' },
            { key: 'currency', label: 'Currency', type: 'select', options: [{ value: 'USD', label: 'USD' }, { value: 'NGN', label: 'NGN' }] },
            { key: 'coa_id', label: 'GL account', type: 'select', options: acctOptions },
            { key: 'opening_balance', label: 'Opening balance', type: 'number', step: 'any' },
            { key: 'is_active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}

      {tab === 'cost-centers' && (
        <MasterCrud
          base="/master/cost-centers"
          title="Cost Centers"
          subtitle="Refinery operations departments for cost allocation"
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
          subtitle="VAT rates applied to products and services"
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

      {tab === 'payment-terms' && (
        <MasterCrud
          base="/master/payment-terms"
          title="Payment Terms"
          subtitle="Net-day terms for invoices and bills"
          writeRoles={['admin', 'accountant']}
          columns={[
            { key: 'name', header: 'Name', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'days', header: 'Days', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.days}</span> },
          ]}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'days', label: 'Days', type: 'number' },
          ]}
        />
      )}

      {tab === 'departments' && (
        <MasterCrud
          base="/master/departments"
          title="Departments"
          subtitle="Company departments used by employees and payroll"
          writeRoles={['admin']}
          columns={[
            { key: 'name', header: 'Name', render: (r: any) => <span className="font-medium">{r.name}</span> },
          ]}
          fields={[{ key: 'name', label: 'Name', required: true }]}
        />
      )}
    </div>
  );
};
