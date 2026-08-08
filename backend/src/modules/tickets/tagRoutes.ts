import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate } from '../auth/middleware';
import { Tag } from './tag.model';

export const tagRouter = Router();
tagRouter.use(authenticate);

// Read-only autocomplete source for the ticket tag input - the tags table stays small and
// bounded regardless of ticket volume, so no permission gate or pagination is needed here.
tagRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await Tag.findAll({ order: [['name', 'ASC']] }));
  })
);
