import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { ForbiddenError, NotFoundError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import { SavedSearch } from './savedSearch.model';

export const savedSearchRouter = Router();
savedSearchRouter.use(authenticate, requireRole('admin', 'technician'), requirePermission('logs.view'));

const filtersSchema = z.object({
  sourceId: z.string().uuid().optional(),
  severity: z.string().optional(),
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  metadataField: z.string().optional(),
  metadataValue: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(150),
  filters: filtersSchema,
});

// Scoped to the requesting user throughout - saved searches are personal, not shared/team-wide.
savedSearchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await SavedSearch.findAll({ where: { userId: req.user!.sub }, order: [['name', 'ASC']] }));
  })
);

savedSearchRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const saved = await SavedSearch.create({ ...input, userId: req.user!.sub });
    res.status(201).json(saved);
  })
);

savedSearchRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const saved = await SavedSearch.findByPk(req.params.id);
    if (!saved) throw new NotFoundError('Saved search not found');
    if (saved.userId !== req.user!.sub) throw new ForbiddenError('You can only delete your own saved searches');
    await saved.destroy();
    res.status(204).send();
  })
);
