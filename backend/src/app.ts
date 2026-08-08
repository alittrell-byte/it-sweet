import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './common/middleware/errorHandler';
import { authRouter } from './modules/auth/authRoutes';
import { usersRouter } from './modules/auth/usersRoutes';
import { ticketRouter } from './modules/tickets/ticketRoutes';
import { cannedResponseRouter } from './modules/tickets/cannedResponseRoutes';
import { teamRouter } from './modules/tickets/teamRoutes';
import { ticketTemplateRouter } from './modules/tickets/ticketTemplateRoutes';
import { ticketSavedViewRouter } from './modules/tickets/ticketSavedViewRoutes';
import { recurringTicketRouter } from './modules/tickets/recurringTicketRoutes';
import { tagRouter } from './modules/tickets/tagRoutes';
import { notificationGroupRouter } from './modules/notifications/notificationGroupRoutes';
import { kbRouter } from './modules/knowledge-base/kbRoutes';
import { kbCategoryRouter } from './modules/knowledge-base/categoryRoutes';
import { kbArticleTemplateRouter } from './modules/knowledge-base/articleTemplateRoutes';
import { assetRouter } from './modules/assets/assetRoutes';
import { vendorRouter } from './modules/assets/vendorRoutes';
import { contractRouter } from './modules/assets/contractRoutes';
import { logRouter } from './modules/logs/logRoutes';
import { alertRuleRouter } from './modules/logs/alertRoutes';
import { ingestRouter } from './modules/logs/ingestRoutes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/tickets', ticketRouter);
  app.use('/api/canned-responses', cannedResponseRouter);
  app.use('/api/teams', teamRouter);
  app.use('/api/ticket-templates', ticketTemplateRouter);
  app.use('/api/ticket-saved-views', ticketSavedViewRouter);
  app.use('/api/recurring-ticket-templates', recurringTicketRouter);
  app.use('/api/tags', tagRouter);
  app.use('/api/notification-groups', notificationGroupRouter);
  app.use('/api/kb/categories', kbCategoryRouter);
  app.use('/api/kb/templates', kbArticleTemplateRouter);
  app.use('/api/kb', kbRouter);
  app.use('/api/assets', assetRouter);
  app.use('/api/vendors', vendorRouter);
  app.use('/api/contracts', contractRouter);
  app.use('/api/logs/alert-rules', alertRuleRouter);
  app.use('/api/logs/ingest', ingestRouter);
  app.use('/api/logs', logRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
