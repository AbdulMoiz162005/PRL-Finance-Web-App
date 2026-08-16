import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok, AppError, audit, round2 } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { parseId } from '../middleware/validate';

const router = Router();
router.use(requireAuth, requireRole('accountant', 'admin', 'director'));

const bookBalance = async (companyId: string, coaId: string, asOf: string): Promise<number> => {
  const acct = await pool.query(
    'select opening_balance, normal_balance from chart_of_accounts where id = $1 and company_id = $2',
    [coaId, companyId],
  );
  if (!acct.rows[0]) return 0;
  const { opening_balance, normal_balance } = acct.rows[0];
  const mov = await pool.query(
    `select coalesce(sum(debit),0) as d, coalesce(sum(credit),0) as c
     from journal_entry_lines l
     join journal_entries je on je.id = l.entry_id
     where l.account_id = $1 and je.status='posted' and je.entry_date <= $2::date`,
    [coaId, asOf],
  );
  const d = Number(mov.rows[0].d);
  const c = Number(mov.rows[0].c);
  const balance = normal_balance === 'debit' ? Number(opening_balance) + d - c : Number(opening_balance) + c - d;
  return round2(balance);
};

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select r.*, ba.name as bank_account_name, ba.coa_id, u.name as created_by_name
       from bank_reconciliations r
       left join bank_accounts ba on ba.id = r.bank_account_id
       left join users u on u.id = r.created_by
       where r.company_id = $1 order by r.period_end desc`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { bank_account_id, period_end, statement_balance, notes } = req.body;
    if (!bank_account_id || !period_end) throw new AppError(422, 'bank_account_id and period_end are required');
    const bank = await pool.query('select * from bank_accounts where id = $1 and company_id = $2', [bank_account_id, req.user!.companyId]);
    if (!bank.rows[0]) throw new AppError(404, 'Bank account not found');
    const book = await bookBalance(req.user!.companyId, bank.rows[0].coa_id, period_end);
    const statement = round2(Number(statement_balance || 0));
    const diff = round2(statement - book);
    const result = await pool.query(
      `insert into bank_reconciliations (company_id, bank_account_id, period_end, statement_balance, book_balance, difference, notes, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [req.user!.companyId, bank_account_id, period_end, statement, book, diff, notes ?? null, req.user!.id],
    );
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE_RECONCILIATION', entity: 'bank_reconciliations', entity_id: result.rows[0].id, details: { bank: bank.rows[0].name, period_end, statement, book, diff } });
    ok(res, { item: result.rows[0] }, 201);
  }),
);

router.post(
  '/:id/close',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query(
      `update bank_reconciliations set status='reconciled' where id = $1 and company_id = $2 returning *`,
      [id, req.user!.companyId],
    );
    if (!result.rows[0]) throw new AppError(404, 'Reconciliation not found');
    ok(res, { item: result.rows[0] });
  }),
);

export default router;
