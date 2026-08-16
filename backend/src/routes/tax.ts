import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok, AppError, audit, round2 } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { parseId } from '../middleware/validate';

const router = Router();
router.use(requireAuth, requireRole('accountant', 'admin', 'director'));

router.get(
  '/returns',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select t.*, u.name as created_by_name from tax_returns t
       left join users u on u.id = t.created_by
       where t.company_id = $1 order by t.period_end desc`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/summary',
  asyncHandler(async (req: AuthRequest, res) => {
    const from = req.query.from || `${new Date().getFullYear()}-01-01`;
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const params: unknown[] = [req.user!.companyId, from, to];
    const output = await pool.query(
      `select coalesce(sum(tax_amount),0) as output_tax from invoices
       where company_id = $1 and status <> 'void' and invoice_date >= $2::date and invoice_date <= $3::date`,
      params,
    );
    const input = await pool.query(
      `select coalesce(sum(tax_amount),0) as input_tax from purchase_invoices
       where company_id = $1 and status <> 'void' and bill_date >= $2::date and bill_date <= $3::date`,
      params,
    );
    const wht = await pool.query(
      `select coalesce(sum(credit),0) as wht from journal_entry_lines l
       join journal_entries je on je.id = l.entry_id
       join chart_of_accounts a on a.id = l.account_id
       where je.company_id = $1 and je.status='posted' and a.code='2400'
         and je.entry_date >= $2::date and je.entry_date <= $3::date`,
      params,
    );
    ok(res, {
      from,
      to,
      output_tax: round2(Number(output.rows[0].output_tax)),
      input_tax: round2(Number(input.rows[0].input_tax)),
      net_payable: round2(Number(output.rows[0].output_tax) - Number(input.rows[0].input_tax)),
      withholding: round2(Number(wht.rows[0].wht)),
    });
  }),
);

router.post(
  '/returns/generate',
  asyncHandler(async (req: AuthRequest, res) => {
    const from = req.body.period_start;
    const to = req.body.period_end;
    const type = req.body.type || 'vat';
    if (!from || !to) throw new AppError(422, 'period_start and period_end are required');

    const output = await pool.query(
      `select coalesce(sum(tax_amount),0) as v from invoices
       where company_id = $1 and status <> 'void' and invoice_date >= $2::date and invoice_date <= $3::date`,
      [req.user!.companyId, from, to],
    );
    const input = await pool.query(
      `select coalesce(sum(tax_amount),0) as v from purchase_invoices
       where company_id = $1 and status <> 'void' and bill_date >= $2::date and bill_date <= $3::date`,
      [req.user!.companyId, from, to],
    );
    const outputTax = round2(Number(output.rows[0].v));
    const inputTax = round2(Number(input.rows[0].v));
    const net = round2(outputTax - inputTax);

    const result = await pool.query(
      `insert into tax_returns (company_id, type, period_start, period_end, output_tax, input_tax, net_payable, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [req.user!.companyId, type, from, to, outputTax, inputTax, net, req.user!.id],
    );
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'GENERATE_TAX_RETURN', entity: 'tax_returns', entity_id: result.rows[0].id, details: { type, from, to, net } });
    ok(res, { item: result.rows[0] }, 201);
  }),
);

router.post(
  '/returns/:id/file',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query(
      `update tax_returns set status='filed' where id = $1 and company_id = $2 returning *`,
      [id, req.user!.companyId],
    );
    if (!result.rows[0]) throw new AppError(404, 'Tax return not found');
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'FILE_TAX_RETURN', entity: 'tax_returns', entity_id: id });
    ok(res, { item: result.rows[0] });
  }),
);

export default router;
