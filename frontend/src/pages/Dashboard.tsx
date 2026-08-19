import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Boxes, ListChecks, Users, ArrowRight } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, CountUp, Spinner, StatCard } from '../components/ui';
import { AreaGradient, ChartTip, useChartTheme } from '../components/charts';
import { fmtDate, fmtNum, ROLE_LABEL } from '../lib/format';

const money = (n: number) => `$${fmtNum(n)}`;

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const t = useChartTheme();
  const [summary, setSummary] = useState<any>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((r) => setSummary(r.data))
      .catch((e) => setError(errMsg(e)));
    api.get('/dashboard/revenue-expense')
      .then((r) => setSeries(r.data.items || []))
      .catch(() => {});
    api.get('/dashboard/top-customers')
      .then((r) => setTopCustomers(r.data.items || []))
      .catch(() => {});
    api.get('/dashboard/recent-activity')
      .then((r) => setActivity(r.data.items || []))
      .catch(() => {});
  }, []);

  if (!summary) {
    if (error) return <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
    return <Spinner label="Loading financial overview…" />;
  }

  const c = summary.month?.label || '';
  const maxCust = Math.max(1, ...topCustomers.map((x: any) => Number(x.revenue || 0)));

  return (
    <div>
      <div className="mb-5 animate-fade-in">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]} {user?.role ? `· ${ROLE_LABEL[user.role] || user.role}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user?.companyName} — financial overview for <span className="font-semibold text-slate-700">{c}</span>
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <StatCard label="Revenue (month)" value={<CountUp value={Number(summary.revenue)} formatter={money} />} icon={<TrendingUp className="h-4 w-4" />} tone="green" hint={`YTD $${fmtNum(summary.ytd_revenue)}`} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <StatCard label="Expenses (month)" value={<CountUp value={Number(summary.expense)} formatter={money} />} icon={<TrendingDown className="h-4 w-4" />} tone="red" hint={`YTD $${fmtNum(summary.ytd_expense)}`} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <StatCard label="Net profit (month)" value={<CountUp value={Number(summary.net_profit)} formatter={(n) => `${n < 0 ? '-' : ''}$${fmtNum(Math.abs(n))}`} />} icon={<DollarSign className="h-4 w-4" />} tone={Number(summary.net_profit) >= 0 ? 'blue' : 'red'} hint={`YTD $${fmtNum(summary.ytd_net)}`} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <StatCard label="Cash & bank" value={<CountUp value={Number(summary.cash)} formatter={money} />} icon={<Wallet className="h-4 w-4" />} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <StatCard label="Receivables" value={<CountUp value={Number(summary.receivables)} formatter={money} />} icon={<DollarSign className="h-4 w-4" />} tone="blue" hint="Unpaid customer invoices" />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <StatCard label="Payables" value={<CountUp value={Number(summary.payables)} formatter={money} />} icon={<DollarSign className="h-4 w-4" />} tone="red" hint="Unpaid supplier bills" />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '360ms' }}>
          <StatCard label="Inventory value" value={<CountUp value={Number(summary.inventory_value)} formatter={money} />} icon={<Boxes className="h-4 w-4" />} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '420ms' }}>
          <Link to="/approvals" className="block">
            <StatCard label="Pending approvals" value={<CountUp value={Number(summary.pending_approvals)} formatter={(n) => fmtNum(n, 0)} />} icon={<ListChecks className="h-4 w-4" />} tone={summary.pending_approvals > 0 ? 'red' : 'default'} hint="Awaiting decision →" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card title="Revenue vs Expenses" subtitle="Last 6 months" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <AreaGradient id="gRev" color="#16a34a" />
                  <AreaGradient id="gExp" color="#dc2626" />
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: t.tick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: t.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip content={<ChartTip fmt={(v) => `$${fmtNum(v)}`} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="revenue" stroke="#16a34a" fill="url(#gRev)" name="Revenue" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={900} style={{ filter: 'drop-shadow(0 3px 5px rgba(22,163,74,0.25))' }} />
                <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="url(#gExp)" name="Expenses" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={900} style={{ filter: 'drop-shadow(0 3px 5px rgba(220,38,38,0.22))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top Customers" subtitle="By revenue">
          <div className="space-y-2.5">
            {topCustomers.map((cust: any, i: number) => (
              <div
                key={cust.id}
                className="rounded-lg bg-slate-50 px-3 py-2.5 animate-fade-in-up dark:bg-slate-800/60"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                      {(cust.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{cust.name}</p>
                      <p className="text-xs text-slate-400">{cust.invoices} invoice{cust.invoices === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-slate-900">${fmtNum(cust.revenue)}</p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                    style={{ width: `${Math.max(4, (Number(cust.revenue) / maxCust) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!topCustomers.length && <p className="text-sm text-slate-400 py-6 text-center">No sales yet</p>}
          </div>
          <Link to="/invoices" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
            View invoices <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      <Card title="Recent Activity" subtitle="Latest audit trail entries">
        <div className="space-y-1">
          {activity.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-1.5 animate-fade-in hover:bg-slate-50 dark:hover:bg-slate-800/60" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400 animate-pulse-soft" />
              <Badge status="issued" label={a.action} />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{a.entity}</span>
              <span className="hidden text-xs text-slate-400 sm:inline">{a.user_email}</span>
              <span className="text-xs text-slate-400 tabular-nums">{fmtDate(a.created_at)}</span>
            </div>
          ))}
          {!activity.length && <p className="text-sm text-slate-400 py-6 text-center">No activity yet</p>}
        </div>
      </Card>
    </div>
  );
};
