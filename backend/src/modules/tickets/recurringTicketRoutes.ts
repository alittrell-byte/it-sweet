import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission } from '../auth/middleware';
import * as recurringTicketService from './recurringTicketService';

export const recurringTicketRouter = Router();
recurringTicketRouter.use(authenticate);

const MANAGE = requirePermission('tickets.manage_recurring');
recurringTicketRouter.use(MANAGE);

const recurrenceRuleSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});

const templateSchema = z.object({
  name: z.string().min(1).max(150),
  subjectTemplate: z.string().min(1).max(255),
  descriptionTemplate: z.string().min(1),
  category: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigneeId: z.string().uuid().optional(),
  recurrenceRule: recurrenceRuleSchema,
  isActive: z.boolean().default(true),
  nextRunAt: z.coerce.date(),
});

recurringTicketRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await recurringTicketService.listRecurringTemplates());
  })
);

recurringTicketRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = templateSchema.parse(req.body);
    res.status(201).json(await recurringTicketService.createRecurringTemplate(input, req.user!));
  })
);

recurringTicketRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = templateSchema.partial().parse(req.body);
    res.json(await recurringTicketService.updateRecurringTemplate(req.params.id, input));
  })
);

recurringTicketRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await recurringTicketService.deleteRecurringTemplate(req.params.id);
    res.status(204).send();
  })
);
