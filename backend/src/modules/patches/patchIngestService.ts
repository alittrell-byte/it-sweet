import { generateApiKey, hashApiKey } from '../../common/apiKeys';
import { Asset } from '../assets/asset.model';
import { Patch, PatchClassification, PatchPlatform, PatchSeverity } from './patch.model';
import { AssetPatchStatus, AssetPatchStatusValue } from './assetPatchStatus.model';
import { PatchAgentKey } from './patchAgentKey.model';

export { generateApiKey };

export async function findAssetByApiKey(apiKey: string): Promise<Asset | null> {
  const key = await PatchAgentKey.findOne({ where: { apiKeyHash: hashApiKey(apiKey) } });
  if (!key) return null;
  return Asset.findByPk(key.assetId);
}

export interface PatchScanInput {
  platform: PatchPlatform;
  externalId: string;
  title: string;
  description?: string | null;
  classification?: PatchClassification;
  severity?: PatchSeverity;
  cveIds?: string[] | null;
  releaseDate?: string | null;
  status: AssetPatchStatusValue;
  failureReason?: string | null;
}

// Catalog entries are discovered, not pre-seeded - an admin can't practically curate every
// possible OS/app patch up front. The first device to report a given (platform, externalId)
// registers it as 'pending' for later review (see patchService.approvePatch/declinePatch).
async function findOrCreatePatch(scan: PatchScanInput): Promise<Patch> {
  const [patch] = await Patch.findOrCreate({
    where: { platform: scan.platform, externalId: scan.externalId },
    defaults: {
      platform: scan.platform,
      externalId: scan.externalId,
      title: scan.title,
      description: scan.description ?? null,
      classification: scan.classification ?? 'other',
      severity: scan.severity ?? 'moderate',
      cveIds: scan.cveIds ?? null,
      releaseDate: scan.releaseDate ?? null,
    },
  });
  return patch;
}

export async function ingestScanBatch(assetId: string, scans: PatchScanInput[]): Promise<void> {
  for (const scan of scans) {
    const patch = await findOrCreatePatch(scan);
    const now = new Date();
    const isNowMissing = scan.status === 'missing';

    const [status, created] = await AssetPatchStatus.findOrCreate({
      where: { assetId, patchId: patch.id },
      defaults: {
        assetId,
        patchId: patch.id,
        status: scan.status,
        lastCheckedAt: now,
        installedAt: scan.status === 'installed' ? now : null,
        failureReason: scan.status === 'failed' ? (scan.failureReason ?? null) : null,
        missingSinceAt: isNowMissing ? now : null,
      },
    });
    if (created) continue;

    // missingSinceAt only moves forward when a device transitions INTO 'missing' - a device
    // that keeps reporting the same still-missing patch every scan must not have its "missing
    // since" clock reset each time, or the overdue SLA sweep could never trip for it.
    const wasAlreadyMissing = status.status === 'missing';
    await status.update({
      status: scan.status,
      lastCheckedAt: now,
      installedAt: scan.status === 'installed' ? (status.installedAt ?? now) : status.installedAt,
      failureReason: scan.status === 'failed' ? (scan.failureReason ?? null) : null,
      missingSinceAt: isNowMissing ? (wasAlreadyMissing ? status.missingSinceAt : now) : null,
      // Clear the edge-trigger once no longer missing, so a future re-breach (e.g. a
      // subsequent OS update reintroduces the same gap) can alert again.
      overdueAlertedAt: isNowMissing ? status.overdueAlertedAt : null,
    });
  }
}
