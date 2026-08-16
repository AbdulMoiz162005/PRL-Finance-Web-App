import { NextFunction, Request, Response } from 'express';
import { verifyToken, AppError, JwtPayload } from '../utils';

export interface AuthRequest extends Request {
  user?: JwtPayload & { id: string };
}

export const requireAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'Authentication required'));
  try {
    const payload = verifyToken(token);
    req.user = { ...payload, id: payload.sub };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
};

export const requireRole =
  (...roles: string[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, `Access denied. Requires role: ${roles.join(' or ')}`));
    }
    next();
  };

export const ROLES = {
  admin: 'admin',
  director: 'director',
  accountant: 'accountant',
  auditor: 'auditor',
  manager: 'manager',
  operator: 'operator',
};
