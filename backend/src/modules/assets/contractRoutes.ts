import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission } from '../auth/middleware';
import * as contractService from './contractService';

export const contractRouter = Router();
contractRouter.use(authenticate);

const MANAGE = requirePermission('assets.manage_vendors');

const contractSchema = z.object({
  vendorId: z.string().uuid(),
  assetId: z.string().uuid().nullable().optional(),
  type: z.enum(['support', 'maintenance', 'license', 'other']),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  autoRenew: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

contractRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const vendorId = req.query.vendorId as string | undefined;
    const assetId = req.query.assetId as string | undefined;
    res.json(await contractService.listContracts({ vendorId, assetId }));
  })
);

contractRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await contractService.getContract(req.params.id));
  })
);

contractRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = contractSchema.parse(req.body);
    res.status(201).json(await contractService.createContract(input));
  })
);

contractRouter.patch(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = contractSchema.partial().parse(req.body);
    res.json(await contractService.updateContract(req.params.id, input));
  })
);

contractRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    await contractService.deleteContract(req.params.id);
    res.status(204).send();
  })
);
