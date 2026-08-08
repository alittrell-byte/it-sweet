import { Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../../common/errors';
import * as assetService from './assetService';
import * as depreciationService from './depreciationService';
import { assetsToCsv, parseAssetsCsv } from './csv';
import { Asset } from './asset.model';
import { Vendor } from './vendor.model';
import { AssetCustomFieldDefinition } from './assetCustomFieldDefinition.model';

const customFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['hardware', 'software_license', 'peripheral']),
  status: z.enum(['available', 'in_use', 'retired', 'lost', 'under_repair', 'ordered']).optional(),
  serialNumber: z.string().max(255).nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  warrantyExpiry: z.string().nullable().optional(),
  licenseSeatsPurchased: z.number().int().min(0).nullable().optional(),
  purchaseCost: z.number().min(0).nullable().optional(),
  depreciationMethod: z.enum(['none', 'straight_line']).optional(),
  usefulLifeMonths: z.number().int().min(1).nullable().optional(),
  customFields: customFieldsSchema,
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

export async function create(req: Request, res: Response): Promise<void> {
  const input = createSchema.parse(req.body);
  res.status(201).json(await assetService.createAsset(input, req.user!.sub));
}

export async function list(req: Request, res: Response): Promise<void> {
  const type = req.query.type as assetService.ListAssetsFilter['type'] | undefined;
  const status = req.query.status as assetService.ListAssetsFilter['status'] | undefined;
  const vendorId = req.query.vendorId as string | undefined;
  res.json(await assetService.listAssets({ type, status, vendorId }));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await assetService.getAsset(req.params.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = updateSchema.parse(req.body);
  res.json(await assetService.updateAsset(req.params.id, input, req.user!.sub));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await assetService.deleteAsset(req.params.id, req.user!.sub);
  res.status(204).send();
}

export async function receive(req: Request, res: Response): Promise<void> {
  res.json(await assetService.receiveAsset(req.params.id, req.user!.sub));
}

export async function auditLog(req: Request, res: Response): Promise<void> {
  res.json(await assetService.getAssetAuditLog(req.params.id));
}

const assignSchema = z.object({
  assignedToType: z.enum(['user', 'location', 'department']),
  assignedToUserId: z.string().uuid().optional(),
  assignedToLabel: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export async function assign(req: Request, res: Response): Promise<void> {
  const input = assignSchema.parse(req.body);
  res.status(201).json(await assetService.assignAsset(req.params.id, input, req.user!.sub));
}

const checkoutSchema = z.object({
  assignedToUserId: z.string().uuid(),
  dueBackAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export async function checkout(req: Request, res: Response): Promise<void> {
  const input = checkoutSchema.parse(req.body);
  res.status(201).json(await assetService.checkoutAsset(req.params.id, input, req.user!.sub));
}

const checkinSchema = z.object({ assignmentId: z.string().uuid().optional() });

export async function checkin(req: Request, res: Response): Promise<void> {
  const { assignmentId } = checkinSchema.parse(req.body ?? {});
  res.json(await assetService.checkinAsset(req.params.id, assignmentId));
}

export async function history(req: Request, res: Response): Promise<void> {
  res.json(await assetService.getAssignmentHistory(req.params.id));
}

export async function linkedTickets(req: Request, res: Response): Promise<void> {
  res.json(await assetService.getLinkedTickets(req.params.id));
}

export async function licenseCompliance(_req: Request, res: Response): Promise<void> {
  res.json(await assetService.getLicenseCompliance());
}

export async function depreciationReport(_req: Request, res: Response): Promise<void> {
  res.json(await depreciationService.getDepreciationReport());
}

export async function exportCsv(_req: Request, res: Response): Promise<void> {
  const assets = await Asset.findAll({ order: [['name', 'ASC']], include: [{ model: Vendor, as: 'vendor' }] });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');
  res.send(assetsToCsv(assets));
}

async function resolveVendorId(vendorName: string | null | undefined): Promise<string | null> {
  if (!vendorName) return null;
  const [vendor] = await Vendor.findOrCreate({ where: { name: vendorName } });
  return vendor.id;
}

export async function importCsv(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new BadRequestError('No CSV file uploaded');
  }
  const rows = parseAssetsCsv(file.buffer.toString('utf-8'));
  const results = [];
  for (const row of rows) {
    if (row.status === 'error' || !row.data) {
      results.push({ row: row.row, status: 'error', error: row.error });
      continue;
    }
    try {
      const vendorId = await resolveVendorId(row.vendorName);
      const data = { ...row.data, vendorId };
      const existing = data.serialNumber ? await Asset.findOne({ where: { serialNumber: data.serialNumber } }) : null;
      if (existing) {
        await assetService.updateAsset(existing.id, data, req.user!.sub);
        results.push({ row: row.row, status: 'updated', id: existing.id });
      } else {
        const created = await assetService.createAsset(data, req.user!.sub);
        results.push({ row: row.row, status: 'created', id: created.id });
      }
    } catch (err) {
      results.push({ row: row.row, status: 'error', error: (err as Error).message });
    }
  }
  res.json({ results });
}

const customFieldDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, 'key must be lowercase letters, numbers, and underscores only'),
  label: z.string().min(1).max(150),
  fieldType: z.enum(['text', 'number', 'date', 'boolean']),
  assetType: z.enum(['hardware', 'software_license', 'peripheral']).nullable().optional(),
});

export async function listCustomFieldDefinitions(_req: Request, res: Response): Promise<void> {
  res.json(await AssetCustomFieldDefinition.findAll({ order: [['label', 'ASC']] }));
}

export async function createCustomFieldDefinition(req: Request, res: Response): Promise<void> {
  const input = customFieldDefinitionSchema.parse(req.body);
  res.status(201).json(await AssetCustomFieldDefinition.create(input));
}

export async function deleteCustomFieldDefinition(req: Request, res: Response): Promise<void> {
  await AssetCustomFieldDefinition.destroy({ where: { id: req.params.id } });
  res.status(204).send();
}

// --- Bulk actions ---

const bulkStatusSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(['available', 'in_use', 'retired', 'lost', 'under_repair', 'ordered']),
});

export async function bulkStatus(req: Request, res: Response): Promise<void> {
  const { assetIds, status } = bulkStatusSchema.parse(req.body);
  res.json(await assetService.bulkChangeStatus(assetIds, status, req.user!.sub));
}

const bulkVendorSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(500),
  vendorId: z.string().uuid().nullable(),
});

export async function bulkVendor(req: Request, res: Response): Promise<void> {
  const { assetIds, vendorId } = bulkVendorSchema.parse(req.body);
  res.json(await assetService.bulkSetVendor(assetIds, vendorId, req.user!.sub));
}

const bulkDeleteSchema = z.object({ assetIds: z.array(z.string().uuid()).min(1).max(500) });

export async function bulkDelete(req: Request, res: Response): Promise<void> {
  const { assetIds } = bulkDeleteSchema.parse(req.body);
  res.json(await assetService.bulkDelete(assetIds, req.user!.sub));
}
