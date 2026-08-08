import 'dotenv/config';
import { z } from 'zod';

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default('http://localhost:4200'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  DB_DIALECT: z.enum(['postgres', 'mysql']).default('postgres'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('helpdesk'),
  DB_USER: z.string().default('helpdesk'),
  DB_PASSWORD: z.string().default('helpdesk'),
  DB_LOGGING: boolFromString.default('false'),

  AUTH_PROVIDER: z.enum(['local', 'ldap']).default('local'),
  LDAP_URL: z.string().optional(),
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_PASSWORD: z.string().optional(),
  LDAP_SEARCH_BASE: z.string().optional(),
  LDAP_SEARCH_FILTER: z.string().default('(|(sAMAccountName={{username}})(uid={{username}})(mail={{username}}))'),
  LDAP_GROUP_ROLE_MAP: z.string().default('{}'),
  LDAP_DEFAULT_ROLE: z.enum(['admin', 'technician', 'customer']).default('customer'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('/data/files'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: boolFromString.default('false'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: boolFromString.default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('helpdesk@example.com'),

  EMAIL_INBOUND_ENABLED: boolFromString.default('false'),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: boolFromString.default('true'),
  IMAP_USER: z.string().optional(),
  IMAP_PASSWORD: z.string().optional(),
  IMAP_MAILBOX: z.string().default('INBOX'),
  IMAP_POLL_INTERVAL_MS: z.coerce.number().default(60000),

  LOG_SYSLOG_ENABLED: boolFromString.default('false'),
  LOG_SYSLOG_UDP_PORT: z.coerce.number().default(5514),
  LOG_RETENTION_SWEEP_INTERVAL_MS: z.coerce.number().default(3600000),
  ALERT_EVALUATION_INTERVAL_MS: z.coerce.number().default(30000),
  RECURRING_TICKET_SWEEP_INTERVAL_MS: z.coerce.number().default(300000),
  ASSET_COMPLIANCE_SWEEP_INTERVAL_MS: z.coerce.number().default(3600000),
  PATCH_COMPLIANCE_SWEEP_INTERVAL_MS: z.coerce.number().default(3600000),
  PATCH_OVERDUE_DAYS: z.coerce.number().default(14),
  REPORT_SWEEP_INTERVAL_MS: z.coerce.number().default(3600000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const env = loadEnv();
