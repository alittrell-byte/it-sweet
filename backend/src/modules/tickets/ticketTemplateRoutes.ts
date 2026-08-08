import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { NotFoundError } from '../../common/errors';
import { authenticate, requirePermission } from '../auth/middleware';
import { TicketTemplate } from './ticketTemplate.model';

export const ticketTemplateRouter = Router();
ticketTemplateRouter.use(authenticate);

const MANAGE = requirePermission('tickets.manage_templates');

const templateSchema = z.object({
  name: z.string().min(1).max(150),
  subjectTemplate: z.string().min(1).max(255),
  descriptionTemplate: z.string().min(1),
  category: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  isActive: z.boolean().default(true),
});

// Any authenticated user can read the active template list (used by the ticket-create
// picker, available to customers and staff alike) - only tickets.manage_templates can
// create/edit/delete the library itself.
ticketTemplateRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await TicketTemplate.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }));
  })
);

// Full list including inactive templates, for the template-management admin page.
ticketTemplateRouter.get(
  '/manage',
  MANAGE,
  asyncHandler(async (_req, res) => {
    res.json(await TicketTemplate.findAll({ order: [['name', 'ASC']] }));
  })
);

ticketTemplateRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = templateSchema.parse(req.body);
    const template = await TicketTemplate.create({ ...input, category: input.category ?? null, createdById: req.user!.sub });
    res.status(201).json(template);
  })
);

ticketTemplateRouter.patch(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = templateSchema.partial().parse(req.body);
    const template = await TicketTemplate.findByPk(req.params.id);
    if (!template) throw new NotFoundError('Ticket template not found');
    await template.update(input);
    res.json(template);
  })
);

ticketTemplateRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    await TicketTemplate.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
