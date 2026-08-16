import { Router } from 'express';
import { transact, pool } from '../db';
import { asyncHandler, ok, AppError, audit, nextEntryNo, round2 } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { validateBody, parseId } from '../middleware/validate';
import { parseSearch, parseDateRange } from './parse';

const router = Router();
router.use(requireAuth);

const getAccountId = async (companyId: string, code: string) => {
  const res = await pool.query('select id from chart_of_accounts where company_id = $1 and code = $2', [companyId, code]);
  return res.rows[0]?.id ?? null;
};

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const { from, to } = parseDateRange(req);
    const type = req.query.type ? String(req.query.type) : null;
    const params: unknown[] = [req.user!.companyId];
    const conds: string[] = ['p.company_id = $1'];
    let n = 1;
    if (search) { n += 1; params.push(search); conds.push(`(p.payment_no ilike '%'||$${n}||'%' or p.reference ilike '%'||$${n}||'%')`); }
    if (from) { n += 1; params.push(from); conds.push(`p.payment_date >= $${n}::date`); }
    if (to) { n += 1; params.push(to); conds.push(`p.payment_date <= $${n}::date`); }
    if (type) { n += 1; params.push(type); conds.push(`p.type = $${n}`); }
    const where = conds.length ? `where ${conds.join(' and ')}` : '';
    const result = await pool.query(
      `select p.*, ba.name as bank_name,
              case when p.party_type='customer' then (select name from customers c where c.id = p.party_id)
                   when p.party_type='supplier' then (select name from suppliers s where s.id = p.party_id)
              end as party_name,
              i.invoice_no, pi.bill_no
       from payments p
       left join bank_accounts ba on ba.id = p.bank_account_id
       left join invoices i on i.id = p.invoice_id
       left join purchase_invoices pi on pi.id = p.purchase_invoice_id
       ${where} order by p.payment_date desc, p.payment_no desc limit 500`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query('select * from payments where id = $1 and company_id = $2', [id, req.user!.companyId]);
    if (!result.rows[0]) throw new AppError(404, 'Payment not found');
    ok(res, { item: result.rows[0] });
  }),
);

router.post(
  '/',
  requireRole('accountant', 'admin', 'director'),
  validateBody([
    { key: 'payment_date', required: true, type: 'string' },
    { key: 'type', required: true, type: 'string' },
    { key: 'amount', required: true },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const item = await transact(async (client) => {
      const amount = round2(Number(req.body.amount));
      if (amount <= 0) throw new AppError(422, 'Amount must be greater than zero');
      const type = req.body.type; // incoming | outgoing

      const bankAccount = req.body.bank_account_id
        ? (await client.query('select * from bank_accounts where id = $1 and company_id = $2', [req.body.bank_account_id, req.user!.companyId])).rows[0]
        : null;
      if (!bankAccount) throw new AppError(422, 'A valid bank account is required');

      const arAccount = await getAccountId(req.user!.companyId, '1200');
      const apAccount = await getAccountId(req.user!.companyId, '2100');
      const paymentNo = await nextEntryNo('PMT-', 'payments', 'payment_no');

      const inserted = await client.query(
        `insert into payments (company_id, payment_no, payment_date, type, party_type, party_id, invoice_id, purchase_invoice_id, bank_account_id, amount, method, reference, notes, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
        [
          req.user!.companyId, paymentNo, req.body.payment_date, type,
          req.body.party_type ?? (type === 'incoming' ? 'customer' : 'supplier'),
          req.body.party_id ?? null,
          type === 'incoming' ? (req.body.invoice_id ?? null) : null,
          type === 'outgoing' ? (req.body.purchase_invoice_id ?? null) : null,
          bankAccount.id, amount, req.body.method || 'bank_transfer',
          req.body.reference ?? null, req.body.notes ?? null, req.user!.id,
        ],
      );
      const payment = inserted.rows[0];

      const entryNo = await nextEntryNo('GL-', 'journal_entries', 'entry_no');
      const entry = await client.query(
        `insert into journal_entries (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by)
         values ($1,$2,$3,$4,$5,$6,'posted','not_required',$7,$7,$8) returning id`,
        [req.user!.companyId, entryNo, req.body.payment_date, type === 'incoming' ? 'receipt' : 'payment', paymentNo, `${type === 'incoming' ? 'Receipt' : 'Payment'} ${paymentNo}`, amount, req.user!.id],
      );

      if (type === 'incoming') {
        await client.query(
          'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,$4,0)',
          [entry.rows[0].id, bankAccount.coa_id, `Receipt ${paymentNo}`, amount],
        );
        await client.query(
          'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,0,$4)',
          [entry.rows[0].id, arAccount, `Customer payment ${paymentNo}`, amount],
        );
        if (payment.invoice_id) {
          const inv = await client.query('select * from invoices where id = $1 for update', [payment.invoice_id]);
          const updatedPaid = round2(Number(inv.rows[0].amount_paid) + amount);
          const status = updatedPaid >= Number(inv.rows[0].total) ? 'paid' : 'partially_paid';
          await client.query('update invoices set amount_paid = $1, status = $2, updated_at = now() where id = $3', [updatedPaid, status, payment.invoice_id]);
        }
      } else {
        await client.query(
          'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,0,$4)',
          [entry.rows[0].id, bankAccount.coa_id, `Payment ${paymentNo}`, amount],
        );
        await client.query(
          'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,$4,0)',
          [entry.rows[0].id, apAccount, `Supplier payment ${paymentNo}`, amount],
        );
        if (payment.purchase_invoice_id) {
          const inv = await client.query('select * from purchase_invoices where id = $1 for update', [payment.purchase_invoice_id]);
          const updatedPaid = round2(Number(inv.rows[0].amount_paid) + amount);
          const status = updatedPaid >= Number(inv.rows[0].total) ? 'paid' : 'partially_paid';
          await client.query('update purchase_invoices set amount_paid = $1, status = $2, updated_at = now() where id = $3', [updatedPaid, status, payment.purchase_invoice_id]);
        }
      }

      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: type === 'incoming' ? 'RECORD_RECEIPT' : 'RECORD_PAYMENT', entity: 'payments', entity_id: payment.id, details: { payment_no: paymentNo, amount } });
      return payment;
    });
    ok(res, { item }, 201);
  }),
);

export default router;
