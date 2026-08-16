import { Router } from 'express';
import { PoolClient } from 'pg';
import { pool, transact } from '../db';
import { asyncHandler, ok, AppError, audit, nextEntryNo, clampNumber } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { validateBody, parseId } from '../middleware/validate';
import { parseSearch, parseDateRange } from './parse';
import { requiresApproval, createApprovalRequest, round2 } from './journal';

const router = Router();
const purchaseRouter = Router();

router.use(requireAuth);
purchaseRouter.use(requireAuth);

const DEFAULT_EXPENSE_ACCOUNT = '00006120-0000-4000-8000-000000000000';
const AR_ACCOUNT = '00001200-0000-4000-8000-000000000000';
const AP_ACCOUNT = '00002100-0000-4000-8000-000000000000';
const VAT_PAYABLE = '00002300-0000-4000-8000-000000000000';
const VAT_RECOVERABLE = '00002310-0000-4000-8000-000000000000';

export const getAccountId = async (client: PoolClient, companyId: string, code: string) => {
  const res = await client.query('select id from chart_of_accounts where company_id = $1 and code = $2', [companyId, code]);
  return res.rows[0]?.id ?? null;
};

const avgCost = async (client: PoolClient, companyId: string, productId: string): Promise<number> => {
  const res = await client.query(
    `select coalesce(sum(total_value),0) as val, coalesce(sum(quantity),0) as qty
     from inventory_transactions
     where company_id = $1 and product_id = $2 and quantity > 0`,
    [companyId, productId],
  );
  const qty = Number(res.rows[0].qty || 0);
  if (qty <= 0) return 0;
  return Number(res.rows[0].val || 0) / qty;
};

export const loadProducts = async (client: PoolClient, companyId: string) => {
  const res = await client.query(
    `select id, category, sales_account_id, cogs_account_id, inventory_account_id, name, code from products where company_id = $1`,
    [companyId],
  );
  return new Map(res.rows.map((r) => [r.id, r]));
};

export const postSaleGl = async (
  client: PoolClient,
  companyId: string,
  userId: string,
  invoice: { id: string; invoice_no: string; invoice_date: string; total: number; tax_amount: number },
  lines: any[],
  productMap: Map<string, any>,
  arAccount: string,
  vatAccount: string,
): Promise<string> => {
  const entryNo = await nextEntryNo('GL-', 'journal_entries', 'entry_no');
  const created = await client.query(
    `insert into journal_entries
       (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by)
     values ($1,$2,$3,'sale',$4,$5,'posted','not_required',$6,$6,$7) returning id`,
    [companyId, entryNo, invoice.invoice_date, invoice.invoice_no, `Sales invoice ${invoice.invoice_no}`, round2(invoice.total), userId],
  );
  const entryId = created.rows[0].id;

  const insertLine = (accountId: string, desc: string, debit: number, credit: number) =>
    client.query(
      'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,$4,$5)',
      [entryId, accountId, desc, round2(debit), round2(credit)],
    );

  await insertLine(arAccount, `Accounts receivable - ${invoice.invoice_no}`, invoice.total, 0);

  let cogsTotal = 0;
  for (const l of lines) {
    const product = l.product_id ? productMap.get(l.product_id) : null;
    const salesAccount = product?.sales_account_id || (await getAccountId(client, companyId, '4000'));
    const lineNet = round2(Number(l.quantity) * Number(l.unit_price) - Number(l.discount || 0));
    if (salesAccount && lineNet > 0) await insertLine(salesAccount, l.description || product?.name || 'Product sale', 0, lineNet);
    const lineTax = round2(Number(l.tax_amount || 0));
    if (lineTax > 0) await insertLine(vatAccount, `VAT on ${invoice.invoice_no}`, 0, lineTax);

    if (product && product.category !== 'service' && Number(l.quantity) !== 0) {
      const cost = await avgCost(client, companyId, product.id);
      const cogs = round2(Math.abs(Number(l.quantity)) * cost);
      if (cogs > 0) {
        await insertLine(product.cogs_account_id || '00005000-0000-4000-8000-000000000000', `COGS - ${product.name}`, cogs, 0);
        await insertLine(product.inventory_account_id || '00001300-0000-4000-8000-000000000000', `Inventory out - ${product.name}`, 0, cogs);
        cogsTotal += cogs;
      }
    }
  }
  return entryId;
};

export const postPurchaseGl = async (
  client: PoolClient,
  companyId: string,
  userId: string,
  bill: { id: string; bill_no: string; bill_date: string; total: number; tax_amount: number },
  lines: any[],
  productMap: Map<string, any>,
  apAccount: string,
  vatAccount: string,
): Promise<string> => {
  const entryNo = await nextEntryNo('GL-', 'journal_entries', 'entry_no');
  const created = await client.query(
    `insert into journal_entries
       (company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, created_by)
     values ($1,$2,$3,'purchase',$4,$5,'posted','not_required',$6,$6,$7) returning id`,
    [companyId, entryNo, bill.bill_date, bill.bill_no, `Purchase invoice ${bill.bill_no}`, round2(bill.total), userId],
  );
  const entryId = created.rows[0].id;

  const insertLine = (accountId: string, desc: string, debit: number, credit: number) =>
    client.query(
      'insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values ($1,$2,$3,$4,$5)',
      [entryId, accountId, desc, round2(debit), round2(credit)],
    );

  let debitTotal = 0;
  for (const l of lines) {
    const product = l.product_id ? productMap.get(l.product_id) : null;
    const lineNet = round2(Number(l.quantity) * Number(l.unit_price) - Number(l.discount || 0));
    let account = null;
    if (product) {
      account = product.category !== 'service' ? product.inventory_account_id : product.cogs_account_id;
    }
    if (!account) account = await getAccountId(client, companyId, '6120');
    if (lineNet > 0) {
      await insertLine(account, l.description || product?.name || 'Purchase', lineNet, 0);
      debitTotal += lineNet;
    }
    const lineTax = round2(Number(l.tax_amount || 0));
    if (lineTax > 0) {
      await insertLine(vatAccount, `VAT input on ${bill.bill_no}`, lineTax, 0);
      debitTotal += lineTax;
    }
  }
  await insertLine(apAccount, `Accounts payable - ${bill.bill_no}`, 0, round2(Number(bill.total)));
  return entryId;
};

export const recordInventory = async (
  client: PoolClient,
  companyId: string,
  userId: string,
  lines: any[],
  type: 'sale' | 'purchase',
  referenceType: 'invoice' | 'purchase_invoice',
  referenceId: string,
  trxDate: string,
  productMap: Map<string, any>,
) => {
  for (const l of lines) {
    if (!l.product_id) continue;
    const product = productMap.get(l.product_id);
    if (!product || product.category === 'service') continue;
    const qty = type === 'purchase' ? Math.abs(Number(l.quantity)) : -Math.abs(Number(l.quantity));
    const cost = type === 'purchase' ? Number(l.unit_price) : await avgCost(client, companyId, product.id);
    await client.query(
      `insert into inventory_transactions (company_id, product_id, storage_id, type, quantity, unit_cost, total_value, reference_type, reference_id, trx_date, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [companyId, product.id, l.storage_id ?? null, type, qty, cost, round2(Math.abs(qty) * cost), referenceType, referenceId, trxDate, userId],
    );
  }
};

// ===========================================================================
// SALES INVOICES
// ===========================================================================

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const { from, to } = parseDateRange(req);
    const status = req.query.status ? String(req.query.status) : null;
    const params: unknown[] = [req.user!.companyId];
    const conds: string[] = ['i.company_id = $1'];
    let n = 1;
    if (search) { n += 1; params.push(search); conds.push(`(i.invoice_no ilike '%'||$${n}||'%' or c.name ilike '%'||$${n}||'%')`); }
    if (from) { n += 1; params.push(from); conds.push(`i.invoice_date >= $${n}::date`); }
    if (to) { n += 1; params.push(to); conds.push(`i.invoice_date <= $${n}::date`); }
    if (status) { n += 1; params.push(status); conds.push(`i.status = $${n}`); }
    const where = conds.length ? `where ${conds.join(' and ')}` : '';
    const result = await pool.query(
      `select i.*, c.name as customer_name, c.code as customer_code, u.name as created_by_name
       from invoices i
       left join customers c on c.id = i.customer_id
       left join users u on u.id = i.created_by
       ${where} order by i.invoice_date desc, i.invoice_no desc limit 500`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const inv = await pool.query(
      `select i.*, c.name as customer_name, c.code as customer_code, c.address as customer_address, c.tax_id as customer_tax_id
       from invoices i left join customers c on c.id = i.customer_id
       where i.id = $1 and i.company_id = $2`,
      [id, req.user!.companyId],
    );
    if (!inv.rows[0]) throw new AppError(404, 'Invoice not found');
    const lines = await pool.query(
      `select l.*, p.code as product_code, p.name as product_name, p.unit
       from invoice_lines l left join products p on p.id = l.product_id
       where l.invoice_id = $1`,
      [id],
    );
    ok(res, { item: inv.rows[0], lines: lines.rows });
  }),
);

router.post(
  '/',
  requireRole('accountant', 'admin', 'director', 'manager'),
  validateBody([
    { key: 'invoice_date', required: true, type: 'string' },
    { key: 'customer_id', required: true, type: 'string' },
    { key: 'lines', required: true },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const item = await transact(async (client) => {
      if (!Array.isArray(req.body.lines) || !req.body.lines.length) throw new AppError(422, 'Invoice requires at least one line');

      const productMap = await loadProducts(client, req.user!.companyId);
      let subtotal = 0;
      let taxTotal = 0;
      const lines = req.body.lines.map((l: any) => {
        const qty = clampNumber(l.quantity, 1);
        const price = clampNumber(l.unit_price);
        const discount = clampNumber(l.discount);
        const lineNet = round2(qty * price - discount);
        const taxRate = clampNumber(l.tax_rate);
        const lineTax = l.tax_amount !== undefined && l.tax_amount !== null ? round2(clampNumber(l.tax_amount)) : round2(lineNet * taxRate / 100);
        subtotal += lineNet;
        taxTotal += lineTax;
        return { ...l, quantity: qty, unit_price: price, discount, tax_rate: taxRate, tax_amount: lineTax, line_total: round2(lineNet + lineTax) };
      });
      const total = round2(subtotal + taxTotal);
      const invoiceNo = await nextEntryNo('INV-', 'invoices', 'invoice_no');
      const needsApproval = await requiresApproval(req.user!.companyId, total);
      const dueDate = req.body.due_date || null;

      const inserted = await client.query(
        `insert into invoices (company_id, invoice_no, invoice_date, due_date, customer_id, subtotal, discount_amount, tax_amount, total, status, approval_status, reference, notes, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
        [
          req.user!.companyId, invoiceNo, req.body.invoice_date, dueDate, req.body.customer_id,
          round2(subtotal), 0, round2(taxTotal), total,
          needsApproval ? 'draft' : 'issued', needsApproval ? 'pending' : 'not_required',
          req.body.reference ?? null, req.body.notes ?? null, req.user!.id,
        ],
      );
      const invoice = inserted.rows[0];
      for (const l of lines) {
        await client.query(
          `insert into invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount, tax_rate, tax_amount, line_total)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [invoice.id, l.product_id ?? null, l.description ?? null, l.quantity, l.unit_price, l.discount, l.tax_rate, l.tax_amount, l.line_total],
        );
      }
      if (needsApproval) {
        await createApprovalRequest(client, req.user!.companyId, 'invoice', invoice.id, invoiceNo, total, req.user!.id);
      } else {
        const entryId = await postSaleGl(client, req.user!.companyId, req.user!.id, invoice, lines, productMap, await getAccountId(client, req.user!.companyId, '1200'), await getAccountId(client, req.user!.companyId, '2300'));
        await client.query('update invoices set journal_entry_id = $1 where id = $2', [entryId, invoice.id]);
        await recordInventory(client, req.user!.companyId, req.user!.id, lines, 'sale', 'invoice', invoice.id, req.body.invoice_date, productMap);
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE_INVOICE', entity: 'invoices', entity_id: invoice.id, details: { invoice_no: invoiceNo, total, approval: needsApproval ? 'pending' : 'posted' } });
      return invoice;
    });
    ok(res, { item }, 201);
  }),
);

router.post(
  '/:id/approve',
  requireRole('director', 'admin', 'manager'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const inv = await client.query('select * from invoices where id = $1 and company_id = $2 for update', [id, req.user!.companyId]);
      if (!inv.rows[0]) throw new AppError(404, 'Invoice not found');
      if (inv.rows[0].approval_status !== 'pending') throw new AppError(409, 'Invoice is not awaiting approval');
      const productMap = await loadProducts(client, req.user!.companyId);
      const lines = await client.query('select * from invoice_lines where invoice_id = $1', [id]);
      const entryId = await postSaleGl(client, req.user!.companyId, req.user!.id, inv.rows[0], lines.rows, productMap, await getAccountId(client, req.user!.companyId, '1200'), await getAccountId(client, req.user!.companyId, '2300'));
      await client.query(
        `update invoices set approval_status='approved', approved_by=$1, approved_at=now(), status='issued', journal_entry_id=$2, updated_at=now()
         where id = $3`,
        [req.user!.id, entryId, id],
      );
      await client.query(
        `update approval_requests set status='approved', reviewed_by=$1, reviewed_at=now(), comment=$2
         where entity_type='invoice' and entity_id=$3 and status='pending'`,
        [req.user!.id, req.body.comment ?? null, id],
      );
      await recordInventory(client, req.user!.companyId, req.user!.id, lines.rows, 'sale', 'invoice', id, inv.rows[0].invoice_date, productMap);
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'APPROVE_INVOICE', entity: 'invoices', entity_id: id, details: { invoice_no: inv.rows[0].invoice_no } });
      return { approved: true };
    });
    ok(res, result);
  }),
);

router.post(
  '/:id/reject',
  requireRole('director', 'admin', 'manager'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    await transact(async (client) => {
      await client.query(
        `update invoices set approval_status='rejected', status='draft', updated_at=now() where id = $1 and company_id = $2`,
        [id, req.user!.companyId],
      );
      await client.query(
        `update approval_requests set status='rejected', reviewed_by=$1, reviewed_at=now(), comment=$2
         where entity_type='invoice' and entity_id=$3 and status='pending'`,
        [req.user!.id, req.body.comment ?? null, id],
      );
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'REJECT_INVOICE', entity: 'invoices', entity_id: id });
    });
    ok(res, { rejected: true });
  }),
);

router.post(
  '/:id/void',
  requireRole('accountant', 'admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const inv = await client.query('select * from invoices where id = $1 and company_id = $2', [id, req.user!.companyId]);
      if (!inv.rows[0]) throw new AppError(404, 'Invoice not found');
      if (inv.rows[0].amount_paid > 0) throw new AppError(409, 'Invoice has payments and cannot be voided');
      await client.query(`update invoices set status='void', updated_at=now() where id = $1`, [id]);
      await client.query('delete from approval_requests where entity_type=$1 and entity_id=$2', ['invoice', id]);
      if (inv.rows[0].journal_entry_id) {
        const entries = await client.query('select id from journal_entries where id = $1', [inv.rows[0].journal_entry_id]);
        if (entries.rows[0]?.status === 'draft') {
          await client.query('delete from journal_entry_lines where entry_id = $1', [inv.rows[0].journal_entry_id]);
          await client.query('delete from journal_entries where id = $1', [inv.rows[0].journal_entry_id]);
        }
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'VOID_INVOICE', entity: 'invoices', entity_id: id, details: { reason: req.body.reason ?? null } });
      return { voided: true };
    });
    ok(res, result);
  }),
);

// ===========================================================================
// PURCHASE INVOICES
// ===========================================================================

purchaseRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const { from, to } = parseDateRange(req);
    const status = req.query.status ? String(req.query.status) : null;
    const params: unknown[] = [req.user!.companyId];
    const conds: string[] = ['i.company_id = $1'];
    let n = 1;
    if (search) { n += 1; params.push(search); conds.push(`(i.bill_no ilike '%'||$${n}||'%' or s.name ilike '%'||$${n}||'%')`); }
    if (from) { n += 1; params.push(from); conds.push(`i.bill_date >= $${n}::date`); }
    if (to) { n += 1; params.push(to); conds.push(`i.bill_date <= $${n}::date`); }
    if (status) { n += 1; params.push(status); conds.push(`i.status = $${n}`); }
    const where = conds.length ? `where ${conds.join(' and ')}` : '';
    const result = await pool.query(
      `select i.*, s.name as supplier_name, s.code as supplier_code, u.name as created_by_name
       from purchase_invoices i
       left join suppliers s on s.id = i.supplier_id
       left join users u on u.id = i.created_by
       ${where} order by i.bill_date desc, i.bill_no desc limit 500`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

purchaseRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const inv = await pool.query(
      `select i.*, s.name as supplier_name, s.code as supplier_code, s.address as supplier_address, s.tax_id as supplier_tax_id
       from purchase_invoices i left join suppliers s on s.id = i.supplier_id
       where i.id = $1 and i.company_id = $2`,
      [id, req.user!.companyId],
    );
    if (!inv.rows[0]) throw new AppError(404, 'Purchase invoice not found');
    const lines = await pool.query(
      `select l.*, p.code as product_code, p.name as product_name, p.unit
       from purchase_invoice_lines l left join products p on p.id = l.product_id
       where l.purchase_invoice_id = $1`,
      [id],
    );
    ok(res, { item: inv.rows[0], lines: lines.rows });
  }),
);

purchaseRouter.post(
  '/',
  requireRole('accountant', 'admin', 'director', 'manager'),
  validateBody([
    { key: 'bill_date', required: true, type: 'string' },
    { key: 'supplier_id', required: true, type: 'string' },
    { key: 'lines', required: true },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const item = await transact(async (client) => {
      if (!Array.isArray(req.body.lines) || !req.body.lines.length) throw new AppError(422, 'Purchase invoice requires at least one line');
      const productMap = await loadProducts(client, req.user!.companyId);
      let subtotal = 0;
      let taxTotal = 0;
      const lines = req.body.lines.map((l: any) => {
        const qty = clampNumber(l.quantity, 1);
        const price = clampNumber(l.unit_price);
        const discount = clampNumber(l.discount);
        const lineNet = round2(qty * price - discount);
        const taxRate = clampNumber(l.tax_rate);
        const lineTax = l.tax_amount !== undefined && l.tax_amount !== null ? round2(clampNumber(l.tax_amount)) : round2(lineNet * taxRate / 100);
        subtotal += lineNet;
        taxTotal += lineTax;
        return { ...l, quantity: qty, unit_price: price, discount, tax_rate: taxRate, tax_amount: lineTax, line_total: round2(lineNet + lineTax) };
      });
      const total = round2(subtotal + taxTotal);
      const billNo = await nextEntryNo('BILL-', 'purchase_invoices', 'bill_no');
      const needsApproval = await requiresApproval(req.user!.companyId, total);
      const dueDate = req.body.due_date || null;

      const inserted = await client.query(
        `insert into purchase_invoices (company_id, bill_no, bill_date, due_date, supplier_id, subtotal, discount_amount, tax_amount, total, status, approval_status, reference, notes, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
        [
          req.user!.companyId, billNo, req.body.bill_date, dueDate, req.body.supplier_id,
          round2(subtotal), 0, round2(taxTotal), total,
          needsApproval ? 'draft' : 'issued', needsApproval ? 'pending' : 'not_required',
          req.body.reference ?? null, req.body.notes ?? null, req.user!.id,
        ],
      );
      const bill = inserted.rows[0];
      for (const l of lines) {
        await client.query(
          `insert into purchase_invoice_lines (purchase_invoice_id, product_id, description, quantity, unit_price, discount, tax_rate, tax_amount, line_total)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [bill.id, l.product_id ?? null, l.description ?? null, l.quantity, l.unit_price, l.discount, l.tax_rate, l.tax_amount, l.line_total],
        );
      }
      if (needsApproval) {
        await createApprovalRequest(client, req.user!.companyId, 'purchase_invoice', bill.id, billNo, total, req.user!.id);
      } else {
        const entryId = await postPurchaseGl(client, req.user!.companyId, req.user!.id, bill, lines, productMap, await getAccountId(client, req.user!.companyId, '2100'), await getAccountId(client, req.user!.companyId, '2310'));
        await client.query('update purchase_invoices set journal_entry_id = $1 where id = $2', [entryId, bill.id]);
        await recordInventory(client, req.user!.companyId, req.user!.id, lines, 'purchase', 'purchase_invoice', bill.id, req.body.bill_date, productMap);
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE_PURCHASE_INVOICE', entity: 'purchase_invoices', entity_id: bill.id, details: { bill_no: billNo, total, approval: needsApproval ? 'pending' : 'posted' } });
      return bill;
    });
    ok(res, { item }, 201);
  }),
);

purchaseRouter.post(
  '/:id/approve',
  requireRole('director', 'admin', 'manager'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    await transact(async (client) => {
      const inv = await client.query('select * from purchase_invoices where id = $1 and company_id = $2 for update', [id, req.user!.companyId]);
      if (!inv.rows[0]) throw new AppError(404, 'Purchase invoice not found');
      if (inv.rows[0].approval_status !== 'pending') throw new AppError(409, 'Purchase invoice is not awaiting approval');
      const productMap = await loadProducts(client, req.user!.companyId);
      const lines = await client.query('select * from purchase_invoice_lines where purchase_invoice_id = $1', [id]);
      const entryId = await postPurchaseGl(client, req.user!.companyId, req.user!.id, inv.rows[0], lines.rows, productMap, await getAccountId(client, req.user!.companyId, '2100'), await getAccountId(client, req.user!.companyId, '2310'));
      await client.query(
        `update purchase_invoices set approval_status='approved', approved_by=$1, approved_at=now(), status='issued', journal_entry_id=$2, updated_at=now() where id = $3`,
        [req.user!.id, entryId, id],
      );
      await client.query(
        `update approval_requests set status='approved', reviewed_by=$1, reviewed_at=now(), comment=$2
         where entity_type='purchase_invoice' and entity_id=$3 and status='pending'`,
        [req.user!.id, req.body.comment ?? null, id],
      );
      await recordInventory(client, req.user!.companyId, req.user!.id, lines.rows, 'purchase', 'purchase_invoice', id, inv.rows[0].bill_date, productMap);
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'APPROVE_PURCHASE_INVOICE', entity: 'purchase_invoices', entity_id: id });
    });
    ok(res, { approved: true });
  }),
);

purchaseRouter.post(
  '/:id/reject',
  requireRole('director', 'admin', 'manager'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    await transact(async (client) => {
      await client.query(
        `update purchase_invoices set approval_status='rejected', status='draft', updated_at=now() where id = $1 and company_id = $2`,
        [id, req.user!.companyId],
      );
      await client.query(
        `update approval_requests set status='rejected', reviewed_by=$1, reviewed_at=now(), comment=$2
         where entity_type='purchase_invoice' and entity_id=$3 and status='pending'`,
        [req.user!.id, req.body.comment ?? null, id],
      );
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'REJECT_PURCHASE_INVOICE', entity: 'purchase_invoices', entity_id: id });
    });
    ok(res, { rejected: true });
  }),
);

purchaseRouter.post(
  '/:id/void',
  requireRole('accountant', 'admin', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    await transact(async (client) => {
      const inv = await client.query('select * from purchase_invoices where id = $1 and company_id = $2', [id, req.user!.companyId]);
      if (!inv.rows[0]) throw new AppError(404, 'Purchase invoice not found');
      if (inv.rows[0].amount_paid > 0) throw new AppError(409, 'Purchase invoice has payments and cannot be voided');
      await client.query(`update purchase_invoices set status='void', updated_at=now() where id = $1`, [id]);
      await client.query('delete from approval_requests where entity_type=$1 and entity_id=$2', ['purchase_invoice', id]);
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'VOID_PURCHASE_INVOICE', entity: 'purchase_invoices', entity_id: id });
    });
    ok(res, { voided: true });
  }),
);

export default router;
export { purchaseRouter };
