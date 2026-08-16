import { NextFunction, Request, Response } from 'express';

export const parseSearch = (req: Request): { search: string | null; page: number; pageSize: number } => {
  const search = req.query.search ? String(req.query.search) : null;
  const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '100'), 10), 1), 500);
  return { search, page, pageSize };
};

export const parseDateRange = (req: Request): { from: string | null; to: string | null } => {
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;
  return { from, to };
};
