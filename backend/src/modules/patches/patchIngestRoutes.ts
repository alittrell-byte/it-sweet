import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { UnauthorizedError } from '../../common/errors';
import { Asset } from '../assets/asset.model';
import { findAssetByApiKey, ingestScanBatch } from './patchIngestService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      patchAsset?: Asset;
    }
  }
}

async function requireAgentApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.header('x-api-key');
  if (!apiKey) {
    next(new UnauthorizedError('Missing X-Api-Key header'));
    return;
  }
  const asset = await findAssetByApiKey(apiKey);
  if (!asset) {
    next(new UnauthorizedError('Invalid API key'));
    return;
  }
  req.patchAsset = asset;
  next();
}

const scanSchema = z.object({
  platform: z.enum(['windows', 'linux', 'macos', 'other']),
  externalId: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  classification: z.enum(['security', 'critical', 'feature', 'other']).optional(),
  severity: z.enum(['critical', 'important', 'moderate', 'low']).optional(),
  cveIds: z.array(z.string()).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  status: z.enum(['missing', 'installed', 'failed', 'pending_reboot']),
  failureReason: z.string().nullable().optional(),
});

const ingestSchema = z.object({ scans: z.array(scanSchema).min(1).max(1000) });

export const patchIngestRouter = Router();

// Agents authenticate with a per-asset API key, not a user session - same shape as the Log
// Monitoring ingest endpoint (backend/src/modules/logs/ingestRoutes.ts). A lightweight script on
// each device (PowerShell Get-HotFix, apt list --upgradable, etc.) POSTs its scan results here.
patchIngestRouter.post(
  '/',
  requireAgentApiKey,
  asyncHandler(async (req, res) => {
    const { scans } = ingestSchema.parse(req.body);
    await ingestScanBatch(req.patchAsset!.id, scans);
    res.status(201).json({ ingested: scans.length });
  })
);
