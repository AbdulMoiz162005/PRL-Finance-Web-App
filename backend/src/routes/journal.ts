import { Router } from 'express';
import { PoolClient } from 'pg';
import { pool, transact } from '../db';
import { asyncHandler, ok, AppError, audit, nextEntryNo, clampNumber, log } from '../utils';
import { config } from '../config';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { validateBody, parseId } from '../middleware/validate';
import { parseSearch, parseDateRange } from './parse';

const router = Router();

router.use(requireAuth);

const round2 = (n: number) => Math.round(n * 100) / 100;

export const findApprovalRule = async (companyId: string, amount: number) => {
  const res = await pool.query(
    `select * from approval_rules where company_id = $1 and is_active
       and min_amount <= $2 and (max_amount is null or $2 < max_amount)
     order by min_amount desc limit 1`,
    [companyId, amount],
  );
  return res.rows[0] ?? null;
};

export const requiresApproval = async (companyId: string, amount: number): Promise<boolean> => {
  if (amount < config.approvalThreshold) return false;
  const rule = await findApprovalRule(companyId, amount);
  return !!rule;
};

export const createApprovalRequest = async (
  client: PoolClient,
  companyId: string,
  entityType: string,
  entityId: string,
  entityNo: string,
  amount: number,
  requestedBy: string,
) => {
  await client.query(
    `insert into approval_requests (company_id, entity_type, entity_id, entity_no, amount, requested_by)
     values ($1,$2,$3,$4,$5,$6)`,
    [companyId, entityType, entityId, entityNo, amount, requestedBy],
  );
};

interface Line {
  account_id: string;
  cost_center_id?: string | null;
  description?: string;
  debit?: number;
  credit?: number;
}

const validateLines = async (lines: Line[], companyId: string) => {
  if (!Array.isArray(lines) || lines.length < 2) throw new AppError(422, 'A journal entry requires at least two lines');
  const ids = [...new Set(lines.map((l) => l.account_id))];
  const acctRes = await pool.query(
    `select id, code, name, type, is_postable, is_active from chart_of_accounts
     where company_id = $1 and id = any($2::uuid[])`,
    [companyId, ids],
  );
  const acctMap = new Map(acctRes.rows.map((r) => [r.id, r]));
  let totalDebit = 0;
  let totalCredit = 0;
  const normalized = lines.map((l) => {
    if (!l.account_id || !acctMap.has(l.account_id)) throw new AppError(422, `Invalid account: ${l.account_id}`);
    const acct = acctMap.get(l.account_id);
    if (!acct.is_postable) throw new AppError(422, `Account ${acct.code} ${acct.name} is a header account and cannot be posted to`);
    if (!acct.is_active) throw new AppError(422, `Account ${acct.code} ${acct.name} is inactive`);
    const debit = round2(clampNumber(l.debit));
    const credit = round2(clampNumber(l.credit));
    if (debit < 0 || credit < 0) throw new AppError(422, 'Debit/credit amounts cannot be negative');
    if (debit > 0 && credit > 0) throw new AppError(422, 'A line cannot have both debit and credit');
    if (debit === 0 && credit === 0) throw new AppError(422, 'A line must have a non-zero amount');
    totalDebit += debit;
    totalCredit += credit;
    return { ...l, debit, credit };
  });
  if (Math.abs(totalDebit - totalCredit) > 0.01) throw new AppError(422, `Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})`);
  if (totalDebit <= 0) throw new AppError(422, 'Entry total must be greater than zero');
  return { normalized, totalDebit: round2(totalDebit), totalCredit: round2(totalCredit) };
};

// ---------------------------------------------------------------------------

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const { from, to } = parseDateRange(req);
    const status = req.query.status ? String(req.query.status) : null;
    const accountId = req.query.account ? String(req.query.account) : null;
    const approval = req.query.approval ? String(req.query.approval) : null;

    const params: unknown[] = [req.user!.companyId];
    const conds: string[] = ['je.company_id = $1'];
    let n = 1;
    if (search) { n += 1; params.push(search); conds.push(`(je.entry_no ilike '%'||$${n}||'%' or je.description ilike '%'||$${n}||'%' or je.reference ilike '%'||$${n}||'%')`); }
    if (from) { n += 1; params.push(from); conds.push(`je.entry_date >= $${n}::date`); }
    if (to) { n += 1; params.push(to); conds.push(`je.entry_date <= $${n}::date`); }
    if (status) { n += 1; params.push(status); conds.push(`je.status = $${n}`); }
    if (approval) { n += 1; params.push(approval); conds.push(`je.approval_status = $${n}`); }
    if (accountId) { n += 1; params.push(accountId); conds.push(`exists (select 1 from journal_entry_lines l where l.entry_id = je.id and l.account_id = $${n})`); }
    const where = conds.length ? `where ${conds.join(' and ')}` : '';

    const result = await pool.query(
      `select je.*, u.name as created_by_name,
              (select count(*) from journal_entry_lines l where l.entry_id = je.id) as line_count
       from journal_entries je
       left join users u on u.id = je.created_by
       ${where} order by je.entry_date desc, je.entry_no desc limit 500`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const entry = await pool.query(
      `select je.*, u.name as created_by_name, p.name as posted_by_name, ap.name as approved_by_name
       from journal_entries je
       left join users u on u.id = je.created_by
       left join users p on p.id = je.posted_by
       left join users ap on ap.id = je.approved_by
       where je.id = $1 and je.company_id = $2`,
      [id, req.user!.companyId],
    );
    if (!entry.rows[0]) throw new AppError(404, 'Journal entry not found');
    const lines = await pool.query(
      `select l.*, a.code as account_code, a.name as account_name, cc.code as cc_code, cc.name as cc_name
       from journal_entry_lines l
       left join chart_of_accounts a on a.id = l.account_id
       left join cost_centers cc on cc.id = l.cost_center_id
       where l.entry_id = $1 order by l.created_at`,
      [id],
    );
    ok(res, { item: entry.rows[0], lines: lines.rows });
  }),
);

router.post(
  '/',
  requireRole('accountant', 'admin', 'director'),
  validateBody([
    { key: 'entry_date', required: true, type: 'string' },
    { key: 'lines', required: true },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const entry = await transact(async (client) => {
      const { normalized, totalDebit } = await validateLines(req.body.lines, req.user!.companyId);
      const entryNo = await nextEntryNo('GL-', 'journal_entries', 'entry_no');
      const needsApproval = await requiresApproval(req.user!.companyId, totalDebit);
      const approvalStatus = needsApproval ? 'pending' : 'not_required';

      const inserted = await client.query(
        `insert into journal_entries
           (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by)
         values ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$8,$9) returning *`,
        [
          req.user!.companyId, entryNo, req.body.entry_date, req.body.type || 'general',
          req.body.reference ?? null, req.body.description ?? null, approvalStatus, totalDebit, req.user!.id,
        ],
      );
      const entryId = inserted.rows[0].id;
      for (const l of normalized) {
        await client.query(
          `insert into journal_entry_lines (entry_id, account_id, cost_center_id, description, debit, credit)
           values ($1,$2,$3,$4,$5,$6)`,
          [entryId, l.account_id, l.cost_center_id ?? null, l.description ?? null, l.debit, l.credit],
        );
      }
      if (needsApproval) {
        await createApprovalRequest(client, req.user!.companyId, 'journal', entryId, entryNo, totalDebit, req.user!.id);
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE_ENTRY', entity: 'journal_entries', entity_id: entryId, details: { entry_no: entryNo, amount: totalDebit, approval: approvalStatus } });
      return { id: entryId, entry_no: entryNo, approval_status: approvalStatus, total: totalDebit };
    });
    ok(res, { item: entry }, 201);
  }),
);

router.post(
  '/:id/post',
  requireRole('accountant', 'admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const entry = await client.query(
        'select * from journal_entries where id = $1 and company_id = $2 for update',
        [id, req.user!.companyId],
      );
      if (!entry.rows[0]) throw new AppError(404, 'Journal entry not found');
      const je = entry.rows[0];
      if (je.status !== 'draft') throw new AppError(409, `Cannot post an entry with status '${je.status}'`);
      if (je.approval_status === 'pending') throw new AppError(409, 'Entry requires approval before posting');
      if (je.approval_status === 'rejected') throw new AppError(409, 'Entry was rejected. Amend and save a new entry.');

      const updated = await client.query(
        `update journal_entries set status = 'posted', posted_by = $1, posted_at = now(), updated_at = now()
         where id = $2 returning *`,
        [req.user!.id, id],
      );
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'POST_ENTRY', entity: 'journal_entries', entity_id: id, details: { entry_no: je.entry_no } });
      return updated.rows[0];
    });
    ok(res, { item: result });
  }),
);

router.post(
  '/:id/reverse',
  requireRole('accountant', 'admin', 'director'),
  validateBody([{ key: 'reason', required: true, type: 'string' }]),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const entry = await client.query(
        'select * from journal_entries where id = $1 and company_id = $2 for update',
        [id, req.user!.companyId],
      );
      if (!entry.rows[0]) throw new AppError(404, 'Journal entry not found');
      const je = entry.rows[0];
      if (je.status !== 'posted') throw new AppError(409, 'Only posted entries can be reversed');

      const entryNo = await nextEntryNo('GL-', 'journal_entries', 'entry_no');
      const reversed = await client.query(
        `insert into journal_entries
           (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by, reversal_reason, reversed_entry_id)
         values ($1,$2,$3,'reversal', $4, $5, 'posted','not_required',$6,$6,$7,$8,$9) returning *`,
        [
          req.user!.companyId, entryNo, new Date().toISOString().slice(0, 10),
          `Reversal of ${je.entry_no}`, `Reversal - ${req.body.reason}`,
          je.total_debit, req.user!.id, req.body.reason, id,
        ],
      );
      const lines = await client.query('select * from journal_entry_lines where entry_id = $1', [id]);
      for (const l of lines.rows) {
        await client.query(
          `insert into journal_entry_lines (entry_id, account_id, cost_center_id, description, debit, credit)
           values ($1,$2,$3,$4,$5,$6)`,
          [reversed.rows[0].id, l.account_id, l.cost_center_id, `Reversal: ${l.description ?? je.entry_no}`, l.credit, l.debit],
        );
      }
      await client.query(
        `update journal_entries set status = 'reversed', reversal_reason = $1, updated_at = now() where id = $2`,
        [req.body.reason, id],
      );
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'REVERSE_ENTRY', entity: 'journal_entries', entity_id: id, details: { reason: req.body.reason, reversal_entry: entryNo } });
      return { reversal: reversed.rows[0] };
    });
    ok(res, { item: result });
  }),
);

router.delete(
  '/:id',
  requireRole('accountant', 'admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const deleted = await transact(async (client) => {
      const entry = await client.query('select * from journal_entries where id = $1 and company_id = $2', [id, req.user!.companyId]);
      if (!entry.rows[0]) throw new AppError(404, 'Journal entry not found');
      if (entry.rows[0].status !== 'draft') throw new AppError(409, 'Only draft entries can be deleted');
      await client.query('delete from approval_requests where entity_type = $1 and entity_id = $2', ['journal', id]);
      await client.query('delete from journal_entry_lines where entry_id = $1', [id]);
      await client.query('delete from journal_entries where id = $1', [id]);
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'DELETE_ENTRY', entity: 'journal_entries', entity_id: id });
      return true;
    });
    ok(res, { message: 'Entry deleted' });
  }),
);

export default router;
export { round2 };
