import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok, audit } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get(
  '/company',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query('select * from companies where id = $1', [req.user!.companyId]);
    ok(res, { company: result.rows[0] });
  }),
);

router.put(
  '/company',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const c = req.body;
    const result = await pool.query(
      `update companies set
         name = $1, legal_name = $2, tax_id = $3, address = $4, phone = $5, email = $6,
         currency = $7, fiscal_year_start = $8, registration_no = $9, logo_url = $10, updated_at = now()
       where id = $11 returning *`,
      [
        c.name, c.legal_name ?? null, c.tax_id ?? null, c.address ?? null, c.phone ?? null,
        c.email ?? null, c.currency ?? 'USD', c.fiscal_year_start ?? null, c.registration_no ?? null,
        c.logo_url ?? null, req.user!.companyId,
      ],
    );
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'UPDATE_COMPANY', entity: 'companies', entity_id: req.user!.companyId });
    ok(res, { company: result.rows[0] });
  }),
);

router.get(
  '/approval-threshold',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      'select min_amount, max_amount, role from approval_rules where company_id = $1 and is_active order by min_amount',
      [req.user!.companyId],
    );
    ok(res, { rules: result.rows });
  }),
);

export default router;
