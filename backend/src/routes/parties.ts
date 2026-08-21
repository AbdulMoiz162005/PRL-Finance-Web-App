import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok } from '../utils';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { makeCrud } from './crud';

const router = Router();
router.use(requireAuth);

// Active suppliers only — governed vendor list for dropdowns
router.get(
  '/supplier-options',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select code, name, name as label from suppliers
       where company_id = $1 and status = 'active' order by name`,
      [req.user!.companyId],
    );
    ok(res, { items: result.rows });
  }),
);

router.use(
  '/customers',
  makeCrud({
    table: 'customers',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'tax_id', 'contact_person', 'phone', 'email', 'address', 'credit_limit', 'payment_term_days', 'opening_balance', 'status'],
    updateFields: ['code', 'name', 'tax_id', 'contact_person', 'phone', 'email', 'address', 'credit_limit', 'payment_term_days', 'opening_balance', 'status'],
    writeRoles: ['admin', 'accountant', 'manager'],
  }),
);

router.use(
  '/suppliers',
  makeCrud({
    table: 'suppliers',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'tax_id', 'contact_person', 'phone', 'email', 'address', 'payment_term_days', 'opening_balance', 'status'],
    updateFields: ['code', 'name', 'tax_id', 'contact_person', 'phone', 'email', 'address', 'payment_term_days', 'opening_balance', 'status'],
    writeRoles: ['admin', 'accountant', 'manager'],
  }),
);

export default router;
