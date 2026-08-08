import os from 'os';
import path from 'path';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Defaults to the OS temp dir rather than the production '/data/files' default (env.ts), which
// isn't guaranteed writable/creatable in every dev/CI environment this suite runs in.
process.env.STORAGE_LOCAL_DIR = process.env.STORAGE_LOCAL_DIR || path.join(os.tmpdir(), 'helpdesk-test-storage');
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.DB_DIALECT = process.env.DB_DIALECT || 'postgres';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'helpdesk_test';
process.env.DB_USER = process.env.DB_USER || 'helpdesk';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'helpdesk';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'localhost';
process.env.SMTP_PORT = process.env.SMTP_PORT || '1025';
