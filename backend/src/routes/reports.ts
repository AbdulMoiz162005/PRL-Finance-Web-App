import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok, round2 } from '../utils';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { parseDateRange } from './parse';

const router = Router();
router.use(requireAuth);

const POSTED = `je.status = 'posted'`;

const getFiscalYearStart = async (companyId: string): Promise<string> => {
  const res = await pool.query('select fiscal_year_start from companies where id = $1', [companyId]);
  return res.rows[0]?.fiscal_year_start || `${new Date().getFullYear()}-01-01`;
};

const accountMovements = async (companyId: string, from: string, to: string) => {
  const res = await pool.query(
    `select l.account_id, sum(l.debit) as debit, sum(l.credit) as credit
     from journal_entry_lines l
     join journal_entries je on je.id = l.entry_id
     where je.company_id = $1 and ${POSTED} and je.entry_date >= $2::date and je.entry_date <= $3::date
     group by l.account_id`,
    [companyId, from, to],
  );
  return new Map(res.rows.map((r) => [r.account_id, { debit: Number(r.debit), credit: Number(r.credit) }]));
};

const allAccounts = async (companyId: string) => {
  const res = await pool.query(
    `select id, code, name, type, subtype, normal_balance, cash_flow_category, opening_balance, parent_id
     from chart_of_accounts where company_id = $1 order by code`,
    [companyId],
  );
  return res.rows.map((a) => ({ ...a, opening_balance: Number(a.opening_balance) }));
};

// ---------------------------------------------------------------------------
router.get(
  '/trial-balance',
  asyncHandler(async (req: AuthRequest, res) => {
    const { from, to } = parseDateRange(req);
    const effFrom = from || (await getFiscalYearStart(req.user!.companyId));
    const effTo = to || new Date().toISOString().slice(0, 10);
    const accounts = await allAccounts(req.user!.companyId);
    const mov = await accountMovements(req.user!.companyId, effFrom, effTo);

    const rows = accounts
      .map((a) => {
        const m = mov.get(a.id) || { debit: 0, credit: 0 };
        const openingDebit = a.normal_balance === 'debit' ? a.opening_balance : 0;
        const openingCredit = a.normal_balance === 'credit' ? a.opening_balance : 0;
        const periodDebit = m.debit;
        const periodCredit = m.credit;
        const net = openingDebit + periodDebit - openingCredit - periodCredit;
        return {
          account_id: a.id, code: a.code, name: a.name, type: a.type,
          opening_debit: round2(openingDebit), opening_credit: round2(openingCredit),
          period_debit: round2(periodDebit), period_credit: round2(periodCredit),
          closing_debit: round2(net >= 0 ? net : 0), closing_credit: round2(net < 0 ? -net : 0),
        };
      });
    ok(res, {
      from: effFrom,
      to: effTo,
      items: rows,
      totals: {
        opening_debit: round2(rows.reduce((s, r) => s + r.opening_debit, 0)),
        opening_credit: round2(rows.reduce((s, r) => s + r.opening_credit, 0)),
        period_debit: round2(rows.reduce((s, r) => s + r.period_debit, 0)),
        period_credit: round2(rows.reduce((s, r) => s + r.period_credit, 0)),
        closing_debit: round2(rows.reduce((s, r) => s + r.closing_debit, 0)),
        closing_credit: round2(rows.reduce((s, r) => s + r.closing_credit, 0)),
      },
    });
  }),
);

// ---------------------------------------------------------------------------
router.get(
  '/income-statement',
  asyncHandler(async (req: AuthRequest, res) => {
    const { from, to } = parseDateRange(req);
    const effFrom = from || (await getFiscalYearStart(req.user!.companyId));
    const effTo = to || new Date().toISOString().slice(0, 10);
    const accounts = await allAccounts(req.user!.companyId);
    const mov = await accountMovements(req.user!.companyId, effFrom, effTo);

    const revenues = accounts.filter((a) => a.type === 'revenue').map((a) => {
      const m = mov.get(a.id) || { debit: 0, credit: 0 };
      const amount = a.normal_balance === 'credit' ? m.credit - m.debit : m.debit - m.credit;
      return { account_id: a.id, code: a.code, name: a.name, subtype: a.subtype, amount: round2(amount) };
    });
    const expenses = accounts.filter((a) => a.type === 'expense').map((a) => {
      const m = mov.get(a.id) || { debit: 0, credit: 0 };
      const amount = a.normal_balance === 'debit' ? m.debit - m.credit : m.credit - m.debit;
      return { account_id: a.id, code: a.code, name: a.name, subtype: a.subtype, amount: round2(amount) };
    });

    const sum = (arr: any[]) => round2(arr.reduce((s, r) => s + r.amount, 0));
    const operatingRevenue = sum(revenues.filter((r) => r.subtype === 'operating_revenue'));
    const otherIncome = sum(revenues.filter((r) => r.subtype !== 'operating_revenue' && r.subtype !== 'contra'));
    const contraRevenue = sum(revenues.filter((r) => r.subtype === 'contra'));
    const costOfSales = sum(expenses.filter((r) => r.subtype === 'cost_of_sales'));
    const operatingExpenses = sum(expenses.filter((r) => r.subtype === 'operating_expense'));

    const netRevenue = round2(operatingRevenue + otherIncome - contraRevenue);
    const grossProfit = round2(netRevenue - costOfSales);
    const operatingProfit = round2(grossProfit - operatingExpenses);
    const netProfit = round2(operatingProfit + otherIncome - 0);

    ok(res, {
      from: effFrom,
      to: effTo,
      revenue_items: revenues,
      expense_items: expenses,
      summary: {
        operating_revenue: operatingRevenue,
        other_income: otherIncome,
        contra_revenue: contraRevenue,
        net_revenue: netRevenue,
        cost_of_sales: costOfSales,
        gross_profit: grossProfit,
        operating_expenses: operatingExpenses,
        operating_profit: operatingProfit,
        net_profit: netProfit,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
router.get(
  '/balance-sheet',
  asyncHandler(async (req: AuthRequest, res) => {
    const asOf = req.query.as_of ? String(req.query.as_of) : new Date().toISOString().slice(0, 10);
    const accounts = await allAccounts(req.user!.companyId);
    const mov = await accountMovements(req.user!.companyId, await getFiscalYearStart(req.user!.companyId), asOf);

    const closing = (a: any) => {
      const m = mov.get(a.id) || { debit: 0, credit: 0 };
      const openingDebit = a.normal_balance === 'debit' ? a.opening_balance : 0;
      const openingCredit = a.normal_balance === 'credit' ? a.opening_balance : 0;
      const net = openingDebit + m.debit - openingCredit - m.credit;
      return net; // signed: positive debit balance, negative credit balance
    };

    const assetAccounts = accounts.filter((a) => a.type === 'asset').map((a) => ({ ...a, balance: closing(a) }));
    const liabilityAccounts = accounts.filter((a) => a.type === 'liability').map((a) => ({ ...a, balance: closing(a) }));
    const equityAccounts = accounts.filter((a) => a.type === 'equity').map((a) => ({ ...a, balance: closing(a) }));

    const currentAssets = round2(assetAccounts.filter((a) => a.subtype === 'current' || a.subtype === 'cash').reduce((s, a) => s + a.balance, 0));
    const fixedAssets = round2(assetAccounts.filter((a) => a.subtype === 'fixed').reduce((s, a) => s + a.balance, 0));
    const contraAssets = round2(assetAccounts.filter((a) => a.subtype === 'contra').reduce((s, a) => s - a.balance, 0));
    const currentLiabilities = round2(liabilityAccounts.filter((a) => a.subtype === 'current').reduce((s, a) => s - a.balance, 0));
    const longTermLiabilities = round2(liabilityAccounts.filter((a) => a.subtype === 'long_term').reduce((s, a) => s - a.balance, 0));
    const equity = round2(equityAccounts.reduce((s, a) => s - a.balance, 0));

    // Current year net income (retained earnings accretion)
    const pnl = await pool.query(
      `select
         coalesce((select sum(case when a.normal_balance='credit' then l.credit - l.debit else l.debit - l.credit end)
                   from journal_entry_lines l join journal_entries je on je.id=l.entry_id
                   join chart_of_accounts a on a.id=l.account_id
                   where je.company_id=$1 and a.type='revenue' and je.status='posted' and je.entry_date >= $2::date and je.entry_date <= $3::date),0) as revenue,
         coalesce((select sum(case when a.normal_balance='debit' then l.debit - l.credit else l.credit - l.debit end)
                   from journal_entry_lines l join journal_entries je on je.id=l.entry_id
                   join chart_of_accounts a on a.id=l.account_id
                   where je.company_id=$1 and a.type='expense' and je.status='posted' and je.entry_date >= $2::date and je.entry_date <= $3::date),0) as expense`,
      [req.user!.companyId, await getFiscalYearStart(req.user!.companyId), asOf],
    );
    const netIncome = round2(Number(pnl.rows[0].revenue) - Number(pnl.rows[0].expense));

    const totalAssets = round2(currentAssets + fixedAssets - contraAssets);
    const totalLiabilities = round2(currentLiabilities + longTermLiabilities);
    const totalEquity = round2(equity + netIncome);

    ok(res, {
      as_of: asOf,
      sections: {
        current_assets: currentAssets,
        fixed_assets: fixedAssets,
        contra_assets: contraAssets,
        total_assets: totalAssets,
        current_liabilities: currentLiabilities,
        long_term_liabilities: longTermLiabilities,
        total_liabilities: totalLiabilities,
        equity: equity,
        retained_earnings_current_period: netIncome,
        total_equity: totalEquity,
        total_liabilities_equity: round2(totalLiabilities + totalEquity),
      },
      assets: assetAccounts.map((a) => ({ code: a.code, name: a.name, subtype: a.subtype, balance: round2(a.balance) })),
      liabilities: liabilityAccounts.map((a) => ({ code: a.code, name: a.name, subtype: a.subtype, balance: round2(-a.balance) })),
      equity_items: equityAccounts.map((a) => ({ code: a.code, name: a.name, subtype: a.subtype, balance: round2(-a.balance) })),
      net_income: netIncome,
    });
  }),
);

// ---------------------------------------------------------------------------
router.get(
  '/cash-flow',
  asyncHandler(async (req: AuthRequest, res) => {
    const { from, to } = parseDateRange(req);
    const effFrom = from || (await getFiscalYearStart(req.user!.companyId));
    const effTo = to || new Date().toISOString().slice(0, 10);
    const accounts = await allAccounts(req.user!.companyId);
    const mov = await accountMovements(req.user!.companyId, effFrom, effTo);

    const cashAccounts = accounts.filter((a) => a.type === 'asset' && (a.subtype === 'cash' || ['1001', '1100', '1101'].includes(a.code)));

    const flowByCategory = (cat: string) => {
      const arr = accounts.filter((a) => a.cash_flow_category === cat && !cashAccounts.some((c) => c.id === a.id));
      let inflow = 0;
      const details = arr.map((a) => {
        const m = mov.get(a.id) || { debit: 0, credit: 0 };
        const net = round2(m.credit - m.debit);
        if (net > 0) inflow += net;
        return { code: a.code, name: a.name, amount: net };
      });
      return { details, net: round2(arr.reduce((s, a) => s + (mov.get(a.id)?.credit || 0) - (mov.get(a.id)?.debit || 0), 0)) };
    };

    const operating = flowByCategory('operating');
    const investing = flowByCategory('investing');
    const financing = flowByCategory('financing');

    const openingCash = round2(cashAccounts.reduce((s, a) => s + a.opening_balance, 0));
    const cashMov = await pool.query(
      `select coalesce(sum(l.debit),0) as d, coalesce(sum(l.credit),0) as c
       from journal_entry_lines l join journal_entries je on je.id=l.entry_id
       where je.company_id=$1 and je.status='posted' and l.account_id = any($2::uuid[]) and je.entry_date >= $3::date and je.entry_date <= $4::date`,
      [req.user!.companyId, cashAccounts.map((c) => c.id), effFrom, effTo],
    );
    const cashInflow = round2(Number(cashMov.rows[0].d) - Number(cashMov.rows[0].c));
    const closingCash = round2(openingCash + cashInflow);

    ok(res, {
      from: effFrom, to: effTo,
      operating,
      investing,
      financing,
      net_change_in_cash: round2(operating.net + investing.net + financing.net),
      opening_cash: openingCash,
      closing_cash: closingCash,
      cash_inflow_books: cashInflow,
    });
  }),
);

// ---------------------------------------------------------------------------
router.get(
  '/general-ledger',
  asyncHandler(async (req: AuthRequest, res) => {
    const accountId = String(req.query.account || '');
    const { from, to } = parseDateRange(req);
    if (!accountId) throw new Error('account query param is required');
    const effFrom = from || (await getFiscalYearStart(req.user!.companyId));
    const effTo = to || new Date().toISOString().slice(0, 10);

    const acct = await pool.query('select * from chart_of_accounts where id = $1 and company_id = $2', [accountId, req.user!.companyId]);
    if (!acct.rows[0]) throw new Error('Account not found');
    const a = acct.rows[0];
    const openMov = await pool.query(
      `select coalesce(sum(l.debit),0) as d, coalesce(sum(l.credit),0) as c
       from journal_entry_lines l join journal_entries je on je.id=l.entry_id
       where l.account_id=$1 and je.company_id=$2 and je.status='posted' and je.entry_date < $3::date`,
      [accountId, req.user!.companyId, effFrom],
    );
    const openingBalance = a.normal_balance === 'debit'
      ? Number(a.opening_balance) + Number(openMov.rows[0].d) - Number(openMov.rows[0].c)
      : Number(a.opening_balance) + Number(openMov.rows[0].c) - Number(openMov.rows[0].d);

    const lines = await pool.query(
      `select je.entry_no, je.entry_date, je.description as entry_desc, je.type, je.reference, je.entry_no as rev_no,
              l.description as line_desc, l.debit, l.credit, cc.code as cc_code, cc.name as cc_name
       from journal_entry_lines l
       join journal_entries je on je.id = l.entry_id
       left join cost_centers cc on cc.id = l.cost_center_id
       where l.account_id = $1 and je.company_id = $2 and je.status='posted'
         and je.entry_date >= $3::date and je.entry_date <= $4::date
       order by je.entry_date, je.entry_no`,
      [accountId, req.user!.companyId, effFrom, effTo],
    );
    let running = openingBalance;
    const items = lines.rows.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      running = a.normal_balance === 'debit' ? running + debit - credit : running + credit - debit;
      return { ...l, debit, credit, balance: round2(running) };
    });
    ok(res, { account: { id: a.id, code: a.code, name: a.name, normal_balance: a.normal_balance }, from: effFrom, to: effTo, opening_balance: round2(openingBalance), items, closing_balance: items.length ? items[items.length - 1].balance : round2(openingBalance) });
  }),
);

// ---------------------------------------------------------------------------
const ageBuckets = (asOf: string, daysOverdue: number): string => {
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
};

router.get(
  '/aged-receivables',
  asyncHandler(async (req: AuthRequest, res) => {
    const asOf = req.query.as_of ? String(req.query.as_of) : new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `select i.id, i.invoice_no, i.invoice_date, i.due_date, i.total, i.amount_paid,
              round(i.total - i.amount_paid, 2) as outstanding, i.customer_id, c.name as customer_name
       from invoices i join customers c on c.id = i.customer_id
       where i.company_id = $1 and i.status in ('issued','partially_paid')
       order by c.name, i.invoice_date`,
      [req.user!.companyId],
    );
    const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const items = result.rows.map((r) => {
      const outstanding = Number(r.outstanding);
      const days = Math.max(0, Math.floor((new Date(asOf).getTime() - new Date(r.due_date || r.invoice_date).getTime()) / 86400000));
      const bucket = ageBuckets(asOf, days);
      buckets[bucket] = round2(buckets[bucket] + outstanding);
      return { ...r, outstanding, days, bucket };
    });
    ok(res, { as_of: asOf, items, buckets, total_outstanding: round2(items.reduce((s, r) => s + r.outstanding, 0)) });
  }),
);

router.get(
  '/aged-payables',
  asyncHandler(async (req: AuthRequest, res) => {
    const asOf = req.query.as_of ? String(req.query.as_of) : new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `select i.id, i.bill_no, i.bill_date, i.due_date, i.total, i.amount_paid,
              round(i.total - i.amount_paid, 2) as outstanding, i.supplier_id, s.name as supplier_name
       from purchase_invoices i join suppliers s on s.id = i.supplier_id
       where i.company_id = $1 and i.status in ('issued','partially_paid')
       order by s.name, i.bill_date`,
      [req.user!.companyId],
    );
    const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const items = result.rows.map((r) => {
      const outstanding = Number(r.outstanding);
      const days = Math.max(0, Math.floor((new Date(asOf).getTime() - new Date(r.due_date || r.bill_date).getTime()) / 86400000));
      const bucket = ageBuckets(asOf, days);
      buckets[bucket] = round2(buckets[bucket] + outstanding);
      return { ...r, outstanding, days, bucket };
    });
    ok(res, { as_of: asOf, items, buckets, total_outstanding: round2(items.reduce((s, r) => s + r.outstanding, 0)) });
  }),
);

// ---------------------------------------------------------------------------
router.get(
  '/stock-valuation',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select p.code, p.name, p.category, p.unit, p.valuation_method,
              coalesce(sum(it.quantity),0) as current_qty,
              case when coalesce(sum(case when it.quantity>0 then it.quantity else 0 end),0) > 0
                   then coalesce(sum(it.total_value),0) / sum(case when it.quantity>0 then it.quantity else 0 end)
                   else 0 end as avg_cost,
              coalesce(sum(it.total_value),0) as valuation_in
       from products p
       left join inventory_transactions it on it.product_id = p.id and it.company_id = $1
       where p.company_id = $1 group by p.id order by p.code`,
      [req.user!.companyId],
    );
    const items = result.rows.map((r) => ({
      ...r,
      current_qty: Number(r.current_qty),
      avg_cost: Number(r.avg_cost),
      stock_value: round2(Number(r.current_qty) * Number(r.avg_cost)),
    }));
    ok(res, { items, total_value: round2(items.reduce((s, r) => s + r.stock_value, 0)) });
  }),
);

// ---------------------------------------------------------------------------
router.get(
  '/budget-vs-actual',
  asyncHandler(async (req: AuthRequest, res) => {
    const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const budgets = await pool.query(
      `select b.id, b.name, b.fiscal_year, b.status, bi.account_id, a.code, a.name, a.type,
              coalesce(sum(bi.amount),0) as budget_amount
       from budgets b
       join budget_items bi on bi.budget_id = b.id
       join chart_of_accounts a on a.id = bi.account_id
       where b.company_id = $1 and b.fiscal_year = $2
       group by b.id, bi.account_id, a.code, a.name, a.type order by a.code`,
      [req.user!.companyId, year],
    );
    const mov = await accountMovements(req.user!.companyId, from, to);
    const items = budgets.rows.map((b) => {
      const m = mov.get(b.account_id) || { debit: 0, credit: 0 };
      const actual = b.type === 'revenue' ? m.credit - m.debit : m.debit - m.credit;
      const budgetAmount = Number(b.budget_amount);
      return {
        ...b, budget_amount: round2(budgetAmount),
        actual: round2(actual),
        variance: round2(actual - budgetAmount),
        utilization: budgetAmount ? round2((Math.abs(actual) / budgetAmount) * 100) : 0,
      };
    });
    ok(res, { year, items });
  }),
);

// ---------------------------------------------------------------------------
router.get(
  '/asset-schedule',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select id, code, name, category, purchase_date, cost, salvage_value, useful_life_months,
              depreciation_method, accumulated_depreciation,
              round((cost - salvage_value) / nullif(useful_life_months,0), 2) as monthly_depreciation,
              round(cost - accumulated_depreciation, 2) as net_book_value, status
       from assets where company_id = $1 order by code`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

export default router;
