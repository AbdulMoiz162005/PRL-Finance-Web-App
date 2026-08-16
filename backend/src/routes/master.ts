import { Router } from 'express';
import { makeCrud } from './crud';

const router = Router();

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
