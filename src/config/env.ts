import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.union([z.string(), z.number()]).optional().default('4000').transform((val) => typeof val === 'number' ? val : parseInt(val || '4000', 10)),
  NODE_ENV: z.string().optional().default('production'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@127.0.0.1:5432/archon_central'),
  DATABASE_BACKUP_URL: z.string().optional().default(''),
  DB_FAILOVER_ENABLED: z.union([z.string(), z.boolean()]).optional().default(false).transform((val) => typeof val === 'boolean' ? val : String(val).toLowerCase() === 'true'),
  JWT_SECRET: z.string().default('archon_nell_super_secret_jwt_key_capstone_2026'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECRET: z.string().default('archon_nell_cookie_secret_dev'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  // Email SMTP Configuration
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.union([z.string(), z.number()]).optional().default(587).transform((val) => typeof val === 'number' ? val : parseInt(val || '587', 10)),
  SMTP_SECURE: z.union([z.string(), z.boolean()]).optional().default(false).transform((val) => typeof val === 'boolean' ? val : String(val).toLowerCase() === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM_EMAIL: z.string().optional().default('no-reply@archonnell.com'),
  SMTP_FROM_NAME: z.string().optional().default('Archon Nell Incorporated'),
  OTP_EXPIRATION_MINUTES: z.union([z.string(), z.number()]).optional().default(5).transform((val) => typeof val === 'number' ? val : parseInt(val || '5', 10))
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.warn('[ENV] Warning: Some environment variables failed schema validation:', parsedEnv.error.format());
}

export const env = parsedEnv.success ? parsedEnv.data : {
  PORT: 4000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/archon_central',
  DATABASE_BACKUP_URL: process.env.DATABASE_BACKUP_URL || '',
  DB_FAILOVER_ENABLED: false,
  JWT_SECRET: process.env.JWT_SECRET || 'archon_nell_super_secret_jwt_key_capstone_2026',
  JWT_EXPIRES_IN: '7d',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || 'localhost',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'archon_nell_cookie_secret_dev',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'no-reply@archonnell.com',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'Archon Nell Incorporated',
  OTP_EXPIRATION_MINUTES: 5
};
