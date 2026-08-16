import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://refinery:refinery_dev@localhost:5432/refinery_finance',
  jwtSecret: process.env.JWT_SECRET || 'refinery-finance-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
  approvalThreshold: parseFloat(process.env.APPROVAL_THRESHOLD || '50000'),
  seedPassword: process.env.SEED_PASSWORD || 'Refinery@2026',
};
