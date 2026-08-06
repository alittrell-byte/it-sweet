// Resets the test database schema from the current model definitions before the Jest
// suite runs. Production/dev deployments use the real migrations (npm run migrate)
// instead - this sync-based reset is only for fast, disposable test runs.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.DB_NAME = process.env.DB_NAME || 'helpdesk_test';

import { sequelize } from '../src/db/sequelize';
import '../src/db/models';

async function main(): Promise<void> {
  await sequelize.sync({ force: true });
  await sequelize.close();
  // eslint-disable-next-line no-console
  console.log('Test database schema synced.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to sync test database:', err);
  process.exit(1);
});
