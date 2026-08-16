import { Router } from 'express';
import { makeCrud } from './crud';

const router = Router();

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
