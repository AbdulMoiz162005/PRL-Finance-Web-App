import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Boxes, ListChecks, Users, ArrowRight } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Card, Spinner, StatCard } from '../components/ui';
import { fmtDate, fmtNum, ROLE_LABEL } from '../lib/format';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
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
    return <Spinner />;
  }

  const c = summary.month?.label || '';

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]} {user?.role ? `· ${ROLE_LABEL[user.role] || user.role}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user?.companyName} — financial overview for <span className="font-semibold text-slate-700">{c}</span>
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Revenue (month)" value={`$${fmtNum(summary.revenue)}`} icon={<TrendingUp className="h-4 w-4" />} tone="green" hint={`YTD $${fmtNum(summary.ytd_revenue)}`} />
        <StatCard label="Expenses (month)" value={`$${fmtNum(summary.expense)}`} icon={<TrendingDown className="h-4 w-4" />} tone="red" hint={`YTD $${fmtNum(summary.ytd_expense)}`} />
        <StatCard label="Net profit (month)" value={`$${fmtNum(summary.net_profit)}`} icon={<DollarSign className="h-4 w-4" />} tone={Number(summary.net_profit) >= 0 ? 'blue' : 'red'} hint={`YTD $${fmtNum(summary.ytd_net)}`} />
        <StatCard label="Cash & bank" value={`$${fmtNum(summary.cash)}`} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Receivables" value={`$${fmtNum(summary.receivables)}`} icon={<DollarSign className="h-4 w-4" />} tone="blue" hint="Unpaid customer invoices" />
        <StatCard label="Payables" value={`$${fmtNum(summary.payables)}`} icon={<DollarSign className="h-4 w-4" />} tone="red" hint="Unpaid supplier bills" />
        <StatCard label="Inventory value" value={`$${fmtNum(summary.inventory_value)}`} icon={<Boxes className="h-4 w-4" />} />
        <Link to="/approvals" className="block">
          <StatCard label="Pending approvals" value={`${summary.pending_approvals}`} icon={<ListChecks className="h-4 w-4" />} tone={summary.pending_approvals > 0 ? 'red' : 'default'} hint="Awaiting decision →" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card title="Revenue vs Expenses" subtitle="Last 6 months" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`$${fmtNum(v)}`]} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#16a34a" fill="url(#gRev)" name="Revenue" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="url(#gExp)" name="Expenses" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top Customers" subtitle="By revenue">
          <div className="space-y-2">
            {topCustomers.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.invoices} invoice{c.invoices === 1 ? '' : 's'}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-slate-900">${fmtNum(c.revenue)}</p>
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
        <div className="space-y-2">
          {activity.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <Badge status="issued" label={a.action} />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{a.entity}</span>
              <span className="text-xs text-slate-400">{a.user_email}</span>
              <span className="text-xs text-slate-400 tabular-nums">{fmtDate(a.created_at)}</span>
            </div>
          ))}
          {!activity.length && <p className="text-sm text-slate-400 py-6 text-center">No activity yet</p>}
        </div>
      </Card>
    </div>
  );
};
