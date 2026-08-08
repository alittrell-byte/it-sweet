import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate } from '../auth/middleware';
import * as savedViewService from './savedViewService';

export const ticketSavedViewRouter = Router();
ticketSavedViewRouter.use(authenticate);

const filtersSchema = z.object({
  status: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  teamId: z.string().optional(),
  tag: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  filters: filtersSchema,
});

// No permission key needed - every route here is scoped to the caller's own saved views by
// the service layer (userId === actor.sub), so ownership itself is the access control.
ticketSavedViewRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await savedViewService.listSavedViews(req.user!));
  })
);

ticketSavedViewRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, filters } = createSchema.parse(req.body);
    res.status(201).json(await savedViewService.createSavedView(name, filters, req.user!));
  })
);

ticketSavedViewRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await savedViewService.deleteSavedView(req.params.id, req.user!);
    res.status(204).send();
  })
);
