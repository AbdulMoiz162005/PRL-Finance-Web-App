import { Router } from 'express';
import { transact, pool } from '../db';
import { asyncHandler, ok, AppError, audit } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { parseId } from '../middleware/validate';
import { postSaleGl, postPurchaseGl, recordInventory, loadProducts, getAccountId } from './invoices';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const status = req.query.status ? String(req.query.status) : 'pending';
    const result = await pool.query(
      `select r.*, u.name as requested_by_name, ru.name as reviewed_by_name
       from approval_requests r
       left join users u on u.id = r.requested_by
       left join users ru on ru.id = r.reviewed_by
       where r.company_id = $1 and r.status = $2
       order by r.requested_at`,
      [req.user!.companyId, status],
    );
    ok(res, { items: result.rows });
  }),
);

router.get(
  '/pending-count',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      'select count(*)::int as count from approval_requests where company_id = $1 and status = $2',
      [req.user!.companyId, 'pending'],
    );
    ok(res, { count: result.rows[0].count });
  }),
);

router.post(
  '/:id/decision',
  requireRole('director', 'admin', 'manager'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const decision = req.body.decision; // approved | rejected
    if (!['approved', 'rejected'].includes(decision)) throw new AppError(422, 'decision must be approved or rejected');

    await transact(async (client) => {
      const reqRow = await client.query(
        'select * from approval_requests where id = $1 and company_id = $2 and status = $3 for update',
        [id, req.user!.companyId, 'pending'],
      );
      if (!reqRow.rows[0]) throw new AppError(404, 'Approval request not found or already reviewed');
      const ar = reqRow.rows[0];

      await client.query(
        `update approval_requests set status=$1, reviewed_by=$2, reviewed_at=now(), comment=$3 where id = $4`,
        [decision, req.user!.id, req.body.comment ?? null, id],
      );

      if (decision === 'rejected') {
        if (ar.entity_type === 'journal') {
          await client.query(`update journal_entries set approval_status='rejected', updated_at=now() where id = $1`, [ar.entity_id]);
        } else if (ar.entity_type === 'invoice') {
          await client.query(`update invoices set approval_status='rejected', status='draft', updated_at=now() where id = $1`, [ar.entity_id]);
        } else if (ar.entity_type === 'purchase_invoice') {
          await client.query(`update purchase_invoices set approval_status='rejected', status='draft', updated_at=now() where id = $1`, [ar.entity_id]);
        }
      } else {
        if (ar.entity_type === 'journal') {
          await client.query(
            `update journal_entries set approval_status='approved', approved_by=$1, approved_at=now(), updated_at=now() where id = $2`,
            [req.user!.id, ar.entity_id],
          );
        } else if (ar.entity_type === 'invoice') {
          const inv = await client.query('select * from invoices where id = $1 for update', [ar.entity_id]);
          if (inv.rows[0]) {
            const productMap = await loadProducts(client, req.user!.companyId);
            const lines = await client.query('select * from invoice_lines where invoice_id = $1', [ar.entity_id]);
            const entryId = await postSaleGl(client, req.user!.companyId, req.user!.id, inv.rows[0], lines.rows, productMap, await getAccountId(client, req.user!.companyId, '1200'), await getAccountId(client, req.user!.companyId, '2300'));
            await client.query(
              `update invoices set approval_status='approved', approved_by=$1, approved_at=now(), status='issued', journal_entry_id=$2, updated_at=now() where id = $3`,
              [req.user!.id, entryId, ar.entity_id],
            );
            await recordInventory(client, req.user!.companyId, req.user!.id, lines.rows, 'sale', 'invoice', ar.entity_id, inv.rows[0].invoice_date, productMap);
          }
        } else if (ar.entity_type === 'purchase_invoice') {
          const inv = await client.query('select * from purchase_invoices where id = $1 for update', [ar.entity_id]);
          if (inv.rows[0]) {
            const productMap = await loadProducts(client, req.user!.companyId);
            const lines = await client.query('select * from purchase_invoice_lines where purchase_invoice_id = $1', [ar.entity_id]);
            const entryId = await postPurchaseGl(client, req.user!.companyId, req.user!.id, inv.rows[0], lines.rows, productMap, await getAccountId(client, req.user!.companyId, '2100'), await getAccountId(client, req.user!.companyId, '2310'));
            await client.query(
              `update purchase_invoices set approval_status='approved', approved_by=$1, approved_at=now(), status='issued', journal_entry_id=$2, updated_at=now() where id = $3`,
              [req.user!.id, entryId, ar.entity_id],
            );
            await recordInventory(client, req.user!.companyId, req.user!.id, lines.rows, 'purchase', 'purchase_invoice', ar.entity_id, inv.rows[0].bill_date, productMap);
          }
        }
      }
      await audit(client, { user_id: req.user!.id, user_email: req.user!.email, action: `APPROVAL_${decision.toUpperCase()}`, entity: ar.entity_type, entity_id: ar.entity_id, details: { request_id: id, entity_no: ar.entity_no, comment: req.body.comment ?? null } });
    });
    ok(res, { processed: decision });
  }),
);

export default router;
