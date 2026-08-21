import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok } from '../utils';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { makeCrud } from './crud';

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Reference options (active-only, for dropdowns across modules)
// ---------------------------------------------------------------------------
const optionList = async (req: AuthRequest, res: any, table: string, labelExpr: string, extraWhere = '') => {
  const result = await pool.query(
    `select code, name, ${labelExpr} as label from ${table}
     where company_id = $1 and is_active = true ${extraWhere} order by name`,
    [req.user!.companyId],
  );
  ok(res, { items: result.rows });
};

router.get(
  '/options/service-types',
  asyncHandler(async (req: AuthRequest, res) => {
    await optionList(req, res, 'service_types', 'name');
  }),
);

router.get(
  '/options/cost-elements',
  asyncHandler(async (req: AuthRequest, res) => {
    await optionList(req, res, 'cost_elements', 'name');
  }),
);

// ---------------------------------------------------------------------------
// Dictionary CRUD (management of governed dropdown values)
// ---------------------------------------------------------------------------
router.use(
  '/service-types',
  makeCrud({
    table: 'service_types',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'is_active'],
    updateFields: ['code', 'name', 'is_active'],
    writeRoles: ['admin', 'accountant'],
    auditEntity: 'service_type',
  }),
);

router.use(
  '/cost-elements',
  makeCrud({
    table: 'cost_elements',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'is_active'],
    updateFields: ['code', 'name', 'is_active'],
    writeRoles: ['admin', 'accountant'],
    auditEntity: 'cost_element',
  }),
);

router.use(
  '/accounts',
  makeCrud({
    table: 'chart_of_accounts',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'type', 'subtype', 'cash_flow_category', 'parent_id', 'is_postable', 'is_active', 'normal_balance', 'opening_balance', 'description'],
    updateFields: ['code', 'name', 'type', 'subtype', 'cash_flow_category', 'parent_id', 'is_postable', 'is_active', 'normal_balance', 'opening_balance', 'description'],
    writeRoles: ['admin', 'accountant'],
    auditEntity: 'chart_of_accounts',
  }),
);

router.use(
  '/cost-centers',
  makeCrud({
    table: 'cost_centers',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'description', 'is_active'],
    updateFields: ['code', 'name', 'description', 'is_active'],
    writeRoles: ['admin', 'accountant'],
  }),
);

router.use(
  '/tax-codes',
  makeCrud({
    table: 'tax_codes',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    insertFields: ['code', 'name', 'rate', 'is_active'],
    updateFields: ['code', 'name', 'rate', 'is_active'],
    writeRoles: ['admin', 'accountant'],
  }),
);

router.use(
  '/payment-terms',
  makeCrud({
    table: 'payment_terms',
    searchFields: ['name'],
    orderBy: 'name',
    insertFields: ['name', 'days'],
    updateFields: ['name', 'days'],
    writeRoles: ['admin', 'accountant'],
  }),
);

router.use(
  '/departments',
  makeCrud({
    table: 'departments',
    searchFields: ['name'],
    orderBy: 'name',
    insertFields: ['name'],
    updateFields: ['name'],
    writeRoles: ['admin'],
  }),
);

export default router;
