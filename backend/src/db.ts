import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl:
    config.databaseUrl.includes('supabase.co') || config.databaseUrl.includes('pooler.supabase.com')
      ? { rejectUnauthorized: false }
      : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export const transact = async <T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
