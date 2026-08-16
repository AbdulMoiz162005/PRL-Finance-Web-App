import { Router } from 'express';
import { transact, pool } from '../db';
import { asyncHandler, ok, AppError, audit, round2 } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { parseId } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : null;
    const params: unknown[] = [req.user!.companyId];
    let where = 'where b.company_id = $1';
    if (year) { params.push(year); where += ` and b.fiscal_year = $${params.length}`; }
    const result = await pool.query(
      `select b.*, u.name as created_by_name,
              (select coalesce(sum(amount),0) from budget_items bi where bi.budget_id = b.id) as total_budget
       from budgets b left join users u on u.id = b.created_by ${where} order by b.fiscal_year desc, b.name`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const budget = await pool.query('select * from budgets where id = $1 and company_id = $2', [id, req.user!.companyId]);
    if (!budget.rows[0]) throw new AppError(404, 'Budget not found');
    const items = await pool.query(
      `select bi.*, a.code as account_code, a.name as account_name, a.type,
              cc.code as cc_code, cc.name as cc_name
       from budget_items bi
       left join chart_of_accounts a on a.id = bi.account_id
       left join cost_centers cc on cc.id = bi.cost_center_id
       where bi.budget_id = $1 order by a.code, bi.month`,
      [id],
    );
    ok(res, { item: budget.rows[0], items: items.rows });
  }),
);

router.post(
  '/',
  requireRole('admin', 'director', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await transact(async (client) => {
      const year = parseInt(String(req.body.fiscal_year), 10);
      if (!year) throw new AppError(422, 'fiscal_year is required');
      const items = req.body.items || [];
      if (!Array.isArray(items) || !items.length) throw new AppError(422, 'At least one budget item is required');

      const inserted = await client.query(
        `insert into budgets (company_id, fiscal_year, name, status, created_by)
         values ($1,$2,$3,'draft',$4) returning *`,
        [req.user!.companyId, year, req.body.name || `Budget ${year}`, req.user!.id],
      );
      for (const it of items) {
        const month = parseInt(String(it.month), 10);
        if (month < 1 || month > 12) throw new AppError(422, 'month must be 1-12');
        await client.query(
          `insert into budget_items (budget_id, account_id, cost_center_id, month, amount)
           values ($1,$2,$3,$4,$5)`,
          [inserted.rows[0].id, it.account_id, it.cost_center_id ?? null, month, round2(Number(it.amount || 0))],
        );
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE_BUDGET', entity: 'budgets', entity_id: inserted.rows[0].id, details: { fiscal_year: year } });
      return inserted.rows[0];
    });
    ok(res, { item: result }, 201);
  }),
);

router.post(
  '/:id/finalize',
  requireRole('admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query(
      `update budgets set status='final' where id = $1 and company_id = $2 returning *`,
      [id, req.user!.companyId],
    );
    if (!result.rows[0]) throw new AppError(404, 'Budget not found');
    ok(res, { item: result.rows[0] });
  }),
);

export default router;
