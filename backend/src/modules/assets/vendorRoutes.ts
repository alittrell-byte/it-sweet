import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission } from '../auth/middleware';
import * as vendorService from './vendorService';

export const vendorRouter = Router();
vendorRouter.use(authenticate);

const MANAGE = requirePermission('assets.manage_vendors');

const vendorSchema = z.object({
  name: z.string().min(1).max(255),
  contactName: z.string().max(255).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Read access is open to anyone authenticated (asset/contract pickers need it) - only
// create/edit/delete require assets.manage_vendors.
vendorRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await vendorService.listVendors());
  })
);

vendorRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await vendorService.getVendor(req.params.id));
  })
);

vendorRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = vendorSchema.parse(req.body);
    res.status(201).json(await vendorService.createVendor(input));
  })
);

vendorRouter.patch(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = vendorSchema.partial().parse(req.body);
    res.json(await vendorService.updateVendor(req.params.id, input));
  })
);

vendorRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    await vendorService.deleteVendor(req.params.id);
    res.status(204).send();
  })
);
