import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { config } from './config';
import { pool } from './db';

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const log = {
  info: (...args: unknown[]) => console.log(new Date().toISOString(), '[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn(new Date().toISOString(), '[WARN]', ...args),
  error: (...args: unknown[]) => console.error(new Date().toISOString(), '[ERROR]', ...args),
};

export const hashPassword = async (plain: string): Promise<string> => bcrypt.hash(plain, 10);
export const comparePassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  companyId: string;
  name: string;
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as unknown as number });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, config.jwtSecret) as JwtPayload;

export const audit = async (
  client: Pool | import('pg').PoolClient,
  payload: {
    user_id?: string | null;
    user_email?: string | null;
    action: string;
    entity: string;
    entity_id?: string | null;
    details?: Record<string, unknown> | null;
  },
): Promise<void> => {
  try {
    await client.query(
      `insert into audit_logs (user_id, user_email, action, entity, entity_id, details)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        payload.user_id ?? null,
        payload.user_email ?? null,
        payload.action,
        payload.entity,
        payload.entity_id ?? null,
        payload.details ? JSON.stringify(payload.details) : null,
      ],
    );
  } catch (err) {
    log.warn('audit write failed', (err as Error).message);
  }
};

export const nextEntryNo = async (
  prefix: string,
  table: string,
  column: string,
  client: import('pg').Pool | import('pg').PoolClient = pool,
): Promise<string> => {
  const year = new Date().getFullYear();
  const res = await client.query(
    `select coalesce(max(substring(${column} from '([0-9]+)$')::int), 0) + 1 as n
     from ${table} where ${column} like $1`,
    [`${prefix}${year}-%`],
  );
  const n = res.rows[0]?.n ?? 1;
  return `${prefix}${year}-${String(n).padStart(5, '0')}`;
};

export const clampNumber = (v: unknown, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const ok = (res: Response, data: unknown, status = 200) => res.status(status).json(data);

export const paginate = (rows: any[], page = 1, pageSize = 100) => {
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
};
