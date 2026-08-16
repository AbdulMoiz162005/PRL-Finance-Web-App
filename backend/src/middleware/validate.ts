import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils';

type Rule = { key: string; required?: boolean; type?: string; min?: number; max?: number };

const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown) => typeof v === 'string';

export const validateBody =
  (rules: Rule[]) => (req: Request, _res: Response, next: NextFunction) => {
    const body = req.body || {};
    for (const rule of rules) {
      const value = body[rule.key];
      if (rule.required && (value === undefined || value === null || value === '')) {
        return next(new AppError(422, `Field '${rule.key}' is required`));
      }
      if (value !== undefined && value !== null) {
        if (rule.type === 'number' && !isNumber(value)) {
          return next(new AppError(422, `Field '${rule.key}' must be a number`));
        }
        if (rule.type === 'string' && !isString(value)) {
          return next(new AppError(422, `Field '${rule.key}' must be a string`));
        }
      }
    }
    next();
  };

export const parseId = (id: string): string => {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) throw new AppError(400, `Invalid id: ${id}`);
  return id;
};
