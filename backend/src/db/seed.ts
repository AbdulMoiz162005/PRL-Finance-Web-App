import fs from 'fs';
import path from 'path';
import { pool } from '../db';
import { config } from '../config';
import { hashPassword, log } from '../utils';

const runSqlFile = async (file: string) => {
  const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
  await pool.query(sql);
  log.info(`Applied ${file}`);
};

const seedUsers = async () => {
  const users = [
    { name: 'Platform Administrator', email: 'admin@meridianrefinery.ng', role: 'admin', title: 'System Administrator', department: 'IT' },
    { name: 'Adebayo Okafor', email: 'director@meridianrefinery.ng', role: 'director', title: 'Managing Director', department: 'Executive' },
    { name: 'John Obi', email: 'finance@meridianrefinery.ng', role: 'accountant', title: 'Finance Manager', department: 'Finance & Admin' },
    { name: 'Amina Suleiman', email: 'accountant@meridianrefinery.ng', role: 'accountant', title: 'Senior Accountant', department: 'Finance & Admin' },
    { name: 'Chioma Eze', email: 'auditor@meridianrefinery.ng', role: 'auditor', title: 'Internal Auditor', department: 'Audit' },
    { name: 'Sarah Adeyemi', email: 'ops@meridianrefinery.ng', role: 'manager', title: 'Terminal Operations Manager', department: 'Terminal Operations' },
    { name: 'David Musa', email: 'operator@meridianrefinery.ng', role: 'operator', title: 'Gate / Loading Operator', department: 'Terminal Operations' },
  ];

  const companyId = '00000000-0000-4000-8000-000000000001';
  for (const u of users) {
    const hash = await hashPassword(config.seedPassword);
    await pool.query(
      `insert into users (company_id, name, email, password_hash, role, title, department)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (email) do nothing`,
      [companyId, u.name, u.email, hash, u.role, u.title, u.department],
    );
    log.info(`User ready: ${u.email} / ${config.seedPassword} [${u.role}]`);
  }
};

const main = async () => {
  try {
    await runSqlFile('seed.sql');
    await seedUsers();
    await runSqlFile('surveyor_seed.sql');
    log.info('Seed complete.');
    process.exit(0);
  } catch (err) {
    log.error('Seed failed:', (err as Error).message);
    process.exit(1);
  }
};

main();
