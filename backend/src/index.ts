import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { pool } from './db';
import { AppError, log } from './utils';
import routes from './routes';

const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ status: 'ok', service: 'refinery-finance-api', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

app.use('/api', routes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  const dbErr = err as { code?: string };
  if (dbErr.code === '23505') return res.status(409).json({ error: 'Duplicate entry already exists' });
  if (dbErr.code === '23503') return res.status(409).json({ error: 'Record is referenced by other data and cannot be changed' });
  log.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  log.info(`Refinery Finance API listening on port ${config.port}`);
});

process.on('unhandledRejection', (reason) => log.error('unhandledRejection', reason));
process.on('uncaughtException', (err) => log.error('uncaughtException', err));
