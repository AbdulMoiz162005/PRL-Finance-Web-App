import { Router, Response } from 'express';
import { pool, transact } from '../db';
import { asyncHandler, ok, AppError, audit, round2, nextEntryNo } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { validateBody, parseId } from '../middleware/validate';
import { parseSearch, parseDateRange } from './parse';

const router = Router();
router.use(requireAuth);

const COMPANY = (req: AuthRequest) => req.user!.companyId;
type Db = import('pg').Pool | import('pg').PoolClient;

// Advanced sorting helper: maps safe column names to SQL expressions.
const sortSpec = (req: AuthRequest, allowed: Record<string, string>) => {
  const col = req.query.sort_by ? String(req.query.sort_by) : null;
  const dir = String(req.query.sort_dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  if (!col) return null;
  const expr = allowed[col];
  return expr ? { expr, dir } : null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Convert a number to words using the Pakistani numbering system (Crore/Lakh)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number): string => {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
};

const threeDigits = (n: number): string => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hw = h ? `${ONES[h]} Hundred` : '';
  const rw = rest ? twoDigits(rest) : '';
  return hw && rw ? `${hw} ${rw}` : hw || rw;
};

export const rupeesInWords = (amount: number): string => {
  const num = Math.abs(Math.round(amount * 100) / 100);
  const intPart = Math.floor(num);
  const paise = Math.round((num - intPart) * 100);
  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const rest = intPart % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  let words = parts.length ? parts.join(' ') : 'Zero';
  words += ' Rupees';
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
};

const contractUsage = async (client: Db, companyId: string, contractId: string | null) => {
  if (!contractId) return { used: 0, remaining: 0, utilization: 0, value: 0 };
  const res = await client.query(
    `select c.contract_value as value,
            coalesce((select sum(i.amount) from surveyor_invoices i
                      where i.contract_id = c.id and i.approval_status = 'Approved' and i.company_id = c.company_id), 0) as used
     from surveyor_contracts c where c.id = $1 and c.company_id = $2`,
    [contractId, companyId],
  );
  const row = res.rows[0];
  if (!row) return { used: 0, remaining: 0, utilization: 0, value: 0 };
  const value = Number(row.value);
  const used = Number(row.used);
  return { value, used, remaining: round2(value - used), utilization: value ? round2(used / value) : 0 };
};

const computeValidation = (invoiceDate: string | null | undefined, processingDate: string | null | undefined): string =>
  invoiceDate && processingDate ? 'Valid' : 'Invalid Date';

const withContract = async (client: Db, companyId: string, code: string | null | undefined): Promise<string | null> => {
  if (!code) return null;
  const res = await client.query('select id from surveyor_contracts where contract_code = $1 and company_id = $2', [code, companyId]);
  return res.rows[0]?.id ?? null;
};

// Strict contract resolution for invoices: rejects unknown/closed contracts, out-of-range
// dates, vendor mismatches, and returns an overbilling alert when the contract balance
// would be exceeded. Enforces the "no invalid or wrong contract" rule on data entry.
const resolveContract = async (
  client: Db,
  companyId: string,
  code: string | null | undefined,
  opts: { invoice_date?: string | null; services_month?: string | null; vendor?: string | null; amount: number; exclude_invoice_id?: string | null },
): Promise<{ id: string | null; alert: string | null }> => {
  if (!code) return { id: null, alert: null };
  const res = await client.query('select * from surveyor_contracts where contract_code = $1 and company_id = $2', [code, companyId]);
  if (!res.rows[0]) throw new AppError(400, `Contract code '${code}' not found`);
  const c = res.rows[0];
  if (c.status !== 'open') throw new AppError(400, `Contract ${code} is '${c.status}' and cannot be used for new invoices`);
  const refDate = opts.invoice_date || opts.services_month;
  if (refDate) {
    const d = new Date(refDate);
    const s = new Date(c.start_date);
    const e = new Date(c.end_date);
    if (!Number.isNaN(d.getTime()) && (d < s || d > e)) {
      throw new AppError(400, `Invoice date ${String(refDate).slice(0, 10)} is outside contract ${code} validity (${s.toISOString().slice(0, 10)} to ${e.toISOString().slice(0, 10)})`);
    }
  }
  if (opts.vendor && c.contractor && opts.vendor.toLowerCase() !== String(c.contractor).toLowerCase()) {
    throw new AppError(400, `Vendor '${opts.vendor}' does not match contractor '${c.contractor}' of contract ${code}`);
  }
  const usage = await client.query(
    `select coalesce(sum(amount), 0) as used from surveyor_invoices
     where contract_id = $1 and approval_status = 'Approved' and ($2::uuid is null or id <> $2::uuid)`,
    [c.id, opts.exclude_invoice_id ?? null],
  );
  const used = Number(usage.rows[0].used);
  const value = Number(c.contract_value);
  const alert = used + opts.amount > value ? 'Overbilling' : null;
  return { id: c.id, alert };
};

const logApproval = async (
  client: Db,
  companyId: string,
  payload: { contract_code?: string | null; invoice_no: string; amount: number; prev_status?: string | null; action: string; remarks?: string | null; user_id?: string | null; user_email?: string | null },
) => {
  await client.query(
    `insert into surveyor_approval_logs (company_id, contract_code, invoice_no, amount, prev_status, action, remarks, user_id, user_email)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [companyId, payload.contract_code ?? null, payload.invoice_no, payload.amount, payload.prev_status ?? null, payload.action, payload.remarks ?? null, payload.user_id ?? null, payload.user_email ?? null],
  );
};

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

const CONTRACT_FIELDS = ['contractor', 'service_type', 'contract_code', 'contract_value', 'start_date', 'end_date', 'status', 'notes'];

router.get(
  '/contracts',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const status = req.query.status ? String(req.query.status) : null;
    const sort = sortSpec(req, {
      contract_code: 'c.contract_code', contractor: 'c.contractor', service_type: 'c.service_type',
      contract_value: 'c.contract_value', start_date: 'c.start_date', end_date: 'c.end_date',
      status: 'c.status',
    });
    const params: unknown[] = [COMPANY(req)];
    let where = 'c.company_id = $1';
    let n = 1;
    if (search) {
      n += 1; params.push(search);
      where += ` and (c.contractor ilike '%'||$${n}||'%' or c.contract_code ilike '%'||$${n}||'%' or c.service_type ilike '%'||$${n}||'%')`;
    }
    if (status) { n += 1; params.push(status); where += ` and lower(c.status) = lower($${n})`; }
    const result = await pool.query(
      `select c.*,
              coalesce((select sum(i.amount) from surveyor_invoices i where i.contract_id = c.id and i.approval_status = 'Approved'), 0) as used_amount,
              coalesce((select count(*) from surveyor_invoices i where i.contract_id = c.id), 0)::int as invoice_count,
              (select count(*) from surveyor_invoices i where i.contract_id = c.id and i.approval_status = 'Pending')::int as pending_count
       from surveyor_contracts c where ${where} order by ${sort ? `${sort.expr} ${sort.dir}` : 'c.contract_code'}`,
      params,
    );
    const items = result.rows.map((c) => {
      const value = Number(c.contract_value);
      const used = Number(c.used_amount);
      return {
        ...c,
        used_amount: round2(used),
        remaining_amount: round2(value - used),
        utilization: value ? round2(used / value) : 0,
        status: value - used < 0 ? 'overbilled' : c.status,
      };
    });
    ok(res, { items });
  }),
);

router.get(
  '/contracts/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query('select * from surveyor_contracts where id = $1 and company_id = $2', [id, COMPANY(req)]);
    if (!result.rows[0]) throw new AppError(404, 'Contract not found');
    const usage = await contractUsage(pool, COMPANY(req), id);
    ok(res, { item: { ...result.rows[0], ...usage } });
  }),
);

router.post(
  '/contracts',
  requireRole('admin', 'accountant', 'director'),
  validateBody([{ key: 'contractor', required: true, type: 'string' }, { key: 'contract_code', required: true, type: 'string' }, { key: 'contract_value', required: true, type: 'number' }]),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = req.body;
    const existing = await pool.query('select id from surveyor_contracts where contract_code = $1 and company_id = $2', [body.contract_code, COMPANY(req)]);
    if (existing.rows[0]) throw new AppError(409, `Contract code '${body.contract_code}' already exists`);
    const fields = CONTRACT_FIELDS.filter((f) => body[f] !== undefined && body[f] !== null);
    const result = await pool.query(
      `insert into surveyor_contracts (company_id, ${fields.join(', ')})
       values ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')}) returning *`,
      [COMPANY(req), ...fields.map((f) => body[f])],
    );
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE', entity: 'surveyor_contract', entity_id: result.rows[0].id, details: body });
    ok(res, { item: result.rows[0] }, 201);
  }),
);

router.patch(
  '/contracts/:id',
  requireRole('admin', 'accountant', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const body = req.body || {};
    const sets: string[] = [];
    const params: unknown[] = [id, COMPANY(req)];
    for (const f of CONTRACT_FIELDS) {
      if (body[f] !== undefined) {
        params.push(body[f]);
        sets.push(`${f} = $${params.length}`);
      }
    }
    if (!sets.length) throw new AppError(422, 'No fields to update');
    params.push(new Date().toISOString());
    const result = await pool.query(
      `update surveyor_contracts set ${sets.join(', ')}, updated_at = $${params.length} where id = $1 and company_id = $2 returning *`,
      params,
    );
    if (!result.rows[0]) throw new AppError(404, 'Contract not found');
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'UPDATE', entity: 'surveyor_contract', entity_id: id, details: body });
    ok(res, { item: result.rows[0] });
  }),
);

router.delete(
  '/contracts/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const linked = await pool.query('select count(*)::int as n from surveyor_invoices where contract_id = $1', [id]);
    if (linked.rows[0].n > 0) throw new AppError(409, 'Contract has linked invoices and cannot be deleted');
    const result = await pool.query('delete from surveyor_contracts where id = $1 and company_id = $2 returning id', [id, COMPANY(req)]);
    if (!result.rows[0]) throw new AppError(404, 'Contract not found');
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'DELETE', entity: 'surveyor_contract', entity_id: id });
    ok(res, { message: 'Deleted' });
  }),
);

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const INVOICE_SELECT = `select si.*, c.contract_code, c.contract_value, c.contractor,
    u.name as approved_by_name
  from surveyor_invoices si
  left join surveyor_contracts c on c.id = si.contract_id
  left join users u on u.id = si.approved_by`;

router.get(
  '/invoices',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const { from, to } = parseDateRange(req);
    const status = req.query.status ? String(req.query.status) : null;
    const vendor = req.query.vendor ? String(req.query.vendor) : null;
    const contract = req.query.contract ? String(req.query.contract) : null;
    const alert = req.query.alert ? String(req.query.alert) : null;
    const minAmount = req.query.min_amount ? Number(req.query.min_amount) : null;
    const maxAmount = req.query.max_amount ? Number(req.query.max_amount) : null;
    const sort = sortSpec(req, {
      invoice_no: 'si.invoice_no', vendor: 'si.vendor', amount: 'si.amount',
      invoice_date: 'si.invoice_date', services_month: 'si.services_month',
      tanker_name: 'si.tanker_name', approval_status: 'si.approval_status',
      contract: 'c.contract_code', created_at: 'si.created_at',
    });

    const params: unknown[] = [COMPANY(req)];
    const conds: string[] = ['si.company_id = $1'];
    let n = 1;
    if (search) {
      n += 1; params.push(search);
      conds.push(`(si.invoice_no ilike '%'||$${n}||'%' or si.tanker_name ilike '%'||$${n}||'%' or si.item_no ilike '%'||$${n}||'%' or si.vendor ilike '%'||$${n}||'%' or c.contract_code ilike '%'||$${n}||'%')`);
    }
    if (from) { n += 1; params.push(from); conds.push(`si.invoice_date >= $${n}::date`); }
    if (to) { n += 1; params.push(to); conds.push(`si.invoice_date <= $${n}::date`); }
    if (status) { n += 1; params.push(status); conds.push(`si.approval_status ilike $${n}`); }
    if (vendor) { n += 1; params.push(vendor); conds.push(`si.vendor = $${n}`); }
    if (contract) { n += 1; params.push(contract); conds.push(`c.contract_code = $${n}`); }
    if (alert) { n += 1; params.push(alert); conds.push(`si.alert ilike $${n}`); }
    if (minAmount !== null && !Number.isNaN(minAmount)) { n += 1; params.push(minAmount); conds.push(`si.amount >= $${n}`); }
    if (maxAmount !== null && !Number.isNaN(maxAmount)) { n += 1; params.push(maxAmount); conds.push(`si.amount <= $${n}`); }
    const where = conds.join(' and ');

    const result = await pool.query(
      `select si.*, c.contract_code, c.contract_value, c.contractor, u.name as approved_by_name,
              coalesce((select sum(i2.amount) from surveyor_invoices i2 where i2.contract_id = si.contract_id and i2.approval_status = 'Approved'), 0) as contract_used
       from surveyor_invoices si
       left join surveyor_contracts c on c.id = si.contract_id
       left join users u on u.id = si.approved_by
       where ${where} order by ${sort ? `${sort.expr} ${sort.dir}` : 'si.created_at desc, si.invoice_no'} limit 1000`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/invoices/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query(`${INVOICE_SELECT} where si.id = $1 and si.company_id = $2`, [id, COMPANY(req)]);
    if (!result.rows[0]) throw new AppError(404, 'Invoice not found');
    const usage = await contractUsage(pool, COMPANY(req), result.rows[0].contract_id);
    ok(res, { item: { ...result.rows[0], ...usage } });
  }),
);

router.post(
  '/invoices',
  requireRole('admin', 'accountant', 'director', 'manager'),
  validateBody([
    { key: 'invoice_no', required: true, type: 'string' },
    { key: 'vendor', required: true, type: 'string' },
    { key: 'amount', required: true, type: 'number' },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const body = req.body || {};
    const resolved = await resolveContract(pool, COMPANY(req), body.contract_code, {
      invoice_date: body.invoice_date ?? null,
      services_month: body.services_month ?? null,
      vendor: body.vendor,
      amount: Number(body.amount),
    });
    const validation = computeValidation(body.invoice_date, body.processing_date);
    const result = await pool.query(
      `insert into surveyor_invoices
        (company_id, serial_no, contract_id, invoice_no, invoice_date, processing_date,
         service_type_1, service_type_2, service_type_3, tanker_name, cost_element,
         services_month, item_no, amount, vendor, validation, invoice_status, approval_status, alert, remarks, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'Accepted','Pending',$17,$18,$19)
       returning *`,
      [COMPANY(req), body.serial_no ?? null, resolved.id, body.invoice_no, body.invoice_date ?? null, body.processing_date ?? null,
       body.service_type_1 ?? null, body.service_type_2 ?? null, body.service_type_3 ?? null, body.tanker_name ?? null, body.cost_element ?? null,
       body.services_month ?? null, body.item_no ?? null, body.amount, body.vendor, validation, resolved.alert, body.remarks ?? null, req.user!.id],
    );
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE', entity: 'surveyor_invoice', entity_id: result.rows[0].id, details: body });
    ok(res, { item: result.rows[0] }, 201);
  }),
);

router.patch(
  '/invoices/:id',
  requireRole('admin', 'accountant', 'director', 'manager'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const existing = await pool.query('select * from surveyor_invoices where id = $1 and company_id = $2', [id, COMPANY(req)]);
    if (!existing.rows[0]) throw new AppError(404, 'Invoice not found');
    const prev = existing.rows[0];
    if (prev.approval_status === 'Approved') throw new AppError(409, 'Approved invoices cannot be edited; reopen or reject first');

    const body = req.body || {};
    const fields = ['serial_no', 'invoice_no', 'invoice_date', 'processing_date', 'service_type_1', 'service_type_2', 'service_type_3', 'tanker_name', 'cost_element', 'services_month', 'item_no', 'amount', 'vendor', 'invoice_status', 'remarks'];
    const sets: string[] = [];
    const params: unknown[] = [id, COMPANY(req)];
    for (const f of fields) {
      if (body[f] !== undefined) {
        params.push(body[f]);
        sets.push(`${f} = $${params.length}`);
      }
    }
    // Strict contract re-validation whenever the contract, amount, vendor or dates change.
    if (body.contract_code !== undefined || body.amount !== undefined || body.vendor !== undefined || body.invoice_date !== undefined || body.services_month !== undefined) {
      const finalContractCode = body.contract_code ?? (prev.contract_id ? (await pool.query('select contract_code from surveyor_contracts where id = $1', [prev.contract_id])).rows[0]?.contract_code : null);
      const resolved = await resolveContract(pool, COMPANY(req), finalContractCode, {
        invoice_date: body.invoice_date ?? prev.invoice_date,
        services_month: body.services_month ?? prev.services_month,
        vendor: body.vendor ?? prev.vendor,
        amount: Number(body.amount ?? prev.amount),
        exclude_invoice_id: id,
      });
      if (body.contract_code !== undefined) {
        params.push(resolved.id);
        sets.push(`contract_id = $${params.length}`);
      }
      params.push(resolved.alert);
      sets.push(`alert = $${params.length}`);
    }
    if (!sets.length) throw new AppError(422, 'No fields to update');
    if (body.invoice_date !== undefined || body.processing_date !== undefined) {
      const invDate = body.invoice_date ?? prev.invoice_date;
      const procDate = body.processing_date ?? prev.processing_date;
      params.push(computeValidation(invDate, procDate));
      sets.push(`validation = $${params.length}`);
    }
    params.push(new Date().toISOString());
    const result = await pool.query(
      `update surveyor_invoices set ${sets.join(', ')}, updated_at = $${params.length} where id = $1 and company_id = $2 returning *`,
      params,
    );
    await logApproval(pool, COMPANY(req), {
      contract_code: result.rows[0].contract_id ? (await pool.query('select contract_code from surveyor_contracts where id = $1', [result.rows[0].contract_id])).rows[0]?.contract_code : null,
      invoice_no: result.rows[0].invoice_no,
      amount: Number(result.rows[0].amount),
      prev_status: prev.approval_status,
      action: 'EDITED',
      remarks: 'Invoice edited',
      user_id: req.user!.id,
      user_email: req.user!.email,
    });
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'UPDATE', entity: 'surveyor_invoice', entity_id: id, details: body });
    ok(res, { item: result.rows[0] });
  }),
);

router.delete(
  '/invoices/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const linked = await pool.query('select count(*)::int as n from pay_order_lines where surveyor_invoice_id = $1', [id]);
    if (linked.rows[0].n > 0) throw new AppError(409, 'Invoice is referenced by a pay order and cannot be deleted');
    const result = await pool.query('delete from surveyor_invoices where id = $1 and company_id = $2 returning id', [id, COMPANY(req)]);
    if (!result.rows[0]) throw new AppError(404, 'Invoice not found');
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'DELETE', entity: 'surveyor_invoice', entity_id: id });
    ok(res, { message: 'Deleted' });
  }),
);

// Approval workflow
router.post(
  '/invoices/:id/approve',
  requireRole('admin', 'director', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const inv = await client.query('select * from surveyor_invoices where id = $1 and company_id = $2', [id, COMPANY(req)]);
      if (!inv.rows[0]) throw new AppError(404, 'Invoice not found');
      const invRow = inv.rows[0];
      const prevStatus = invRow.approval_status;
      if (prevStatus === 'Approved') throw new AppError(409, 'Invoice already approved');

      // Automatic decisioning: block approval when the linked contract is missing,
      // not open, or the invoice falls outside its validity period.
      let alert: string | null = null;
      if (invRow.contract_id) {
        const c = await client.query('select * from surveyor_contracts where id = $1 and company_id = $2', [invRow.contract_id, COMPANY(req)]);
        if (!c.rows[0]) throw new AppError(409, 'Linked contract no longer exists; reopen and reassign a contract first');
        const contract = c.rows[0];
        if (contract.status !== 'open') throw new AppError(409, `Contract ${contract.contract_code} is '${contract.status}'; it cannot be used for approvals`);
        const refDate = invRow.invoice_date || invRow.services_month;
        if (refDate) {
          const d = new Date(refDate);
          const s = new Date(contract.start_date);
          const e = new Date(contract.end_date);
          if (!Number.isNaN(d.getTime()) && (d < s || d > e)) {
            throw new AppError(409, `Invoice date ${String(refDate).slice(0, 10)} is outside contract ${contract.contract_code} validity (${s.toISOString().slice(0, 10)} to ${e.toISOString().slice(0, 10)})`);
          }
        }
        const usage = await contractUsage(client, COMPANY(req), invRow.contract_id);
        const amount = Number(invRow.amount);
        const wouldExceed = usage.value > 0 && usage.used + amount > usage.value;
        alert = wouldExceed ? 'Overbilling' : null;
      }

      await client.query(
        `update surveyor_invoices set approval_status = 'Approved', alert = $1, approved_by = $2, approved_at = now(), approved_snapshot = $3, updated_at = now()
         where id = $4`,
        [alert, req.user!.id, Number(invRow.amount), id],
      );
      await logApproval(client, COMPANY(req), {
        contract_code: invRow.contract_id ? (await client.query('select contract_code from surveyor_contracts where id = $1', [invRow.contract_id])).rows[0]?.contract_code : null,
        invoice_no: invRow.invoice_no,
        amount: Number(invRow.amount),
        prev_status: prevStatus,
        action: 'Approved',
        remarks: req.body?.remarks ?? (alert === 'Overbilling' ? 'Approved despite contract overbilling' : 'Approval completed'),
        user_id: req.user!.id,
        user_email: req.user!.email,
      });
      await client.query(
        `insert into audit_logs (user_id, user_email, action, entity, entity_id, details)
         values ($1,$2,'APPROVE','surveyor_invoice',$3,$4)`,
        [req.user!.id, req.user!.email, id, JSON.stringify({ alert, amount: Number(invRow.amount) })],
      );
      return { ...invRow, approval_status: 'Approved', alert, approved_snapshot: Number(invRow.amount), approved_at: new Date().toISOString() };
    });
    const approvedAlert = result.alert;
    ok(res, { item: result, message: approvedAlert === 'Overbilling' ? 'Approved with overbilling alert' : 'Approved' });
  }),
);

router.post(
  '/invoices/:id/reject',
  requireRole('admin', 'director', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const inv = await client.query('select * from surveyor_invoices where id = $1 and company_id = $2', [id, COMPANY(req)]);
      if (!inv.rows[0]) throw new AppError(404, 'Invoice not found');
      const invRow = inv.rows[0];
      if (invRow.approval_status === 'Approved') throw new AppError(409, 'Invoice already approved; reopen first to reject');
      await client.query(
        `update surveyor_invoices set approval_status = 'Rejected', alert = null, approved_by = $1, approved_at = now(), updated_at = now() where id = $2`,
        [req.user!.id, id],
      );
      await logApproval(client, COMPANY(req), {
        contract_code: invRow.contract_id ? (await client.query('select contract_code from surveyor_contracts where id = $1', [invRow.contract_id])).rows[0]?.contract_code : null,
        invoice_no: invRow.invoice_no,
        amount: Number(invRow.amount),
        prev_status: invRow.approval_status,
        action: 'Rejected',
        remarks: req.body?.remarks ?? 'Rejected during review',
        user_id: req.user!.id,
        user_email: req.user!.email,
      });
      await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'REJECT', entity: 'surveyor_invoice', entity_id: id, details: req.body });
      return { ...invRow, approval_status: 'Rejected' };
    });
    ok(res, { item: result, message: 'Rejected' });
  }),
);

router.post(
  '/invoices/:id/reopen',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const result = await transact(async (client) => {
      const inv = await client.query('select * from surveyor_invoices where id = $1 and company_id = $2', [id, COMPANY(req)]);
      if (!inv.rows[0]) throw new AppError(404, 'Invoice not found');
      const invRow = inv.rows[0];
      const used = await client.query(
        `select count(*)::int as n from pay_order_lines pl join pay_orders po on po.id = pl.pay_order_id
         where pl.surveyor_invoice_id = $1 and po.status <> 'cancelled'`,
        [id],
      );
      if (used.rows[0].n > 0) throw new AppError(409, 'Invoice is already included in a pay order');
      await client.query(
        `update surveyor_invoices set approval_status = 'Pending', alert = null, approved_by = null, approved_at = null, approved_snapshot = null, updated_at = now() where id = $1`,
        [id],
      );
      await logApproval(client, COMPANY(req), {
        contract_code: invRow.contract_id ? (await client.query('select contract_code from surveyor_contracts where id = $1', [invRow.contract_id])).rows[0]?.contract_code : null,
        invoice_no: invRow.invoice_no,
        amount: Number(invRow.amount),
        prev_status: invRow.approval_status,
        action: 'Reopened',
        remarks: 'Moved back to pending for review',
        user_id: req.user!.id,
        user_email: req.user!.email,
      });
      return { ...invRow, approval_status: 'Pending' };
    });
    ok(res, { item: result, message: 'Reopened' });
  }),
);

// ---------------------------------------------------------------------------
// Pay orders
// ---------------------------------------------------------------------------

router.get(
  '/pay-orders',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const status = req.query.status ? String(req.query.status) : null;
    const vendor = req.query.vendor ? String(req.query.vendor) : null;
    const minAmount = req.query.min_amount ? Number(req.query.min_amount) : null;
    const maxAmount = req.query.max_amount ? Number(req.query.max_amount) : null;
    const sort = sortSpec(req, {
      pay_order_no: 'po.pay_order_no', vendor: 'po.vendor', amount: 'po.amount',
      pay_method: 'po.pay_method', cheque_no: 'po.cheque_no',
      status: 'po.status', created_at: 'po.created_at', issued_at: 'po.issued_at',
      paid_at: 'po.paid_at',
    });
    const params: unknown[] = [COMPANY(req)];
    const conds: string[] = ['po.company_id = $1'];
    let n = 1;
    if (search) {
      n += 1; params.push(search);
      conds.push(`(po.pay_order_no ilike '%'||$${n}||'%' or po.vendor ilike '%'||$${n}||'%' or po.cheque_no ilike '%'||$${n}||'%')`);
    }
    if (status) { n += 1; params.push(status); conds.push(`po.status = $${n}`); }
    if (vendor) { n += 1; params.push(vendor); conds.push(`po.vendor = $${n}`); }
    if (minAmount !== null && !Number.isNaN(minAmount)) { n += 1; params.push(minAmount); conds.push(`po.amount >= $${n}`); }
    if (maxAmount !== null && !Number.isNaN(maxAmount)) { n += 1; params.push(maxAmount); conds.push(`po.amount <= $${n}`); }
    const result = await pool.query(
      `select po.*, o.name as originator_name, ap.name as approved_by_name, fp.name as finance_passed_by_name
       from pay_orders po
       left join users o on o.id = po.originator
       left join users ap on ap.id = po.approved_by
       left join users fp on fp.id = po.finance_passed_by
       where ${conds.join(' and ')} order by ${sort ? `${sort.expr} ${sort.dir}` : 'po.created_at desc'}`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/pay-orders/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const po = await pool.query(
      `select po.*, o.name as originator_name, ap.name as approved_by_name, fp.name as finance_passed_by_name
       from pay_orders po
       left join users o on o.id = po.originator
       left join users ap on ap.id = po.approved_by
       left join users fp on fp.id = po.finance_passed_by
       where po.id = $1 and po.company_id = $2`,
      [id, COMPANY(req)],
    );
    if (!po.rows[0]) throw new AppError(404, 'Pay order not found');
    const lines = await pool.query(
      `select pl.* from pay_order_lines pl where pl.pay_order_id = $1 order by pl.id`,
      [id],
    );
    ok(res, { item: po.rows[0], lines: lines.rows });
  }),
);

router.post(
  '/pay-orders',
  requireRole('admin', 'accountant', 'director'),
  validateBody([{ key: 'invoice_ids', required: true }]),
  asyncHandler(async (req: AuthRequest, res) => {
    const invoiceIds: string[] = req.body.invoice_ids;
    if (!Array.isArray(invoiceIds) || !invoiceIds.length) throw new AppError(422, 'Select at least one approved invoice');
    if (invoiceIds.length > 200) throw new AppError(422, 'Too many invoices in a single pay order');

    const result = await transact(async (client) => {
      const ids = invoiceIds.map((i) => parseId(i));
      const inv = await client.query(
        `select si.*, c.contract_code from surveyor_invoices si
         left join surveyor_contracts c on c.id = si.contract_id
         where si.id = any($1) and si.company_id = $2`,
        [ids, COMPANY(req)],
      );
      if (inv.rows.length !== ids.length) throw new AppError(422, 'One or more invoices not found');
      for (const row of inv.rows) {
        if (row.approval_status !== 'Approved') throw new AppError(409, `Invoice ${row.invoice_no} is not approved`);
        const used = await client.query('select count(*)::int as n from pay_order_lines pl join pay_orders po on po.id = pl.pay_order_id where pl.surveyor_invoice_id = $1 and po.status <> \'cancelled\'', [row.id]);
        if (used.rows[0].n > 0) throw new AppError(409, `Invoice ${row.invoice_no} is already in a pay order`);
      }

      const vendors = new Set(inv.rows.map((r) => r.vendor));
      if (vendors.size > 1) throw new AppError(422, 'All invoices in a pay order must belong to the same vendor');
      const vendor = inv.rows[0].vendor;
      const total = round2(inv.rows.reduce((s: number, r: any) => s + Number(r.amount), 0));

      const payOrderNo = await nextEntryNo('PO-', 'pay_orders', 'pay_order_no', client);
      const services = Array.from(new Set(inv.rows.map((r) => r.service_type_3).filter(Boolean))).join(', ');
      const narrative = services
        ? `ON ACCOUNT OF PAYMENT IN RESPECT OF ${services}`
        : `ON ACCOUNT OF PAYMENT IN RESPECT OF Surveying Services - ${vendor}`;

      const po = await client.query(
        `insert into pay_orders (company_id, pay_order_no, vendor, pay_method, cheque_no, order_no, vendor_no, amount, amount_in_words, narrative, status, originator, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12) returning *`,
        [COMPANY(req), payOrderNo, vendor, req.body.pay_method || 'cheque', req.body.cheque_no ?? null, req.body.order_no ?? null,
         req.body.vendor_no ?? null, total, rupeesInWords(total), narrative, req.user!.id, req.user!.id],
      );

      for (const row of inv.rows) {
        await client.query(
          `insert into pay_order_lines (pay_order_id, surveyor_invoice_id, description, tanker_name, invoice_no, invoice_date, services_month, cargo_no, cost_center, cost_element, amount)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [po.rows[0].id, row.id, row.service_type_3 ?? `Surveying Services - ${row.vendor}`, row.tanker_name ?? null,
           row.invoice_no, row.invoice_date ?? null, row.services_month ?? null, row.item_no ?? null,
           null, row.cost_element ?? null, row.amount],
        );
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE', entity: 'pay_order', entity_id: po.rows[0].id, details: { invoice_ids: ids, amount: total } });
      return { item: po.rows[0], lines: inv.rows };
    });
    ok(res, result, 201);
  }),
);

const PAY_ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

const setPayOrderStatus = async (req: AuthRequest, res: Response, id: string, status: string, extra: Record<string, unknown>, message: string) => {
  const cur = await pool.query('select status from pay_orders where id = $1 and company_id = $2', [id, COMPANY(req)]);
  if (!cur.rows[0]) throw new AppError(404, 'Pay order not found');
  const from = cur.rows[0].status ?? 'draft';
  if (!(PAY_ORDER_TRANSITIONS[from] ?? []).includes(status)) {
    throw new AppError(409, `Pay order cannot move from '${from}' to '${status}'`);
  }
  const params: unknown[] = [id, COMPANY(req), status];
  const sets: string[] = [`status = $3`];
  for (const [k, v] of Object.entries(extra)) {
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  params.push(new Date().toISOString());
  sets.push(`updated_at = $${params.length}`);
  const result = await pool.query(`update pay_orders set ${sets.join(', ')} where id = $1 and company_id = $2 returning *`, params);
  if (!result.rows[0]) throw new AppError(404, 'Pay order not found');
  await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: status.toUpperCase(), entity: 'pay_order', entity_id: id, details: req.body });
  ok(res, { item: result.rows[0], message });
};

router.post(
  '/pay-orders/auto-generate',
  requireRole('admin', 'accountant', 'director'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = req.body?.vendor ? String(req.body.vendor) : null;
    const created = await transact(async (client) => {
      const avail = await client.query(
        `select si.*, c.contract_code from surveyor_invoices si
         left join surveyor_contracts c on c.id = si.contract_id
         where si.company_id = $1 and si.approval_status = 'Approved'
           and not exists (
             select 1 from pay_order_lines pl join pay_orders po on po.id = pl.pay_order_id
             where pl.surveyor_invoice_id = si.id and po.status <> 'cancelled')
           and ($2::text is null or si.vendor = $2)
         order by si.vendor, si.invoice_no`,
        [COMPANY(req), vendor],
      );
      if (!avail.rows.length) {
        throw new AppError(400, vendor ? `No approved invoices available to pay for vendor '${vendor}'` : 'No approved invoices available to pay');
      }
      const groups = new Map<string, any[]>();
      for (const r of avail.rows) {
        const list = groups.get(r.vendor) ?? [];
        list.push(r);
        groups.set(r.vendor, list);
      }
      const created: any[] = [];
      for (const [v, rows] of groups) {
        const total = round2(rows.reduce((s: number, r: any) => s + Number(r.amount), 0));
        const payOrderNo = await nextEntryNo('PO-', 'pay_orders', 'pay_order_no', client);
        const services = Array.from(new Set(rows.map((r) => r.service_type_3).filter(Boolean))).join(', ');
        const narrative = services
          ? `ON ACCOUNT OF PAYMENT IN RESPECT OF ${services}`
          : `ON ACCOUNT OF PAYMENT IN RESPECT OF Surveying Services - ${v}`;
        const po = await client.query(
          `insert into pay_orders (company_id, pay_order_no, vendor, pay_method, order_no, amount, amount_in_words, narrative, status, originator, created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10) returning *`,
          [COMPANY(req), payOrderNo, v, req.body?.pay_method ?? 'cheque', req.body?.order_no ?? null,
           total, rupeesInWords(total), narrative, req.user!.id, req.user!.id],
        );
        for (const row of rows) {
          await client.query(
            `insert into pay_order_lines (pay_order_id, surveyor_invoice_id, description, tanker_name, invoice_no, invoice_date, services_month, cargo_no, cost_center, cost_element, amount)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [po.rows[0].id, row.id, row.service_type_3 ?? `Surveying Services - ${row.vendor}`, row.tanker_name ?? null,
             row.invoice_no, row.invoice_date ?? null, row.services_month ?? null, row.item_no ?? null,
             null, row.cost_element ?? null, row.amount],
          );
        }
        await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: 'AUTO_GENERATE', entity: 'pay_order', entity_id: po.rows[0].id, details: { vendor: v, invoice_count: rows.length, amount: total } });
        created.push({ ...po.rows[0], invoice_count: rows.length, amount_in_words: po.rows[0].amount_in_words });
      }
      return created;
    });
    ok(res, { items: created, message: `Generated ${created.length} pay order(s)` }, 201);
  }),
);

router.post(
  '/pay-orders/:id/issue',
  requireRole('admin', 'director', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const po = await pool.query('select status from pay_orders where id = $1 and company_id = $2', [id, COMPANY(req)]);
    if (!po.rows[0]) throw new AppError(404, 'Pay order not found');
    if (po.rows[0].status === 'paid') throw new AppError(409, 'Pay order already paid');
    await setPayOrderStatus(req, res, id, 'issued', { issued_at: new Date().toISOString(), approved_by: req.user!.id, finance_passed_by: req.user!.id, cheque_no: req.body?.cheque_no ?? po.rows[0].cheque_no }, 'Pay order issued');
  }),
);

router.post(
  '/pay-orders/:id/pay',
  requireRole('admin', 'director', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    await setPayOrderStatus(req, res, id, 'paid', { paid_at: new Date().toISOString(), finance_passed_by: req.user!.id }, 'Pay order marked as paid');
  }),
);

router.post(
  '/pay-orders/:id/cancel',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    await setPayOrderStatus(req, res, id, 'cancelled', { remarks: req.body?.remarks ?? 'Cancelled' }, 'Pay order cancelled');
  }),
);

// ---------------------------------------------------------------------------
// Approval log
// ---------------------------------------------------------------------------

router.get(
  '/approval-log',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const params: unknown[] = [COMPANY(req)];
    let extra = '';
    if (search) {
      params.push(search);
      extra = ` and (l.invoice_no ilike '%'||$2||'%' or l.contract_code ilike '%'||$2||'%')`;
    }
    const result = await pool.query(
      `select l.*, u.name as user_name from surveyor_approval_logs l
       left join users u on u.id = l.user_id
       where l.company_id = $1${extra} order by l.created_at desc limit 500`,
      params,
    );
    ok(res, { items: result.rows });
  }),
);

// ---------------------------------------------------------------------------
// Control tower / dashboard
// ---------------------------------------------------------------------------

router.get(
  '/dashboard',
  asyncHandler(async (req: AuthRequest, res) => {
    const companyId = COMPANY(req);

    const totals = await pool.query(
      `select count(*)::int as total_invoices,
              coalesce(sum(amount), 0) as total_amount,
              coalesce(sum(case when approval_status = 'Approved' then amount else 0 end), 0) as approved_amount,
              coalesce(sum(case when approval_status = 'Pending' then amount else 0 end), 0) as pending_amount,
              count(*) filter (where approval_status = 'Pending')::int as pending_count,
              count(*) filter (where alert = 'Overbilling')::int as overbilling_count,
              count(distinct vendor)::int as vendor_count
       from surveyor_invoices where company_id = $1`,
      [companyId],
    );
    const contracts = await pool.query(
      `select count(*) filter (where status = 'open' or status is null)::int as open_contracts,
              coalesce(sum(contract_value), 0) as contract_value,
              (select coalesce(sum(amount), 0) from surveyor_invoices where company_id = $1 and approval_status = 'Approved') as consumed
       from surveyor_contracts where company_id = $1`,
      [companyId],
    );
    const vendors = await pool.query(
      `select vendor, count(*)::int as invoice_count,
              coalesce(sum(amount), 0) as total_amount,
              coalesce(sum(case when approval_status = 'Approved' then amount else 0 end), 0) as approved_amount,
              count(*) filter (where approval_status = 'Pending')::int as pending_count
       from surveyor_invoices where company_id = $1 group by vendor order by total_amount desc`,
      [companyId],
    );
    const monthly = await pool.query(
      `select to_char(date_trunc('month', services_month), 'YYYY-MM') as month,
              coalesce(sum(amount), 0) as amount, count(*)::int as invoice_count
       from surveyor_invoices where company_id = $1 and services_month is not null
       group by 1 order by 1`,
      [companyId],
    );
    const recent = await pool.query(
      `select si.invoice_no, si.vendor, si.amount, si.approval_status, si.alert, si.created_at
       from surveyor_invoices si where si.company_id = $1 order by si.created_at desc limit 10`,
      [companyId],
    );

    const t = totals.rows[0];
    const c = contracts.rows[0];
    ok(res, {
      summary: {
        total_invoices: t.total_invoices,
        total_amount: round2(Number(t.total_amount)),
        approved_amount: round2(Number(t.approved_amount)),
        pending_amount: round2(Number(t.pending_amount)),
        pending_count: t.pending_count,
        overbilling_count: t.overbilling_count,
        vendor_count: t.vendor_count,
        open_contracts: c.open_contracts,
        contract_value: round2(Number(c.contract_value)),
        contract_consumed: round2(Number(c.consumed)),
      },
      vendors: vendors.rows.map((v) => ({ ...v, total_amount: round2(Number(v.total_amount)), approved_amount: round2(Number(v.approved_amount)) })),
      monthly: monthly.rows.map((m) => ({ month: m.month, amount: round2(Number(m.amount)), invoice_count: m.invoice_count })),
      recent: recent.rows,
    });
  }),
);

// Invoice / contract recall queries (Control Tower)
router.get(
  '/recall',
  asyncHandler(async (req: AuthRequest, res) => {
    const invoice = req.query.invoice ? String(req.query.invoice) : null;
    const contract = req.query.contract ? String(req.query.contract) : null;

    if (invoice) {
      const result = await pool.query(
        `select si.id, si.invoice_no, si.invoice_date, si.vendor, si.amount, si.approval_status, si.alert, si.tanker_name,
                si.services_month, si.item_no, c.contract_code, c.contractor
         from surveyor_invoices si
         left join surveyor_contracts c on c.id = si.contract_id
         where si.company_id = $1 and (si.invoice_no ilike '%'||$2||'%' or si.serial_no ilike '%'||$2||'%')
         order by si.created_at desc limit 50`,
        [COMPANY(req), invoice],
      );
      return ok(res, { kind: 'invoice', items: result.rows });
    }
    if (contract) {
      const c = await pool.query(
        `select c.*, coalesce((select sum(i.amount) from surveyor_invoices i where i.contract_id = c.id and i.approval_status = 'Approved'), 0) as used_amount,
                (select count(*) from surveyor_invoices i where i.contract_id = c.id)::int as invoice_count
         from surveyor_contracts c where c.company_id = $1 and c.contract_code ilike '%'||$2||'%'`,
        [COMPANY(req), contract],
      );
      const items = c.rows.map((r: any) => ({
        ...r,
        used_amount: round2(Number(r.used_amount)),
        remaining_amount: round2(Number(r.contract_value) - Number(r.used_amount)),
        utilization: Number(r.contract_value) ? round2(Number(r.used_amount) / Number(r.contract_value)) : 0,
      }));
      return ok(res, { kind: 'contract', items });
    }
    throw new AppError(422, 'Provide either invoice or contract parameter');
  }),
);

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

router.get(
  '/analysis',
  asyncHandler(async (req: AuthRequest, res) => {
    const companyId = COMPANY(req);
    const byVendor = await pool.query(
      `select vendor, count(*)::int as invoice_count, coalesce(sum(amount), 0) as total_amount,
              coalesce(avg(amount), 0) as avg_amount
       from surveyor_invoices where company_id = $1 group by vendor order by total_amount desc`,
      [companyId],
    );
    const byService = await pool.query(
      `select coalesce(service_type_3, 'Unspecified') as service, count(*)::int as invoice_count,
              coalesce(sum(amount), 0) as total_amount
       from surveyor_invoices where company_id = $1 group by 1 order by total_amount desc`,
      [companyId],
    );
    const byMonth = await pool.query(
      `select to_char(date_trunc('month', services_month), 'YYYY-MM') as month,
              coalesce(sum(amount), 0) as total_amount, count(*)::int as invoice_count
       from surveyor_invoices where company_id = $1 and services_month is not null
       group by 1 order by 1`,
      [companyId],
    );
    const byApproval = await pool.query(
      `select approval_status, count(*)::int as invoice_count, coalesce(sum(amount), 0) as total_amount
       from surveyor_invoices where company_id = $1 group by 1`,
      [companyId],
    );
    ok(res, {
      by_vendor: byVendor.rows.map((r) => ({ ...r, total_amount: round2(Number(r.total_amount)), avg_amount: round2(Number(r.avg_amount)) })),
      by_service: byService.rows.map((r) => ({ ...r, total_amount: round2(Number(r.total_amount)) })),
      by_month: byMonth.rows.map((r) => ({ ...r, total_amount: round2(Number(r.total_amount)) })),
      by_approval: byApproval.rows.map((r) => ({ ...r, total_amount: round2(Number(r.total_amount)) })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Export (CSV / PDF) — authorized finance, audit and management roles
// ---------------------------------------------------------------------------

const EXPORT_COLUMNS: Record<string, { label: string; sql: string; format?: (v: unknown, r: any) => string }[]> = {
  invoices: [
    { label: 'Invoice No', sql: 'si.invoice_no' },
    { label: 'Vendor', sql: 'si.vendor' },
    { label: 'Contract Code', sql: 'c.contract_code' },
    { label: 'Tanker', sql: 'si.tanker_name' },
    { label: 'Amount', sql: 'si.amount' },
    { label: 'Invoice Date', sql: 'si.invoice_date' },
    { label: 'Services Month', sql: 'si.services_month' },
    { label: 'Status', sql: 'si.approval_status' },
    { label: 'Alert', sql: 'si.alert' },
  ],
  contracts: [
    { label: 'Contract Code', sql: 'c.contract_code' },
    { label: 'Contractor', sql: 'c.contractor' },
    { label: 'Service Type', sql: 'c.service_type' },
    { label: 'Contract Value', sql: 'c.contract_value' },
    { label: 'Start Date', sql: 'c.start_date' },
    { label: 'End Date', sql: 'c.end_date' },
    { label: 'Status', sql: 'c.status' },
  ],
  'pay-orders': [
    { label: 'Pay Order No', sql: 'po.pay_order_no' },
    { label: 'Vendor', sql: 'po.vendor' },
    { label: 'Pay Method', sql: 'po.pay_method' },
    { label: 'Cheque No', sql: 'po.cheque_no' },
    { label: 'Amount', sql: 'po.amount' },
    { label: 'Status', sql: 'po.status' },
    { label: 'Issued At', sql: 'po.issued_at' },
    { label: 'Paid At', sql: 'po.paid_at' },
  ],
};

const EXPORT_QUERY: Record<string, string> = {
  invoices: `select si.invoice_no, si.vendor, c.contract_code, si.tanker_name, si.amount,
                    to_char(si.invoice_date, 'YYYY-MM-DD') as invoice_date,
                    to_char(si.services_month, 'YYYY-MM') as services_month,
                    si.approval_status, coalesce(si.alert, '') as alert
             from surveyor_invoices si
             left join surveyor_contracts c on c.id = si.contract_id
             where si.company_id = $1 order by si.invoice_no`,
  contracts: `select c.contract_code, c.contractor, c.service_type, c.contract_value,
                     to_char(c.start_date, 'YYYY-MM-DD') as start_date,
                     to_char(c.end_date, 'YYYY-MM-DD') as end_date, c.status
              from surveyor_contracts c where c.company_id = $1 order by c.contract_code`,
  'pay-orders': `select po.pay_order_no, po.vendor, po.pay_method, coalesce(po.cheque_no, '') as cheque_no,
                        po.amount, po.status,
                        to_char(po.issued_at, 'YYYY-MM-DD HH24:MI') as issued_at,
                        to_char(po.paid_at, 'YYYY-MM-DD HH24:MI') as paid_at
                 from pay_orders po where po.company_id = $1 order by po.created_at`,
};

const exportType = (t: string | undefined): 'invoices' | 'contracts' | 'pay-orders' => {
  if (t === 'contracts' || t === 'pay-orders') return t;
  return 'invoices';
};

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get(
  '/export/csv',
  requireRole('admin', 'director', 'accountant', 'auditor'),
  asyncHandler(async (req: AuthRequest, res) => {
    const type = exportType(req.query.type ? String(req.query.type) : undefined);
    const result = await pool.query(EXPORT_QUERY[type], [COMPANY(req)]);
    const cols = EXPORT_COLUMNS[type];
    const header = cols.map((c) => c.label).join(',');
    const lines = result.rows.map((r) => cols.map((c) => csvCell(r[c.label.toLowerCase().replace(/\s+/g, '_')])).join(','));
    const csv = [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`surveyors_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  }),
);

router.get(
  '/export/pdf',
  requireRole('admin', 'director', 'accountant', 'auditor'),
  asyncHandler(async (req: AuthRequest, res) => {
    const type = exportType(req.query.type ? String(req.query.type) : undefined);
    const result = await pool.query(EXPORT_QUERY[type], [COMPANY(req)]);
    const cols = EXPORT_COLUMNS[type];

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (ch: Buffer) => chunks.push(ch));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.attachment(`surveyors_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
      res.send(Buffer.concat(chunks));
    });

    doc.fontSize(14).fillColor('#0f172a').text(`Pakistan Refinery Limited`, { align: 'center' });
    doc.fontSize(11).fillColor('#475569').text(`Surveyor ${type === 'invoices' ? 'Invoices' : type === 'contracts' ? 'Contracts' : 'Pay Orders'} — ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(0.6);

    const widths = cols.map((_, i) => (i === 0 ? 130 : 80));
    const rowHeight = 18;
    let y = doc.y;
    const drawHeader = () => {
      doc.rect(36, y, 523, rowHeight).fill('#1e293b');
      let x = 36;
      cols.forEach((c, i) => {
        doc.fillColor('#f8fafc').fontSize(8).font('Helvetica-Bold').text(c.label, x + 4, y + 5, { width: widths[i] - 8 });
        x += widths[i];
      });
      y += rowHeight;
    };
    const drawRow = (r: any) => {
      doc.rect(36, y, 523, rowHeight).fill(y % (rowHeight * 2) === 0 ? '#f1f5f9' : '#ffffff');
      let x = 36;
      cols.forEach((c, i) => {
        const raw = c.label.toLowerCase().replace(/\s+/g, '_');
        const v = r[raw] ?? '';
        const text = typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica').text(text, x + 4, y + 5, { width: widths[i] - 8, ellipsis: true });
        x += widths[i];
      });
      y += rowHeight;
    };

    drawHeader();
    for (const r of result.rows) {
      if (y > 760) { doc.addPage(); y = 36; drawHeader(); }
      drawRow(r);
    }
    doc.end();
  }),
);

export default router;
