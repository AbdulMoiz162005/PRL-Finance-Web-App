import { Router } from 'express';
import { pool } from '../db';
import { asyncHandler, ok, AppError, hashPassword, audit } from '../utils';
import { parseSearch } from './parse';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { validateBody, parseId } from '../middleware/validate';

const router = Router();
const auditRouter = Router();

router.use(requireAuth, requireRole('admin', 'director'));

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const rows = await pool.query(
      `select id, name, email, role, status, title, department, phone, last_login_at, created_at
       from users where company_id = $1
         and ($2::text is null or name ilike '%'||$2||'%' or email ilike '%'||$2||'%')
       order by created_at desc`,
      [req.user!.companyId, search],
    );
    ok(res, { items: rows.rows });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  validateBody([
    { key: 'name', required: true, type: 'string' },
    { key: 'email', required: true, type: 'string' },
    { key: 'role', required: true, type: 'string' },
    { key: 'password', required: true, type: 'string' },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, email, role, password, title, department, phone } = req.body;
    const allowed = ['admin', 'director', 'accountant', 'auditor', 'manager', 'operator'];
    if (!allowed.includes(role)) throw new AppError(422, 'Invalid role');
    const hash = await hashPassword(password);
    const result = await pool.query(
      `insert into users (company_id, name, email, password_hash, role, title, department, phone)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, name, email, role, title, department, status`,
      [req.user!.companyId, name, email, hash, role, title ?? null, department ?? null, phone ?? null],
    );
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'CREATE_USER', entity: 'users', entity_id: result.rows[0].id, details: { email } });
    ok(res, { item: result.rows[0] }, 201);
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const { name, role, status, title, department, phone } = req.body;
    const result = await pool.query(
      `update users set
         name = coalesce($1, name), role = coalesce($2, role), status = coalesce($3, status),
         title = coalesce($4, title), department = coalesce($5, department), phone = coalesce($6, phone),
         updated_at = now()
       where id = $7 and company_id = $8 returning id, name, email, role, status, title, department`,
      [name, role, status, title, department, phone, id, req.user!.companyId],
    );
    if (!result.rows[0]) throw new AppError(404, 'User not found');
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'UPDATE_USER', entity: 'users', entity_id: id, details: req.body });
    ok(res, { item: result.rows[0] });
  }),
);

router.post(
  '/:id/reset-password',
  requireRole('admin'),
  validateBody([{ key: 'password', required: true, type: 'string' }]),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseId(req.params.id);
    const hash = await hashPassword(req.body.password);
    await pool.query('update users set password_hash = $1, updated_at = now() where id = $2 and company_id = $3', [hash, id, req.user!.companyId]);
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'RESET_PASSWORD', entity: 'users', entity_id: id });
    ok(res, { message: 'Password reset' });
  }),
);

auditRouter.use(requireAuth, requireRole('admin', 'auditor', 'director'));
auditRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { search } = parseSearch(req);
    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10), 1000);
    const rows = await pool.query(
      `select a.id, a.user_email, a.action, a.entity, a.entity_id, a.details, a.created_at,
              u.name as user_name
       from audit_logs a left join users u on u.id = a.user_id
       where ($1::text is null or a.user_email ilike '%'||$1||'%' or a.action ilike '%'||$1||'%' or a.entity ilike '%'||$1||'%')
       order by a.created_at desc limit $2`,
      [search, limit],
    );
    ok(res, { items: rows.rows });
  }),
);

export default router;
export { auditRouter };
