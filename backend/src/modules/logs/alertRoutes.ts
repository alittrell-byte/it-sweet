import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import * as alertService from './alertService';

export const alertRuleRouter = Router();
alertRuleRouter.use(authenticate, requireRole('admin', 'technician'), requirePermission('logs.manage_alerts'));

const severityEnum = z.enum(['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug']);

const createSchema = z.object({
  name: z.string().min(1).max(150),
  sourceId: z.string().uuid().nullable().optional(),
  pattern: z.string().min(1).max(500),
  severityFilter: severityEnum.nullable().optional(),
  thresholdCount: z.number().int().min(1).default(1),
  thresholdWindowMinutes: z.number().int().min(1).default(5),
  notifyEmails: z.array(z.string().email()).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  createTicket: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

alertRuleRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await alertService.listAlertRules());
  })
);

alertRuleRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const rule = await alertService.createAlertRule(
      { ...input, notifyEmails: input.notifyEmails ? JSON.stringify(input.notifyEmails) : undefined },
      req.user!
    );
    res.status(201).json(rule);
  })
);

const updateSchema = createSchema.partial();

alertRuleRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const rule = await alertService.updateAlertRule(req.params.id, {
      ...input,
      notifyEmails: input.notifyEmails ? JSON.stringify(input.notifyEmails) : undefined,
    });
    res.json(rule);
  })
);

alertRuleRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await alertService.deleteAlertRule(req.params.id);
    res.status(204).send();
  })
);

alertRuleRouter.get(
  '/:id/events',
  asyncHandler(async (req, res) => {
    res.json(await alertService.listAlertEvents(req.params.id));
  })
);
