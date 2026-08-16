import React, { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';
import { Badge, Card, DataTable, Field, Input, PageHeader, Select, Spinner } from '../components/ui';
import { fmtNum, yearStart, todayISO } from '../lib/format';

type ReportKey = 'trial-balance' | 'income' | 'balance-sheet' | 'cash-flow' | 'ledger' | 'aged-receivables' | 'aged-payables' | 'stock-valuation' | 'budget' | 'asset-schedule';

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: 'trial-balance', label: 'Trial Balance' },
  { key: 'income', label: 'Income Statement' },
  { key: 'balance-sheet', label: 'Balance Sheet' },
  { key: 'cash-flow', label: 'Cash Flow' },
  { key: 'ledger', label: 'General Ledger' },
  { key: 'aged-receivables', label: 'Aged Receivables' },
  { key: 'aged-payables', label: 'Aged Payables' },
  { key: 'stock-valuation', label: 'Stock Valuation' },
  { key: 'budget', label: 'Budget vs Actual' },
  { key: 'asset-schedule', label: 'Asset Schedule' },
];

export const Reports: React.FC = () => {
  const [report, setReport] = useState<ReportKey>('trial-balance');

  return (
    <div>
      <PageHeader title="Reports Center" subtitle="Management and statutory financial reports" />
      <div className="mb-4 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setReport(r.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${report === r.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ReportViewer report={report} />
    </div>
  );
};

const ReportViewer: React.FC<{ report: ReportKey }> = ({ report }) => {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(todayISO());
  const [asOf, setAsOf] = useState(todayISO());
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/master/accounts').then((r) => setAccounts(r.data.items.filter((a: any) => a.is_postable)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params: Record<string, string> = {};
    if (['trial-balance', 'income', 'cash-flow'].includes(report)) { params.from = from; params.to = to; }
    if (['balance-sheet', 'aged-receivables', 'aged-payables'].includes(report)) { params.as_of = asOf; }
    if (report === 'ledger' && accountId) params.account = accountId;
    try {
      const res = await api.get(`/reports/${report}`, { params });
      setData(res.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [report, from, to, asOf, accountId]);

  useEffect(() => { load(); }, [load]);

  const dateParams = (
    <>
      {['trial-balance', 'income', 'cash-flow'].includes(report) && (
        <>
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </>
      )}
      {['balance-sheet', 'aged-receivables', 'aged-payables'].includes(report) && (
        <Field label="As of"><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
      )}
      {report === 'ledger' && (
        <Field label="Account" className="min-w-[260px]">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </Select>
        </Field>
      )}
    </>
  );

  if (loading) return <Card><Spinner /></Card>;
  if (error) return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">{dateParams}</div>
      </Card>
      <Card className="p-0">
        {report === 'trial-balance' && <TrialBalance data={data} />}
        {report === 'income' && <IncomeStatement data={data} />}
        {report === 'balance-sheet' && <BalanceSheet data={data} />}
        {report === 'cash-flow' && <CashFlow data={data} />}
        {report === 'ledger' && <Ledger data={data} />}
        {report === 'aged-receivables' && <Aging data={data} kind="receivable" />}
        {report === 'aged-payables' && <Aging data={data} kind="payable" />}
        {report === 'stock-valuation' && <StockValuation data={data} />}
        {report === 'budget' && <BudgetVsActual data={data} />}
        {report === 'asset-schedule' && <AssetSchedule data={data} />}
      </Card>
    </div>
  );
};

const SectionTitle: React.FC<{ text: string }> = ({ text }) => (
  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">{text}</div>
);

const TrialBalance: React.FC<{ data: any }> = ({ data }) => (
  <>
    <SectionTitle text={`Trial Balance · ${data.from} → ${data.to}`} />
    <DataTable
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: 'Account', render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'type', header: 'Type', render: (r: any) => <span className="capitalize text-xs">{r.type}</span> },
        { key: 'opening_debit', header: 'Opening Dr', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.opening_debit ? `$${fmtNum(r.opening_debit)}` : ''}</span> },
        { key: 'opening_credit', header: 'Opening Cr', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.opening_credit ? `$${fmtNum(r.opening_credit)}` : ''}</span> },
        { key: 'period_debit', header: 'Period Dr', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.period_debit ? `$${fmtNum(r.period_debit)}` : ''}</span> },
        { key: 'period_credit', header: 'Period Cr', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.period_credit ? `$${fmtNum(r.period_credit)}` : ''}</span> },
        { key: 'closing_debit', header: 'Closing Dr', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">{r.closing_debit ? `$${fmtNum(r.closing_debit)}` : ''}</span> },
        { key: 'closing_credit', header: 'Closing Cr', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">{r.closing_credit ? `$${fmtNum(r.closing_credit)}` : ''}</span> },
      ]}
      rows={data.items}
      rowKey="account_id"
      footer={
        <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
          <tr>
            <td className="td" colSpan={2}>Totals</td>
            <td className="td"></td>
            <td className="td text-right tabular-nums">${fmtNum(data.totals.opening_debit)}</td>
            <td className="td text-right tabular-nums">${fmtNum(data.totals.opening_credit)}</td>
            <td className="td text-right tabular-nums">${fmtNum(data.totals.period_debit)}</td>
            <td className="td text-right tabular-nums">${fmtNum(data.totals.period_credit)}</td>
            <td className="td text-right tabular-nums">${fmtNum(data.totals.closing_debit)}</td>
            <td className="td text-right tabular-nums">${fmtNum(data.totals.closing_credit)}</td>
          </tr>
        </tfoot>
      }
    />
  </>
);

const IncomeStatement: React.FC<{ data: any }> = ({ data }) => {
  const s = data.summary;
  const rows = [
    { label: 'Operating revenue', amount: s.operating_revenue, indent: 0 },
    { label: 'Other income', amount: s.other_income, indent: 1 },
    { label: 'Less: contra revenue / discounts', amount: s.contra_revenue, indent: 1 },
    { label: 'Net revenue', amount: s.net_revenue, bold: true, indent: 0 },
    { label: 'Cost of sales', amount: s.cost_of_sales, indent: 1 },
    { label: 'Gross profit', amount: s.gross_profit, bold: true, indent: 0 },
    { label: 'Operating expenses', amount: s.operating_expenses, indent: 1 },
    { label: 'Operating profit', amount: s.operating_profit, bold: true, indent: 0 },
    { label: 'Net profit', amount: s.net_profit, bold: true, indent: 0 },
  ];
  return (
    <>
      <SectionTitle text={`Income Statement · ${data.from} → ${data.to}`} />
      <div className="px-4 py-2">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center justify-between border-b border-slate-100 py-1.5 text-sm ${r.bold ? 'font-bold text-slate-900' : 'text-slate-700'}`} style={{ paddingLeft: r.indent * 20 }}>
            <span>{r.label}</span>
            <span className="tabular-nums">${fmtNum(r.amount)}</span>
          </div>
        ))}
      </div>
    </>
  );
};

const BalanceSheet: React.FC<{ data: any }> = ({ data }) => {
  const s = data.sections;
  const sections = [
    { title: 'Assets', rows: [
        { label: 'Current assets', amount: s.current_assets },
        { label: 'Fixed assets', amount: s.fixed_assets },
        { label: 'Less: accumulated depreciation', amount: s.contra_assets },
        { label: 'Total assets', amount: s.total_assets, bold: true },
      ] },
    { title: 'Liabilities', rows: [
        { label: 'Current liabilities', amount: s.current_liabilities },
        { label: 'Long-term liabilities', amount: s.long_term_liabilities },
        { label: 'Total liabilities', amount: s.total_liabilities, bold: true },
      ] },
    { title: 'Equity', rows: [
        { label: 'Equity', amount: s.equity },
        { label: 'Retained earnings (current period)', amount: s.retained_earnings_current_period },
        { label: 'Total equity', amount: s.total_equity, bold: true },
      ] },
  ];
  return (
    <>
      <SectionTitle text={`Balance Sheet · as of ${data.as_of}`} />
      <div className="px-4 py-2">
        {sections.map((sec, i) => (
          <div key={i} className="mb-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">{sec.title}</p>
            {sec.rows.map((r, j) => (
              <div key={j} className={`flex items-center justify-between py-1 text-sm ${r.bold ? 'font-bold text-slate-900 border-t border-slate-200' : 'text-slate-700'}`}>
                <span>{r.label}</span>
                <span className="tabular-nums">${fmtNum(r.amount)}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
          <span>Total assets</span><span className="tabular-nums">${fmtNum(s.total_assets)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800">
          <span>Total liabilities + equity</span><span className="tabular-nums">${fmtNum(s.total_liabilities_equity)}</span>
        </div>
      </div>
    </>
  );
};

const CashFlow: React.FC<{ data: any }> = ({ data }) => {
  const secs = [
    { title: 'Operating activities', flow: data.operating },
    { title: 'Investing activities', flow: data.investing },
    { title: 'Financing activities', flow: data.financing },
  ];
  return (
    <>
      <SectionTitle text={`Cash Flow Statement · ${data.from} → ${data.to}`} />
      <div className="px-4 py-2">
        {secs.map((sec, i) => (
          <div key={i} className="mb-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">{sec.title}</p>
            {sec.flow.details.map((r: any, j: number) => (
              <div key={j} className="flex items-center justify-between py-1 text-sm text-slate-700">
                <span className="pl-3">{r.name}</span>
                <span className={`tabular-nums ${r.amount >= 0 ? '' : 'text-rose-600'}`}>{r.amount >= 0 ? '' : '-'}$${fmtNum(Math.abs(r.amount))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-200 py-1 text-sm font-bold text-slate-900">
              <span>Net {sec.title}</span>
              <span className="tabular-nums">${fmtNum(sec.flow.net)}</span>
            </div>
          </div>
        ))}
        <div className="space-y-1 border-t-2 border-slate-300 pt-2 text-sm">
          <div className="flex justify-between text-slate-700"><span>Opening cash</span><span className="tabular-nums font-semibold">${fmtNum(data.opening_cash)}</span></div>
          <div className="flex justify-between text-slate-700"><span>Net change in cash</span><span className="tabular-nums font-semibold">${fmtNum(data.net_change_in_cash)}</span></div>
          <div className="flex justify-between font-bold text-slate-900"><span>Closing cash</span><span className="tabular-nums">${fmtNum(data.closing_cash)}</span></div>
        </div>
      </div>
    </>
  );
};

const Ledger: React.FC<{ data: any }> = ({ data }) => {
  if (!data.account) return <div className="p-6 text-sm text-slate-500">Select an account to view its ledger.</div>;
  return (
    <>
      <SectionTitle text={`General Ledger · ${data.account.code} ${data.account.name} · ${data.from} → ${data.to}`} />
      <DataTable
        columns={[
          { key: 'entry_date', header: 'Date', render: (r: any) => new Date(r.entry_date).toLocaleDateString('en-GB') },
          { key: 'entry_no', header: 'Entry', render: (r: any) => <span className="font-mono text-xs">{r.entry_no}</span> },
          { key: 'entry_desc', header: 'Description', render: (r: any) => <span className="whitespace-normal max-w-xs">{r.entry_desc || r.line_desc || ''}</span> },
          { key: 'reference', header: 'Ref', render: (r: any) => <span className="font-mono text-xs">{r.reference || '—'}</span> },
          { key: 'debit', header: 'Debit', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.debit ? `$${fmtNum(r.debit)}` : ''}</span> },
          { key: 'credit', header: 'Credit', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.credit ? `$${fmtNum(r.credit)}` : ''}</span> },
          { key: 'balance', header: 'Balance', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.balance)}</span> },
        ]}
        rows={data.items}
        rowKey="entry_no"
        footer={
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
            <tr>
              <td className="td" colSpan={5}>Opening balance / Closing balance</td>
              <td className="td text-right tabular-nums">${fmtNum(data.opening_balance)}</td>
              <td className="td text-right tabular-nums">${fmtNum(data.closing_balance)}</td>
            </tr>
          </tfoot>
        }
      />
    </>
  );
};

const Aging: React.FC<{ data: any; kind: 'receivable' | 'payable' }> = ({ data, kind }) => {
  const no = kind === 'receivable' ? 'invoice_no' : 'bill_no';
  const party = kind === 'receivable' ? 'customer_name' : 'supplier_name';
  return (
    <>
      <SectionTitle text={`Aged ${kind === 'receivable' ? 'Receivables' : 'Payables'} · as of ${data.as_of} · Total ${fmtNum(data.total_outstanding)}`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3">
        {Object.entries(data.buckets).map(([b, v]) => (
          <div key={b} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            <p className="text-xs text-slate-500">{b} days</p>
            <p className="text-base font-bold tabular-nums">${fmtNum(Number(v))}</p>
          </div>
        ))}
      </div>
      <DataTable
        columns={[
          { key: no, header: '#', render: (r: any) => <span className="font-mono text-xs font-semibold">{r[no]}</span> },
          { key: party, header: kind === 'receivable' ? 'Customer' : 'Supplier', render: (r: any) => <span className="font-medium">{r[party]}</span> },
          { key: 'invoice_date', header: 'Date', render: (r: any) => new Date(r.invoice_date || r.bill_date).toLocaleDateString('en-GB') },
          { key: 'due_date', header: 'Due', render: (r: any) => r.due_date ? new Date(r.due_date).toLocaleDateString('en-GB') : '—' },
          { key: 'days', header: 'Days', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{r.days}</span> },
          { key: 'bucket', header: 'Bucket', render: (r: any) => <Badge status={r.bucket === '90+' ? 'rejected' : r.bucket === '61-90' ? 'pending' : 'issued'} label={`${r.bucket} days`} /> },
          { key: 'outstanding', header: 'Outstanding', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.outstanding)}</span> },
        ]}
        rows={data.items}
        rowKey="id"
      />
    </>
  );
};

const StockValuation: React.FC<{ data: any }> = ({ data }) => (
  <>
    <SectionTitle text={`Stock Valuation · Total ${fmtNum(data.total_value)}`} />
    <DataTable
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: 'Product', render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'current_qty', header: 'Qty', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtNum(r.current_qty)}</span> },
        { key: 'avg_cost', header: 'Avg cost', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.avg_cost)}</span> },
        { key: 'stock_value', header: 'Stock value', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.stock_value)}</span> },
      ]}
      rows={data.items}
      rowKey="code"
    />
  </>
);

const BudgetVsActual: React.FC<{ data: any }> = ({ data }) => (
  <>
    <SectionTitle text={`Budget vs Actual · FY ${data.year}`} />
    <DataTable
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: 'Account', render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'type', header: 'Type', render: (r: any) => <span className="capitalize text-xs">{r.type}</span> },
        { key: 'budget_amount', header: 'Budget', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.budget_amount)}</span> },
        { key: 'actual', header: 'Actual', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.actual)}</span> },
        { key: 'variance', header: 'Variance', align: 'right' as const, render: (r: any) => <span className={`tabular-nums font-semibold ${Number(r.variance) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>${fmtNum(r.variance)}</span> },
        { key: 'utilization', header: 'Utilization', align: 'right' as const, render: (r: any) => <span className="tabular-nums">{fmtNum(r.utilization, 0)}%</span> },
      ]}
      rows={data.items}
      rowKey="account_id"
    />
  </>
);

const AssetSchedule: React.FC<{ data: any }> = ({ data }) => (
  <>
    <SectionTitle text="Fixed Asset Depreciation Schedule" />
    <DataTable
      columns={[
        { key: 'code', header: 'Code', render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: 'name', header: 'Asset', render: (r: any) => <span className="font-medium">{r.name}</span> },
        { key: 'category', header: 'Category', render: (r: any) => <span className="capitalize text-xs">{String(r.category || '').replace(/_/g, ' ')}</span> },
        { key: 'cost', header: 'Cost', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.cost)}</span> },
        { key: 'monthly_depreciation', header: 'Monthly dep.', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.monthly_depreciation)}</span> },
        { key: 'accumulated_depreciation', header: 'Accum. dep.', align: 'right' as const, render: (r: any) => <span className="tabular-nums">${fmtNum(r.accumulated_depreciation)}</span> },
        { key: 'net_book_value', header: 'Net book value', align: 'right' as const, render: (r: any) => <span className="tabular-nums font-semibold">${fmtNum(r.net_book_value)}</span> },
        { key: 'status', header: 'Status', render: (r: any) => <Badge status={r.status} /> },
      ]}
      rows={data.items}
      rowKey="id"
    />
  </>
);
