import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { NotFoundError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import { CannedResponse } from './cannedResponse.model';

export const cannedResponseRouter = Router();
cannedResponseRouter.use(authenticate, requireRole('admin', 'technician'));

const MANAGE = requirePermission('tickets.manage_canned_responses');

const upsertSchema = z.object({ title: z.string().min(1).max(150), body: z.string().min(1) });

// Any staff member can read/use canned responses while working a ticket; only those
// granted tickets.manage_canned_responses can create/edit/delete the library itself.
cannedResponseRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await CannedResponse.findAll({ order: [['title', 'ASC']] }));
  })
);

cannedResponseRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = upsertSchema.parse(req.body);
    const response = await CannedResponse.create({ ...input, createdById: req.user!.sub });
    res.status(201).json(response);
  })
);

cannedResponseRouter.put(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = upsertSchema.parse(req.body);
    const response = await CannedResponse.findByPk(req.params.id);
    if (!response) throw new NotFoundError('Canned response not found');
    await response.update(input);
    res.json(response);
  })
);

cannedResponseRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    await CannedResponse.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
