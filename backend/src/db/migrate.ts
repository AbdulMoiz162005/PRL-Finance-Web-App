import fs from 'fs';
import path from 'path';
import { pool, transact } from '../db';
import { log } from '../utils';

const runSqlFile = async (file: string) => {
  const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
  await transact(async (client) => {
    await client.query(sql);
  });
  log.info(`Applied ${file}`);
};

const main = async () => {
  try {
    await runSqlFile('schema.sql');
    log.info('Schema migration complete.');
    process.exit(0);
  } catch (err) {
    log.error('Migration failed:', (err as Error).message);
    process.exit(1);
  }
};

main();
