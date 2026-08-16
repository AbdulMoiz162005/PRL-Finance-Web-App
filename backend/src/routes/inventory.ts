import { Router } from 'express';
import { transact, pool } from '../db';
import { asyncHandler, ok, AppError, audit, round2 } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { validateBody, parseId } from '../middleware/validate';
import { parseSearch, parseDateRange } from './parse';

const router = Router();
router.use(requireAuth);

const INVENTORY_ACCOUNT = '00001300-0000-4000-8000-000000000000';
const ADJUSTMENT_ACCOUNT = '00006180-0000-4000-8000-000000000000';

const getAccountId = async (companyId: string, code: string) => {
  const res = await pool.query('select id from chart_of_accounts where company_id = $1 and code = $2', [companyId, code]);
  return res.rows[0]?.id ?? null;
};

router.get(
  '/transactions',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const { from, to } = parseDateRange(req);
    const type = req.query.type ? String(req.query.type) : null;
    const productId = req.query.product ? String(req.query.product) : null;
    const params: unknown[] = [req.user!.companyId];
    const conds: string[] = ['it.company_id = $1'];
    let n = 1;
    if (search) { n += 1; params.push(search); conds.push(`(p.code ilike '%'||$${n}||'%' or p.name ilike '%'||$${n}||'%' or it.notes ilike '%'||$${n}||'%')`); }
    if (from) { n += 1; params.push(from); conds.push(`it.trx_date >= $${n}::date`); }
    if (to) { n += 1; params.push(to); conds.push(`it.trx_date <= $${n}::date`); }
    if (type) { n += 1; params.push(type); conds.push(`it.type = $${n}`); }
    if (productId) { n += 1; params.push(productId); conds.push(`it.product_id = $${n}`); }
    const where = conds.length ? `where ${conds.join(' and ')}` : '';
    const result = await pool.query(
      `select it.*, p.code as product_code, p.name as product_name, p.unit, s.code as storage_code, s.name as storage_name, u.name as created_by_name
       from inventory_transactions it
       left join products p on p.id = it.product_id
       left join storages s on s.id = it.storage_id
       left join users u on u.id = it.created_by
       ${where} order by it.trx_date desc, it.created_at desc limit 500`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/stock',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select p.id as product_id, p.code, p.name, p.category, p.unit, p.valuation_method,
              coalesce(sum(case when it.quantity > 0 then it.quantity else 0 end), 0) as total_in,
              coalesce(sum(case when it.quantity < 0 then it.quantity else 0 end), 0) as total_out,
              coalesce(sum(it.quantity), 0) as current_qty,
              case when coalesce(sum(case when it.quantity > 0 then it.quantity else 0 end), 0) > 0
                   then coalesce(sum(it.total_value), 0) / sum(case when it.quantity > 0 then it.quantity else 0 end)
                   else 0 end as avg_cost
       from products p
       left join inventory_transactions it on it.product_id = p.id and it.company_id = $1
       where p.company_id = $1 and p.is_active
       group by p.id
       order by p.code`,
      [req.user!.companyId],
    );
    const items = result.rows.map((r) => ({
      ...r,
      current_qty: Number(r.current_qty),
      total_in: Number(r.total_in),
      total_out: Number(r.total_out),
      avg_cost: Number(r.avg_cost),
      stock_value: round2(Number(r.current_qty) * Number(r.avg_cost)),
    }));
    ok(res, { items });
  }),
);

router.post(
  '/transactions',
  requireRole('accountant', 'admin', 'manager'),
  validateBody([
    { key: 'product_id', required: true, type: 'string' },
    { key: 'type', required: true, type: 'string' },
    { key: 'quantity', required: true },
    { key: 'trx_date', required: true, type: 'string' },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const item = await transact(async (client) => {
      const type = req.body.type;
      const allowed = ['receipt', 'issue', 'adjustment'];
      if (!allowed.includes(type)) throw new AppError(422, `Type must be one of ${allowed.join(', ')}`);
      const qty = Number(req.body.quantity);
      if (!Number.isFinite(qty) || qty === 0) throw new AppError(422, 'Quantity must be a non-zero number');

      const product = await client.query('select * from products where id = $1 and company_id = $2', [req.body.product_id, req.user!.companyId]);
      if (!product.rows[0]) throw new AppError(404, 'Product not found');
      if (product.rows[0].category === 'service') throw new AppError(422, 'Service products cannot have stock movements');

      const stock = await client.query(
        `select coalesce(sum(quantity),0) as qty, coalesce(sum(case when quantity>0 then total_value else 0 end),0) as val_in
         from inventory_transactions where product_id = $1`,
        [req.body.product_id],
      );
      const current = Number(stock.rows[0].qty);
      const signedQty = type === 'issue' ? -Math.abs(qty) : Math.abs(qty);
      if (type === 'issue' && current + signedQty < 0) throw new AppError(409, `Insufficient stock. Current: ${current}`);
      const inQty = Number(stock.rows[0].val_in) > 0 && current > 0 ? Number(stock.rows[0].val_in) / current : 0;
      const cost = req.body.unit_cost ? Number(req.body.unit_cost) : (type === 'receipt' ? inQty : (inQty || Number(req.body.unit_cost || 0)));

      const inserted = await client.query(
        `insert into inventory_transactions (company_id, product_id, storage_id, type, quantity, unit_cost, total_value, reference_type, trx_date, notes, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
        [
          req.user!.companyId, product.rows[0].id, req.body.storage_id ?? null, type,
          signedQty, cost, round2(Math.abs(signedQty) * cost),
          req.body.reference_type ?? null, req.body.trx_date, req.body.notes ?? null, req.user!.id,
        ],
      );

      // Post matching GL for stock adjustments / receipts / issues not tied to invoices
      const inventoryAccount = product.rows[0].inventory_account_id || (await getAccountId(req.user!.companyId, '1300'));
      const glAmount = round2(Math.abs(signedQty) * cost);
      if (glAmount > 0) {
        const entryNoRes = await client.query(`select 'GL-'||extract(year from now())||'-'||lpad((coalesce(max(substring(entry_no from '([0-9]+)$')::int),0)+1)::text,5,'0') as no from journal_entries`);
        const entry = await client.query(
          `insert into journal_entries (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by)
           values ($1,$2,$3,'inventory', $4, $5, 'posted','not_required',$6,$6,$7) returning id`,
          [req.user!.companyId, entryNoRes.rows[0].no, req.body.trx_date, `STK-${type}`, req.body.notes || `Stock ${type} - ${product.rows[0].name}`, glAmount, req.user!.id],
        );
        const debitAccount = signedQty > 0 ? inventoryAccount : ADJUSTMENT_ACCOUNT;
        const creditAccount = signedQty > 0 ? ADJUSTMENT_ACCOUNT : inventoryAccount;
        await client.query(
          'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,$4,0)',
          [entry.rows[0].id, debitAccount, `Stock ${type} - ${product.rows[0].name}`, glAmount],
        );
        await client.query(
          'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,0,$4)',
          [entry.rows[0].id, creditAccount, `Stock ${type} - ${product.rows[0].name}`, glAmount],
        );
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: `STOCK_${type.toUpperCase()}`, entity: 'inventory_transactions', entity_id: inserted.rows[0].id, details: { product: product.rows[0].code, qty: signedQty } });
      return inserted.rows[0];
    });
    ok(res, { item }, 201);
  }),
);

export default router;
