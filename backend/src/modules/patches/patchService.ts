import { hashApiKey } from '../../common/apiKeys';
import { ConflictError, NotFoundError } from '../../common/errors';
import { Asset } from '../assets/asset.model';
import { Patch, PatchApprovalStatus, PatchClassification, PatchPlatform } from './patch.model';
import { AssetPatchStatus } from './assetPatchStatus.model';
import { PatchAgentKey } from './patchAgentKey.model';
import { generateApiKey } from './patchIngestService';

export interface PatchCatalogFilter {
  platform?: PatchPlatform;
  classification?: PatchClassification;
  approvalStatus?: PatchApprovalStatus;
}

export function listPatches(filter: PatchCatalogFilter): Promise<Patch[]> {
  const where: Record<string, unknown> = {};
  if (filter.platform) where.platform = filter.platform;
  if (filter.classification) where.classification = filter.classification;
  if (filter.approvalStatus) where.approvalStatus = filter.approvalStatus;
  return Patch.findAll({ where, order: [['createdAt', 'DESC']] });
}

async function getPatch(id: string): Promise<Patch> {
  const patch = await Patch.findByPk(id);
  if (!patch) throw new NotFoundError('Patch not found');
  return patch;
}

// Approval is a governance/tracking flag only - this app has no push mechanism to enforce it.
// It exists so compliance math (below) only counts patches an admin has actually reviewed.
export async function approvePatch(id: string, actorId: string): Promise<Patch> {
  const patch = await getPatch(id);
  await patch.update({ approvalStatus: 'approved', approvedById: actorId, approvedAt: new Date() });
  return patch;
}

export async function declinePatch(id: string, actorId: string): Promise<Patch> {
  const patch = await getPatch(id);
  await patch.update({ approvalStatus: 'declined', approvedById: actorId, approvedAt: new Date() });
  return patch;
}

export async function getAssetPatchStatuses(assetId: string): Promise<AssetPatchStatus[]> {
  return AssetPatchStatus.findAll({
    where: { assetId },
    include: [{ model: Patch, as: 'patch' }],
    order: [['lastCheckedAt', 'DESC']],
  });
}

export interface ComplianceReportRow {
  assetId: string;
  assetName: string;
  compliantCount: number;
  missingCount: number;
  failedCount: number;
  compliancePercent: number;
}

// A device with no approved-patch status rows at all has nothing to be non-compliant about, so
// it reports 100% rather than 0/0 reading as fully out of compliance.
export function computeCompliancePercent(compliant: number, missing: number, failed: number): number {
  const total = compliant + missing + failed;
  return total > 0 ? Math.round((compliant / total) * 100) : 100;
}

// Only counts approved patches - a newly-discovered, still-pending patch shouldn't count against
// a device's compliance the moment it's first seen anywhere in the fleet. In-JS aggregation
// mirrors the same accepted tradeoff already used by logSearchService.getDashboardSummary.
export async function getComplianceReport(): Promise<ComplianceReportRow[]> {
  const statuses = await AssetPatchStatus.findAll({
    include: [
      { model: Patch, as: 'patch', where: { approvalStatus: 'approved' }, attributes: [] },
      { model: Asset, as: 'asset', attributes: ['id', 'name'] },
    ],
  });

  const byAsset = new Map<string, { name: string; compliant: number; missing: number; failed: number }>();
  for (const status of statuses) {
    const asset = (status as unknown as { asset: Asset }).asset;
    const entry = byAsset.get(asset.id) ?? { name: asset.name, compliant: 0, missing: 0, failed: 0 };
    if (status.status === 'installed') entry.compliant += 1;
    else if (status.status === 'missing') entry.missing += 1;
    else if (status.status === 'failed') entry.failed += 1;
    byAsset.set(asset.id, entry);
  }

  const rows: ComplianceReportRow[] = [];
  for (const [assetId, entry] of byAsset) {
    rows.push({
      assetId,
      assetName: entry.name,
      compliantCount: entry.compliant,
      missingCount: entry.missing,
      failedCount: entry.failed,
      compliancePercent: computeCompliancePercent(entry.compliant, entry.missing, entry.failed),
    });
  }
  return rows.sort((a, b) => a.assetName.localeCompare(b.assetName));
}

export interface IssuedAgentKey {
  key: PatchAgentKey;
  /** The plaintext key. It exists only in this response - the DB keeps a hash. */
  apiKey: string;
}

async function assertAssetExists(assetId: string): Promise<void> {
  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new NotFoundError('Asset not found');
}

/** Metadata only (no secret), so the UI can tell whether a key exists and when it was issued. */
export async function getAgentKey(assetId: string): Promise<PatchAgentKey | null> {
  await assertAssetExists(assetId);
  return PatchAgentKey.findOne({ where: { assetId } });
}

// Keys are hashed at rest, so an existing key can't be shown again. Generating is therefore
// create-only; a second call is a 409 and the caller must rotate, which makes "this will
// invalidate the running agent" an explicit choice rather than a side effect of a re-click.
export async function generateAgentKey(assetId: string): Promise<IssuedAgentKey> {
  await assertAssetExists(assetId);
  if (await PatchAgentKey.findOne({ where: { assetId } })) {
    throw new ConflictError('This asset already has an agent key. Rotate it to issue a new one.');
  }
  const apiKey = generateApiKey();
  const key = await PatchAgentKey.create({ assetId, apiKeyHash: hashApiKey(apiKey) });
  return { key, apiKey };
}

export async function rotateAgentKey(assetId: string): Promise<IssuedAgentKey> {
  await assertAssetExists(assetId);
  const apiKey = generateApiKey();
  const [key, created] = await PatchAgentKey.findOrCreate({
    where: { assetId },
    defaults: { assetId, apiKeyHash: hashApiKey(apiKey) },
  });
  if (!created) await key.update({ apiKeyHash: hashApiKey(apiKey) });
  return { key, apiKey };
}
