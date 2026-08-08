import { BadRequestError, NotFoundError } from '../../common/errors';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Ticket } from '../tickets/ticket.model';
import { Asset, AssetStatus, AssetType, DepreciationMethod } from './asset.model';
import { AssetAssignment, AssignedToType } from './assetAssignment.model';
import { AssetHistory, AssetFieldChange } from './assetHistory.model';

export interface CreateAssetInput {
  name: string;
  type: AssetType;
  status?: AssetStatus;
  serialNumber?: string | null;
  vendorId?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  licenseSeatsPurchased?: number | null;
  purchaseCost?: number | null;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number | null;
  customFields?: Record<string, string | number | boolean | null>;
  notes?: string | null;
}

function diffFields(before: Record<string, unknown>, input: Record<string, unknown>): Record<string, AssetFieldChange> {
  const changes: Record<string, AssetFieldChange> = {};
  for (const key of Object.keys(input)) {
    const newValue = input[key];
    const oldValue = before[key];
    const changed =
      typeof newValue === 'object' && newValue !== null
        ? JSON.stringify(newValue) !== JSON.stringify(oldValue)
        : newValue !== oldValue;
    if (changed) changes[key] = { from: oldValue, to: newValue };
  }
  return changes;
}

export async function createAsset(input: CreateAssetInput, actorId: string): Promise<Asset> {
  const asset = await Asset.create({ customFields: {}, ...input });
  await AssetHistory.create({ assetId: asset.id, changedById: actorId, action: 'created', changes: null });
  return asset;
}

export interface ListAssetsFilter {
  type?: AssetType;
  status?: AssetStatus;
  vendorId?: string;
}

export async function listAssets(filter: ListAssetsFilter): Promise<Asset[]> {
  const where: Record<string, unknown> = {};
  if (filter.type) where.type = filter.type;
  if (filter.status) where.status = filter.status;
  if (filter.vendorId) where.vendorId = filter.vendorId;
  return Asset.findAll({ where, order: [['name', 'ASC']] });
}

export async function getAsset(id: string): Promise<Asset> {
  const asset = await Asset.findByPk(id);
  if (!asset) throw new NotFoundError('Asset not found');
  return asset;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

export async function updateAsset(id: string, input: UpdateAssetInput, actorId: string): Promise<Asset> {
  const asset = await getAsset(id);
  const before = asset.toJSON() as unknown as Record<string, unknown>;
  await asset.update(input);
  const changes = diffFields(before, input as Record<string, unknown>);
  if (Object.keys(changes).length > 0) {
    await AssetHistory.create({ assetId: asset.id, changedById: actorId, action: 'updated', changes });
  }
  return asset;
}

export async function deleteAsset(id: string, actorId: string): Promise<void> {
  const asset = await getAsset(id);
  await AssetHistory.create({ assetId: asset.id, changedById: actorId, action: 'deleted', changes: null });
  await asset.destroy();
}

export async function receiveAsset(id: string, actorId: string): Promise<Asset> {
  const asset = await getAsset(id);
  if (asset.status !== 'ordered') {
    throw new BadRequestError('This asset is not marked as ordered');
  }
  const updates: Record<string, unknown> = { status: 'available' };
  if (!asset.purchaseDate) updates.purchaseDate = new Date().toISOString().slice(0, 10);
  await asset.update(updates);
  await AssetHistory.create({ assetId: asset.id, changedById: actorId, action: 'received', changes: null });
  return asset;
}

// Deliberately does not require the asset to still exist (unlike the other :id endpoints) -
// the audit trail's entire purpose is to survive deletion of the asset it describes, mirroring
// the no-FK-constraint design on AssetHistory.assetId itself.
export async function getAssetAuditLog(assetId: string): Promise<AssetHistory[]> {
  return AssetHistory.findAll({
    where: { assetId },
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'changedBy', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
  });
}

async function getActiveAssignment(assetId: string): Promise<AssetAssignment | null> {
  return AssetAssignment.findOne({ where: { assetId, unassignedAt: null } });
}

export interface AssignInput {
  assignedToType: AssignedToType;
  assignedToUserId?: string | null;
  assignedToLabel?: string | null;
  dueBackAt?: Date | null;
  notes?: string | null;
}

export async function assignAsset(assetId: string, input: AssignInput, actorId: string): Promise<AssetAssignment> {
  const asset = await getAsset(assetId);
  // Hardware/peripheral assets are physically one-at-a-time; software licenses are a seat
  // pool, so multiple concurrent assignments (up to, or even briefly over, the purchased seat
  // count) are expected and are exactly what the license-compliance reconciliation needs to
  // see in order to mean anything.
  if (asset.type !== 'software_license') {
    const existing = await getActiveAssignment(assetId);
    if (existing) {
      throw new BadRequestError('This asset is already assigned/checked out - check it in first');
    }
  }
  if (input.assignedToType === 'user' && !input.assignedToUserId) {
    throw new BadRequestError('assignedToUserId is required when assignedToType is "user"');
  }
  if (input.assignedToType !== 'user' && !input.assignedToLabel) {
    throw new BadRequestError('assignedToLabel is required for location/department assignments');
  }

  const assignment = await AssetAssignment.create({
    assetId,
    assignedToType: input.assignedToType,
    assignedToUserId: input.assignedToType === 'user' ? (input.assignedToUserId ?? null) : null,
    assignedToLabel: input.assignedToType !== 'user' ? (input.assignedToLabel ?? null) : null,
    dueBackAt: input.dueBackAt ?? null,
    notes: input.notes ?? null,
    assignedById: actorId,
  });
  await asset.update({ status: 'in_use' });
  return assignment;
}

export async function checkoutAsset(
  assetId: string,
  input: { assignedToUserId: string; dueBackAt?: Date | null; notes?: string | null },
  actorId: string
): Promise<AssetAssignment> {
  return assignAsset(
    assetId,
    { assignedToType: 'user', assignedToUserId: input.assignedToUserId, dueBackAt: input.dueBackAt, notes: input.notes },
    actorId
  );
}

// assignmentId disambiguates which active assignment to close when a software-license asset
// has several concurrent ones; omitted (the hardware/peripheral case, where at most one can
// ever be active) falls back to "the" single active assignment, preserving existing call sites.
export async function checkinAsset(assetId: string, assignmentId?: string): Promise<AssetAssignment> {
  const asset = await getAsset(assetId);
  const active = assignmentId
    ? await AssetAssignment.findOne({ where: { id: assignmentId, assetId, unassignedAt: null } })
    : await getActiveAssignment(assetId);
  if (!active) {
    throw new BadRequestError('This asset does not have an active assignment to check in');
  }
  await active.update({ unassignedAt: new Date() });

  // Only flip back to 'available' once every concurrent assignment (relevant for multi-seat
  // licenses) has been checked in - closing one seat shouldn't affect the others still deployed.
  const remaining = await AssetAssignment.count({ where: { assetId, unassignedAt: null } });
  if (remaining === 0) {
    await asset.update({ status: 'available' });
  }
  return active;
}

export async function getAssignmentHistory(assetId: string): Promise<AssetAssignment[]> {
  await getAsset(assetId);
  return AssetAssignment.findAll({
    where: { assetId },
    order: [['assignedAt', 'DESC']],
    include: [{ model: User, as: 'assignedToUser', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
  });
}

export async function getLinkedTickets(assetId: string): Promise<Ticket[]> {
  await getAsset(assetId);
  return Ticket.findAll({
    include: [{ model: Asset, as: 'linkedAssets', where: { id: assetId }, attributes: [] }],
    order: [['createdAt', 'DESC']],
  });
}

export interface LicenseComplianceRow {
  assetId: string;
  name: string;
  seatsPurchased: number;
  seatsDeployed: number;
  utilizationPercent: number;
}

export function computeUtilizationPercent(seatsPurchased: number, seatsDeployed: number): number {
  if (seatsPurchased <= 0) return seatsDeployed > 0 ? 100 : 0;
  return Math.round((seatsDeployed / seatsPurchased) * 100);
}

export async function getLicenseCompliance(): Promise<LicenseComplianceRow[]> {
  const licenses = await Asset.findAll({ where: { type: 'software_license' }, order: [['name', 'ASC']] });
  const rows: LicenseComplianceRow[] = [];
  for (const license of licenses) {
    const seatsDeployed = await AssetAssignment.count({ where: { assetId: license.id, unassignedAt: null } });
    const seatsPurchased = license.licenseSeatsPurchased ?? 0;
    rows.push({
      assetId: license.id,
      name: license.name,
      seatsPurchased,
      seatsDeployed,
      utilizationPercent: computeUtilizationPercent(seatsPurchased, seatsDeployed),
    });
  }
  return rows;
}

// --- Bulk actions ---

export interface BulkResult {
  assetId: string;
  success: boolean;
  error?: string;
}

async function runBulk(assetIds: string[], op: (id: string) => Promise<unknown>): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const assetId of assetIds) {
    try {
      await op(assetId);
      results.push({ assetId, success: true });
    } catch (err) {
      results.push({ assetId, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return results;
}

export function bulkChangeStatus(assetIds: string[], status: AssetStatus, actorId: string): Promise<BulkResult[]> {
  return runBulk(assetIds, (id) => updateAsset(id, { status }, actorId));
}

export function bulkSetVendor(assetIds: string[], vendorId: string | null, actorId: string): Promise<BulkResult[]> {
  return runBulk(assetIds, (id) => updateAsset(id, { vendorId }, actorId));
}

export function bulkDelete(assetIds: string[], actorId: string): Promise<BulkResult[]> {
  return runBulk(assetIds, (id) => deleteAsset(id, actorId));
}
