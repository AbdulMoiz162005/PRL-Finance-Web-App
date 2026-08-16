import { Router } from 'express';
import { transact, pool } from '../db';
import { asyncHandler, ok, AppError, audit, round2 } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { parseId } from '../middleware/validate';
import { makeCrud } from './crud';

const router = Router();
router.use(requireAuth);

router.use(
  '/',
  makeCrud({
    table: 'assets',
    searchFields: ['code', 'name', 'category'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'category', 'location', 'purchase_date', 'cost', 'salvage_value', 'useful_life_months', 'depreciation_method', 'accumulated_depreciation', 'status', 'notes'],
    updateFields: ['code', 'name', 'category', 'location', 'purchase_date', 'cost', 'salvage_value', 'useful_life_months', 'depreciation_method', 'accumulated_depreciation', 'status', 'notes'],
    writeRoles: ['admin', 'accountant'],
  }),
);

router.get(
  '/schedule',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select id, code, name, category, location, purchase_date, cost, salvage_value, useful_life_months,
              depreciation_method, accumulated_depreciation, status,
              round((cost - salvage_value) / nullif(useful_life_months, 0), 2) as monthly_depreciation,
              round(cost - accumulated_depreciation, 2) as net_book_value,
              case when cost - salvage_value = 0 then 0
                   else round(accumulated_depreciation * useful_life_months / nullif(cost - salvage_value, 0), 0)
              end as months_elapsed
       from assets where company_id = $1 order by code`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

router.post(
  '/:id/depreciate',
  requireRole('accountant', 'admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const months = Math.max(parseInt(String(req.body.months || '1'), 10), 1);
    const result = await transact(async (client) => {
      const asset = await client.query('select * from assets where id = $1 and company_id = $2 for update', [id, req.user!.companyId]);
      if (!asset.rows[0]) throw new AppError(404, 'Asset not found');
      const a = asset.rows[0];
      if (a.status !== 'active') throw new AppError(409, 'Only active assets can be depreciated');
      const monthly = round2((Number(a.cost) - Number(a.salvage_value)) / Number(a.useful_life_months));
      const amount = round2(monthly * months);
      if (amount <= 0) throw new AppError(409, 'Asset is fully depreciated');

      const entryNoRes = await client.query(`select 'GL-'||extract(year from now())||'-'||lpad((coalesce(max(substring(entry_no from '([0-9]+)$')::int),0)+1)::text,5,'0') as no from journal_entries`);
      const depAccount = (await client.query(`select id from chart_of_accounts where company_id = $1 and code = '6100'`, [req.user!.companyId])).rows[0]?.id;
      const accDepAccount = (await client.query(`select id from chart_of_accounts where company_id = $1 and code = '1420'`, [req.user!.companyId])).rows[0]?.id;
      const date = req.body.date || new Date().toISOString().slice(0, 10);

      const entry = await client.query(
        `insert into journal_entries (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by)
         values ($1,$2,$3,'depreciation',$4,$5,'posted','not_required',$6,$6,$7) returning id`,
        [req.user!.companyId, entryNoRes.rows[0].no, date, `DEP-${a.code}`, `Depreciation ${months} month(s) - ${a.name}`, amount, req.user!.id],
      );
      await client.query(
        'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,$4,0)',
        [entry.rows[0].id, depAccount, `Depreciation - ${a.name}`, amount],
      );
      await client.query(
        'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,0,$4)',
        [entry.rows[0].id, accDepAccount, `Accumulated depreciation - ${a.name}`, amount],
      );

      const updated = await client.query(
        `update assets set accumulated_depreciation = round(accumulated_depreciation + $1, 2), updated_at = now()
         where id = $2 returning *`,
        [amount, id],
      );
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'DEPRECIATE_ASSET', entity: 'assets', entity_id: id, details: { months, amount } });
      return updated.rows[0];
    });
    ok(res, { item: result });
  }),
);

export default router;
