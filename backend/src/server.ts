import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, sequelize } from './db/sequelize';
import './db/models';
import { logger } from './common/logger';
import { ImapWatcherService } from './common/email/ImapWatcherService';
import { handleInboundEmail } from './modules/tickets/inboundEmail';
import { SyslogReceiver } from './modules/logs/syslogReceiver';
import { RetentionSweeper } from './modules/logs/retentionService';
import { AlertEvaluator } from './modules/logs/alertService';
import { RecurringTicketScheduler } from './modules/tickets/recurringTicketService';
import { AssetComplianceEvaluator } from './modules/assets/complianceAlertService';
import { PatchComplianceEvaluator } from './modules/patches/patchComplianceService';
import { ScheduledReportSweeper } from './modules/reporting/scheduledReportService';

async function main(): Promise<void> {
  await connectDatabase();
  logger.info(`Connected to ${env.DB_DIALECT} database`);

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Backend listening on port ${env.PORT}`);
  });

  const imapWatcher = new ImapWatcherService(handleInboundEmail);
  imapWatcher.start();

  const syslogReceiver = new SyslogReceiver();
  syslogReceiver.start();

  const retentionSweeper = new RetentionSweeper();
  retentionSweeper.start();

  const alertEvaluator = new AlertEvaluator();
  alertEvaluator.start();

  const recurringTicketScheduler = new RecurringTicketScheduler();
  recurringTicketScheduler.start();

  const assetComplianceEvaluator = new AssetComplianceEvaluator();
  assetComplianceEvaluator.start();

  const patchComplianceEvaluator = new PatchComplianceEvaluator();
  patchComplianceEvaluator.start();

  const scheduledReportSweeper = new ScheduledReportSweeper();
  scheduledReportSweeper.start();

  process.on('SIGTERM', async () => {
    imapWatcher.stop();
    syslogReceiver.stop();
    retentionSweeper.stop();
    alertEvaluator.stop();
    recurringTicketScheduler.stop();
    assetComplianceEvaluator.stop();
    patchComplianceEvaluator.stop();
    scheduledReportSweeper.stop();
    await sequelize.close();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
