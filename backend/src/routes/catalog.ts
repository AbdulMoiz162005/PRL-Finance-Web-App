import { Router } from 'express';
import { makeCrud } from './crud';

const router = Router();

router.use(
  '/products',
  makeCrud({
    table: 'products',
    searchFields: ['code', 'name', 'category'],
    orderBy: 'code',
    select: `products.*, tc.code as tax_code, tc.rate as tax_rate,
             sa.code as sales_account_code, sa.name as sales_account_name,
             ca.code as cogs_account_code, ca.name as cogs_account_name,
             ia.code as inventory_account_code, ia.name as inventory_account_name`,
    joins: `left join tax_codes tc on tc.id = products.tax_code_id
            left join chart_of_accounts sa on sa.id = products.sales_account_id
            left join chart_of_accounts ca on ca.id = products.cogs_account_id
            left join chart_of_accounts ia on ia.id = products.inventory_account_id`,
    insertFields: ['code', 'name', 'category', 'unit', 'tax_code_id', 'valuation_method', 'opening_qty', 'opening_unit_cost', 'sales_account_id', 'cogs_account_id', 'inventory_account_id', 'is_active'],
    updateFields: ['code', 'name', 'category', 'unit', 'tax_code_id', 'valuation_method', 'opening_qty', 'opening_unit_cost', 'sales_account_id', 'cogs_account_id', 'inventory_account_id', 'is_active'],
    writeRoles: ['admin', 'accountant', 'manager'],
  }),
);

router.use(
  '/storages',
  makeCrud({
    table: 'storages',
    searchFields: ['code', 'name'],
    orderBy: 'code',
    select: `storages.*, p.code as product_code, p.name as product_name`,
    joins: `left join products p on p.id = storages.product_id`,
    insertFields: ['code', 'name', 'kind', 'capacity', 'product_id', 'is_active'],
    updateFields: ['code', 'name', 'kind', 'capacity', 'product_id', 'is_active'],
    writeRoles: ['admin', 'manager'],
  }),
);

router.use(
  '/bank-accounts',
  makeCrud({
    table: 'bank_accounts',
    searchFields: ['name', 'bank_name', 'account_number'],
    orderBy: 'name',
    select: `bank_accounts.*, coa.code as coa_code, coa.name as coa_name`,
    joins: `left join chart_of_accounts coa on coa.id = bank_accounts.coa_id`,
    insertFields: ['name', 'bank_name', 'account_number', 'currency', 'coa_id', 'opening_balance', 'is_active'],
    updateFields: ['name', 'bank_name', 'account_number', 'currency', 'coa_id', 'opening_balance', 'is_active'],
    writeRoles: ['admin', 'accountant'],
  }),
);

export default router;
