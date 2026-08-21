import { Router } from 'express';
import { transact, pool } from '../db';
import { asyncHandler, ok, AppError, audit, round2 } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { parseId } from '../middleware/validate';
import { makeCrud } from './crud';

const router = Router();
router.use(requireAuth);

// Active employees only — governed list for dropdowns
router.get(
  '/employee-options',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select e.code, e.name, e.name as label, e.department_id, coalesce(d.name, '') as department_name
       from employees e left join departments d on d.id = e.department_id
       where e.company_id = $1 and e.status = 'active' order by e.code`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

router.use(
  '/employees',
  makeCrud({
    table: 'employees',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    select: `employees.*, d.name as department_name`,
    joins: `left join departments d on d.id = employees.department_id`,
    insertFields: ['code', 'name', 'department_id', 'designation', 'phone', 'email', 'join_date', 'basic_salary', 'allowances', 'statutory_deductions', 'bank_name', 'bank_account', 'status'],
    updateFields: ['code', 'name', 'department_id', 'designation', 'phone', 'email', 'join_date', 'basic_salary', 'allowances', 'statutory_deductions', 'bank_name', 'bank_account', 'status'],
    writeRoles: ['admin', 'accountant'],
  }),
);

router.get(
  '/runs',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select r.*, u.name as processed_by_name,
              (select count(*) from payroll_lines l where l.run_id = r.id) as employee_count
       from payroll_runs r left join users u on u.id = r.processed_by
       where r.company_id = $1 order by r.period_end desc`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/runs/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const run = await pool.query(
      `select r.*, u.name as processed_by_name from payroll_runs r left join users u on u.id = r.processed_by
       where r.id = $1 and r.company_id = $2`,
      [id, req.user!.companyId],
    );
    if (!run.rows[0]) throw new AppError(404, 'Payroll run not found');
    const lines = await pool.query(
      `select l.*, e.name as employee_name, e.code as employee_code, e.department_id, d.name as department_name
       from payroll_lines l
       join employees e on e.id = l.employee_id
       left join departments d on d.id = e.department_id
       where l.run_id = $1 order by e.code`,
      [id],
    );
    ok(res, { item: run.rows[0], lines: lines.rows });
  }),
);

router.post(
  '/runs',
  requireRole('accountant', 'admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await transact(async (client) => {
      const start = req.body.period_start;
      const end = req.body.period_end;
      if (!start || !end) throw new AppError(422, 'period_start and period_end are required');

      const existing = await client.query(
        'select id from payroll_runs where company_id = $1 and period_start = $2 and period_end = $3',
        [req.user!.companyId, start, end],
      );
      if (existing.rows[0]) throw new AppError(409, 'A payroll run already exists for this period');

      const runNoRes = await client.query(
        `select 'PAY-'||extract(year from $1::date)||'-'||lpad((coalesce(max(substring(run_no from '([0-9]+)$')::int),0)+1)::text,5,'0') as no from payroll_runs`,
        [start],
      );
      const runNo = runNoRes.rows[0].no;

      const employees = await client.query(
        'select * from employees where company_id = $1 and status = $2 order by code',
        [req.user!.companyId, 'active'],
      );
      if (!employees.rows.length) throw new AppError(409, 'No active employees found');

      const inserted = await client.query(
        `insert into payroll_runs (company_id, run_no, period_start, period_end, status, processed_by, notes)
         values ($1,$2,$3,$4,'draft',$5,$6) returning *`,
        [req.user!.companyId, runNo, start, end, req.user!.id, req.body.notes ?? null],
      );
      const runId = inserted.rows[0].id;

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      for (const e of employees.rows) {
        const basic = round2(Number(e.basic_salary));
        const allowances = round2(Number(e.allowances));
        const statutory = round2(Number(e.statutory_deductions));
        const gross = round2(basic + allowances);
        const net = round2(gross - statutory);
        totalGross += gross;
        totalDeductions += statutory;
        totalNet += net;
        await client.query(
          `insert into payroll_lines (run_id, employee_id, basic_salary, allowances, gross, statutory_deductions, net)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [runId, e.id, basic, allowances, gross, statutory, net],
        );
      }
      await client.query(
        'update payroll_runs set total_gross=$1, total_deductions=$2, total_net=$3 where id = $4',
        [round2(totalGross), round2(totalDeductions), round2(totalNet), runId],
      );
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'GENERATE_PAYROLL', entity: 'payroll_runs', entity_id: runId, details: { run_no: runNo, period: `${start}..${end}`, net: round2(totalNet) } });
      return { ...inserted.rows[0], total_gross: round2(totalGross), total_deductions: round2(totalDeductions), total_net: round2(totalNet) };
    });
    ok(res, { item: result }, 201);
  }),
);

router.post(
  '/runs/:id/post',
  requireRole('accountant', 'admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const run = await client.query('select * from payroll_runs where id = $1 and company_id = $2 for update', [id, req.user!.companyId]);
      if (!run.rows[0]) throw new AppError(404, 'Payroll run not found');
      if (run.rows[0].status !== 'draft') throw new AppError(409, 'Payroll run already posted');

      const lines = await client.query('select * from payroll_lines where run_id = $1', [id]);
      const basicTotal = round2(lines.rows.reduce((s, l) => s + Number(l.basic_salary), 0));
      const allowTotal = round2(lines.rows.reduce((s, l) => s + Number(l.allowances), 0));
      const netTotal = round2(lines.rows.reduce((s, l) => s + Number(l.net), 0));
      const statTotal = round2(lines.rows.reduce((s, l) => s + Number(l.statutory_deductions), 0));

      const entryNoRes = await client.query(`select 'GL-'||extract(year from now())||'-'||lpad((coalesce(max(substring(entry_no from '([0-9]+)$')::int),0)+1)::text,5,'0') as no from journal_entries`);
      const salAcct = (await client.query(`select id from chart_of_accounts where company_id = $1 and code = '6010'`, [req.user!.companyId])).rows[0]?.id;
      const allowAcct = (await client.query(`select id from chart_of_accounts where company_id = $1 and code = '6020'`, [req.user!.companyId])).rows[0]?.id;
      const accruedAcct = (await client.query(`select id from chart_of_accounts where company_id = $1 and code = '2200'`, [req.user!.companyId])).rows[0]?.id;
      const statAcct = (await client.query(`select id from chart_of_accounts where company_id = $1 and code = '2400'`, [req.user!.companyId])).rows[0]?.id;
      const total = round2(basicTotal + allowTotal);
      const date = req.body.date || new Date().toISOString().slice(0, 10);

      const entry = await client.query(
        `insert into journal_entries (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by)
         values ($1,$2,$3,'payroll',$4,$5,'posted','not_required',$6,$6,$7) returning id`,
        [req.user!.companyId, entryNoRes.rows[0].no, date, `PAY-${run.rows[0].run_no}`, `Payroll posting - ${run.rows[0].run_no}`, total, req.user!.id],
      );
      const ins = (acc: string | undefined, desc: string, d: number, c: number) =>
        client.query('insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,$4,$5)', [entry.rows[0].id, acc, desc, round2(d), round2(c)]);
      await ins(salAcct, 'Basic salaries', basicTotal, 0);
      await ins(allowAcct, 'Allowances', allowTotal, 0);
      await ins(accruedAcct, 'Net pay accrual', 0, netTotal);
      await ins(statAcct, 'Statutory deductions', 0, statTotal);

      const updated = await client.query(
        `update payroll_runs set status='posted', updated_at=now() where id = $1 returning *`,
        [id],
      );
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'POST_PAYROLL', entity: 'payroll_runs', entity_id: id, details: { run_no: run.rows[0].run_no, gross: total, net: netTotal } });
      return updated.rows[0];
    });
    ok(res, { item: result });
  }),
);

export default router;
