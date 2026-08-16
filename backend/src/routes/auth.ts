import { Router } from 'express';
import { pool } from '../db';
import { comparePassword, signToken, AppError, asyncHandler, ok, audit } from '../utils';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.post(
  '/login',
  validateBody([
    { key: 'email', required: true, type: 'string' },
    { key: 'password', required: true, type: 'string' },
  ]),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query(
      `select u.id, u.name, u.email, u.role, u.password_hash, u.status, u.title, u.department, u.company_id,
              c.name as company_name, c.currency
       from users u join companies c on c.id = u.company_id
       where lower(u.email) = lower($1)`,
      [email],
    );
    const user = result.rows[0];
    if (!user) throw new AppError(401, 'Invalid email or password');
    if (user.status !== 'active') throw new AppError(403, 'Account is disabled. Contact administrator.');
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw new AppError(401, 'Invalid email or password');

    await pool.query('update users set last_login_at = now() where id = $1', [user.id]);
    await audit(pool, { user_id: user.id, user_email: user.email, action: 'LOGIN', entity: 'auth', entity_id: user.id });

    const token = signToken({ sub: user.id, email: user.email, role: user.role, companyId: user.company_id, name: user.name });
    ok(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
        department: user.department,
        companyId: user.company_id,
        companyName: user.company_name,
        currency: user.currency,
      },
    });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `select u.id, u.name, u.email, u.role, u.status, u.title, u.department, u.company_id, u.phone,
              c.name as company_name, c.currency, c.logo_url
       from users u join companies c on c.id = u.company_id where u.id = $1`,
      [req.user!.id],
    );
    if (!result.rows[0]) throw new AppError(404, 'User not found');
    ok(res, { user: result.rows[0] });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  validateBody([
    { key: 'currentPassword', required: true, type: 'string' },
    { key: 'newPassword', required: true, type: 'string' },
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const me = await pool.query('select password_hash from users where id = $1', [req.user!.id]);
    const valid = await comparePassword(req.body.currentPassword, me.rows[0].password_hash);
    if (!valid) throw new AppError(400, 'Current password is incorrect');

    const { hashPassword } = await import('../utils');
    const hash = await hashPassword(req.body.newPassword);
    await pool.query('update users set password_hash = $1 where id = $2', [hash, req.user!.id]);
    await audit(pool, { user_id: req.user!.id, user_email: req.user!.email, action: 'CHANGE_PASSWORD', entity: 'users', entity_id: req.user!.id });
    ok(res, { message: 'Password updated' });
  }),
);

export default router;
