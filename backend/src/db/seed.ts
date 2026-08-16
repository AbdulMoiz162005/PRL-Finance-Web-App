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
    { name: 'Platform Administrator', email: 'admin@prl.com.pk', role: 'admin', title: 'System Administrator', department: 'IT' },
    { name: 'Ahmed Raza', email: 'director@prl.com.pk', role: 'director', title: 'Managing Director', department: 'Executive' },
    { name: 'Bilal Khan', email: 'finance@prl.com.pk', role: 'accountant', title: 'Finance Manager', department: 'Finance & Admin' },
    { name: 'Sana Malik', email: 'accountant@prl.com.pk', role: 'accountant', title: 'Senior Accountant', department: 'Finance & Admin' },
    { name: 'Usman Tariq', email: 'auditor@prl.com.pk', role: 'auditor', title: 'Internal Auditor', department: 'Audit' },
    { name: 'Farhan Qureshi', email: 'ops@prl.com.pk', role: 'manager', title: 'Terminal Operations Manager', department: 'Terminal Operations' },
    { name: 'Imran Sheikh', email: 'operator@prl.com.pk', role: 'operator', title: 'Gate / Loading Operator', department: 'Terminal Operations' },
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
