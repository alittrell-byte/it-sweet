import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { NotFoundError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import * as patchService from './patchService';
import * as maintenanceWindowService from './maintenanceWindowService';

export const patchRouter = Router();
patchRouter.use(authenticate, requireRole('admin', 'technician'), requirePermission('patches.view'));

const MANAGE_CATALOG = requirePermission('patches.manage_catalog');
const MANAGE_AGENTS = requirePermission('patches.manage_agents');
const MANAGE_WINDOWS = requirePermission('patches.manage_windows');

// Fixed-path routes must be registered before '/:id' - same ordering rule already documented in
// assetRoutes.ts ('/bulk/status' vs '/:id').
patchRouter.get(
  '/compliance-report',
  asyncHandler(async (_req, res) => {
    res.json(await patchService.getComplianceReport());
  })
);

patchRouter.get(
  '/assets/:assetId/status',
  asyncHandler(async (req, res) => {
    res.json(await patchService.getAssetPatchStatuses(req.params.assetId));
  })
);

patchRouter.get(
  '/assets/:assetId/agent-key',
  MANAGE_AGENTS,
  asyncHandler(async (req, res) => {
    const key = await patchService.getAgentKey(req.params.assetId);
    if (!key) throw new NotFoundError('No agent key has been issued for this asset');
    res.json(key);
  })
);

patchRouter.post(
  '/assets/:assetId/agent-key',
  MANAGE_AGENTS,
  asyncHandler(async (req, res) => {
    const { key, apiKey } = await patchService.generateAgentKey(req.params.assetId);
    res.status(201).json({ ...key.toJSON(), apiKey });
  })
);

patchRouter.post(
  '/assets/:assetId/agent-key/rotate',
  MANAGE_AGENTS,
  asyncHandler(async (req, res) => {
    const { key, apiKey } = await patchService.rotateAgentKey(req.params.assetId);
    res.json({ ...key.toJSON(), apiKey });
  })
);

const maintenanceWindowSchema = z.object({
  name: z.string().min(1).max(150),
  teamId: z.string().uuid().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  recurrence: z.enum(['once', 'weekly', 'monthly']).optional(),
  notes: z.string().nullable().optional(),
});

patchRouter.get(
  '/maintenance-windows',
  asyncHandler(async (_req, res) => {
    res.json(await maintenanceWindowService.listMaintenanceWindows());
  })
);

patchRouter.post(
  '/maintenance-windows',
  MANAGE_WINDOWS,
  asyncHandler(async (req, res) => {
    const input = maintenanceWindowSchema.parse(req.body);
    res.status(201).json(await maintenanceWindowService.createMaintenanceWindow(input));
  })
);

patchRouter.patch(
  '/maintenance-windows/:id',
  MANAGE_WINDOWS,
  asyncHandler(async (req, res) => {
    const input = maintenanceWindowSchema.partial().parse(req.body);
    res.json(await maintenanceWindowService.updateMaintenanceWindow(req.params.id, input));
  })
);

patchRouter.delete(
  '/maintenance-windows/:id',
  MANAGE_WINDOWS,
  asyncHandler(async (req, res) => {
    await maintenanceWindowService.deleteMaintenanceWindow(req.params.id);
    res.status(204).send();
  })
);

const catalogFilterSchema = z.object({
  platform: z.enum(['windows', 'linux', 'macos', 'other']).optional(),
  classification: z.enum(['security', 'critical', 'feature', 'other']).optional(),
  approvalStatus: z.enum(['pending', 'approved', 'declined']).optional(),
});

patchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = catalogFilterSchema.parse(req.query);
    res.json(await patchService.listPatches(filter));
  })
);

patchRouter.patch(
  '/:id/approve',
  MANAGE_CATALOG,
  asyncHandler(async (req, res) => {
    res.json(await patchService.approvePatch(req.params.id, req.user!.sub));
  })
);

patchRouter.patch(
  '/:id/decline',
  MANAGE_CATALOG,
  asyncHandler(async (req, res) => {
    res.json(await patchService.declinePatch(req.params.id, req.user!.sub));
  })
);
