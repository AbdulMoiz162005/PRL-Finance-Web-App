import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok, AppError, audit } from '../utils';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { parseId } from '../middleware/validate';
import { parseSearch } from './parse';

export interface CrudConfig {
  table: string;
  insertFields: string[];
  updateFields: string[];
  searchFields?: string[];
  select?: string;
  joins?: string;
  orderBy?: string;
  writeRoles?: string[];
  filterSql?: string;
  filterParams?: (req: AuthRequest) => unknown[];
  auditEntity?: string;
}

export const makeCrud = (cfg: CrudConfig): Router => {
  const router = Router();
  const entity = cfg.auditEntity || cfg.table;

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req: AuthRequest, res) => {
      const { search } = parseSearch(req);
      const params: unknown[] = [req.user!.companyId];
      let where = `where ${cfg.table}.company_id = $1`;
      if (search && cfg.searchFields?.length) {
        const ors = cfg.searchFields.map((f) => `${cfg.table}.${f} ilike '%'||$${params.length + 1}||'%'`).join(' or ');
        where += ` and (${ors})`;
        params.push(search);
      }
      if (cfg.filterSql) {
        const extra = cfg.filterParams ? cfg.filterParams(req) : [];
        params.push(...extra);
        where += ` and ${cfg.filterSql}`;
      }
      const sql = `select ${cfg.select || `${cfg.table}.*`} from ${cfg.table} ${cfg.joins || ''} ${where} order by ${cfg.orderBy || `${cfg.table}.created_at desc`}`;
      const result = await pool.query(sql, params);
      ok(res, { items: result.rows });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req: AuthRequest, res) => {
      const id = parseId(req.params.id);
      const result = await pool.query(
        `select ${cfg.select || '*'} from ${cfg.table} ${cfg.joins || ''} where ${cfg.table}.id = $1 and ${cfg.table}.company_id = $2`,
        [id, req.user!.companyId],
      );
      if (!result.rows[0]) throw new AppError(404, 'Record not found');
      ok(res, { item: result.rows[0] });
    }),
  );

  router.post(
    '/',
    ...(cfg.writeRoles ? [requireRole(...cfg.writeRoles)] : []),
    asyncHandler(async (req: AuthRequest, res) => {
      const body = req.body || {};
      const fields = cfg.insertFields.filter((f) => body[f] !== undefined && body[f] !== null);
      const values = fields.map((f) => body[f]);
      const cols = ['company_id', ...fields];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const result = await pool.query(
        `insert into ${cfg.table} (${cols.join(', ')}) values (${placeholders}) returning *`,
        [req.user!.companyId, ...values],
      );
      await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE', entity, entity_id: result.rows[0].id, details: body });
      ok(res, { item: result.rows[0] }, 201);
    }),
  );

  router.patch(
    '/:id',
    ...(cfg.writeRoles ? [requireRole(...cfg.writeRoles)] : []),
    asyncHandler(async (req: AuthRequest, res) => {
      const id = parseId(req.params.id);
      const body = req.body || {};
      const sets: string[] = [];
      const params: unknown[] = [id, req.user!.companyId];
      for (const f of cfg.updateFields) {
        if (body[f] !== undefined) {
          params.push(body[f]);
          sets.push(`${f} = $${params.length}`);
        }
      }
      if (!sets.length) throw new AppError(422, 'No fields to update');
      params.push(new Date().toISOString());
      const result = await pool.query(
        `update ${cfg.table} set ${sets.join(', ')}, updated_at = $${params.length} where id = $1 and company_id = $2 returning *`,
        params,
      );
      if (!result.rows[0]) throw new AppError(404, 'Record not found');
      await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'UPDATE', entity, entity_id: id, details: req.body });
      ok(res, { item: result.rows[0] });
    }),
  );

  router.delete(
    '/:id',
    ...(cfg.writeRoles ? [requireRole(...cfg.writeRoles)] : []),
    asyncHandler(async (req: AuthRequest, res) => {
      const id = parseId(req.params.id);
      const result = await pool.query(
        `delete from ${cfg.table} where id = $1 and company_id = $2 returning id`,
        [id, req.user!.companyId],
      );
      if (!result.rows[0]) throw new AppError(404, 'Record not found');
      await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'DELETE', entity, entity_id: id });
      ok(res, { message: 'Deleted' });
    }),
  );

  return router;
};
