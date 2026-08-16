import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok, round2 } from '../utils';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const monthRange = (offset = 0) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { start, end, label: new Date(y, m, 1).toLocaleString('en', { month: 'short', year: 'numeric' }) };
};

router.get(
  '/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const { start, end } = monthRange(0);
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const today = new Date().toISOString().slice(0, 10);

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
      [req.user!.companyId, start, end],
    );

    const ytd = await pool.query(
      `select
         coalesce((select sum(case when a.normal_balance='credit' then l.credit - l.debit else l.debit - l.credit end)
                   from journal_entry_lines l join journal_entries je on je.id=l.entry_id
                   join chart_of_accounts a on a.id=l.account_id
                   where je.company_id=$1 and a.type='revenue' and je.status='posted' and je.entry_date >= $2::date and je.entry_date <= $3::date),0) as revenue,
         coalesce((select sum(case when a.normal_balance='debit' then l.debit - l.credit else l.credit - l.debit end)
                   from journal_entry_lines l join journal_entries je on je.id=l.entry_id
                   join chart_of_accounts a on a.id=l.account_id
                   where je.company_id=$1 and a.type='expense' and je.status='posted' and je.entry_date >= $2::date and je.entry_date <= $3::date),0) as expense`,
      [req.user!.companyId, yearStart, today],
    );

    const ar = await pool.query(
      `select coalesce(sum(i.total - i.amount_paid),0) as v from invoices i
       where i.company_id=$1 and i.status in ('issued','partially_paid')`,
      [req.user!.companyId],
    );
    const ap = await pool.query(
      `select coalesce(sum(i.total - i.amount_paid),0) as v from purchase_invoices i
       where i.company_id=$1 and i.status in ('issued','partially_paid')`,
      [req.user!.companyId],
    );
    const cash = await pool.query(
      `select coalesce(sum(
         a.opening_balance +
         case when a.normal_balance='debit' then (select coalesce(sum(l.debit)-sum(l.credit),0) from journal_entry_lines l join journal_entries je on je.id=l.entry_id where l.account_id=a.id and je.company_id=$1 and je.status='posted')
              else (select coalesce(sum(l.credit)-sum(l.debit),0) from journal_entry_lines l join journal_entries je on je.id=l.entry_id where l.account_id=a.id and je.company_id=$1 and je.status='posted')
         end),0) as v
       from chart_of_accounts a where a.company_id=$1 and a.type='asset' and a.subtype='cash'`,
      [req.user!.companyId],
    );
    const inventory = await pool.query(
      `select coalesce(sum(case when it.quantity>0 then it.total_value else 0 end),0) as val,
              coalesce(sum(it.quantity),0) as qty
       from inventory_transactions it
       join products p on p.id = it.product_id
       where p.company_id = $1`,
      [req.user!.companyId],
    );
    const approvals = await pool.query(
      `select count(*)::int as c from approval_requests where company_id=$1 and status='pending'`,
      [req.user!.companyId],
    );

    ok(res, {
      month: { start, end, label: monthRange(0).label },
      revenue: round2(Number(pnl.rows[0].revenue)),
      expense: round2(Number(pnl.rows[0].expense)),
      net_profit: round2(Number(pnl.rows[0].revenue) - Number(pnl.rows[0].expense)),
      ytd_revenue: round2(Number(ytd.rows[0].revenue)),
      ytd_expense: round2(Number(ytd.rows[0].expense)),
      ytd_net: round2(Number(ytd.rows[0].revenue) - Number(ytd.rows[0].expense)),
      receivables: round2(Number(ar.rows[0].v)),
      payables: round2(Number(ap.rows[0].v)),
      cash: round2(Number(cash.rows[0].v)),
      inventory_value: round2(Number(inventory.rows[0].val)),
      pending_approvals: approvals.rows[0].c,
    });
  }),
);

router.get(
  '/revenue-expense',
  asyncHandler(async (req: AuthRequest, res) => {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(monthRange(-i));
    const rows = [];
    for (const m of months) {
      const res = await pool.query(
        `select
           coalesce((select sum(case when a.normal_balance='credit' then l.credit - l.debit else l.debit - l.credit end)
                     from journal_entry_lines l join journal_entries je on je.id=l.entry_id
                     join chart_of_accounts a on a.id=l.account_id
                     where je.company_id=$1 and a.type='revenue' and je.status='posted' and je.entry_date >= $2::date and je.entry_date <= $3::date),0) as revenue,
           coalesce((select sum(case when a.normal_balance='debit' then l.debit - l.credit else l.credit - l.debit end)
                     from journal_entry_lines l join journal_entries je on je.id=l.entry_id
                     join chart_of_accounts a on a.id=l.account_id
                     where je.company_id=$1 and a.type='expense' and je.status='posted' and je.entry_date >= $2::date and je.entry_date <= $3::date),0) as expense`,
        [req.user!.companyId, m.start, m.end],
      );
      rows.push({ month: m.label, revenue: round2(Number(res.rows[0].revenue)), expense: round2(Number(res.rows[0].expense)) });
    }
    ok(res, { items: rows });
  }),
);

router.get(
  '/top-customers',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select c.id, c.name, coalesce(sum(i.total),0) as revenue, count(i.id)::int as invoices
       from customers c left join invoices i on i.customer_id = c.id and i.status <> 'void' and i.company_id = $1
       where c.company_id = $1
       group by c.id order by revenue desc limit 6`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/recent-activity',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select a.action, a.entity, a.user_email, a.created_at
       from audit_logs a
       join users u on u.id = a.user_id
       where u.company_id = $1
       order by a.created_at desc limit 12`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

export default router;
