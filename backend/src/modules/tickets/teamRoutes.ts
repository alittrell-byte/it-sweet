import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission } from '../auth/middleware';
import * as teamService from './teamService';

export const teamRouter = Router();
teamRouter.use(authenticate);

const MANAGE = requirePermission('tickets.manage_teams');

const teamSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  tier: z.number().int().min(1).max(100).optional(),
  escalatesToTeamId: z.string().uuid().nullable().optional(),
});

const memberSchema = z.object({ userId: z.string().uuid() });

// Any authenticated user can see the list of teams/queues (needed for the ticket-create
// picker) - only creating/editing teams and managing membership requires the permission.
teamRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await teamService.listTeams());
  })
);

teamRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await teamService.getTeam(req.params.id));
  })
);

teamRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = teamSchema.parse(req.body);
    res.status(201).json(await teamService.createTeam(input));
  })
);

teamRouter.patch(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = teamSchema.partial().parse(req.body);
    res.json(await teamService.updateTeam(req.params.id, input));
  })
);

teamRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    await teamService.deleteTeam(req.params.id);
    res.status(204).send();
  })
);

teamRouter.post(
  '/:id/members',
  MANAGE,
  asyncHandler(async (req, res) => {
    const { userId } = memberSchema.parse(req.body);
    await teamService.addMember(req.params.id, userId);
    res.status(204).send();
  })
);

teamRouter.delete(
  '/:id/members/:userId',
  MANAGE,
  asyncHandler(async (req, res) => {
    await teamService.removeMember(req.params.id, req.params.userId);
    res.status(204).send();
  })
);
