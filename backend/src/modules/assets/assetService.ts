import { BadRequestError, NotFoundError } from '../../common/errors';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Ticket } from '../tickets/ticket.model';
import { Asset, AssetStatus, AssetType } from './asset.model';
import { AssetAssignment, AssignedToType } from './assetAssignment.model';

export interface CreateAssetInput {
  name: string;
  type: AssetType;
  status?: AssetStatus;
  serialNumber?: string | null;
  vendor?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  licenseSeatsPurchased?: number | null;
  customFields?: Record<string, string | number | boolean | null>;
  notes?: string | null;
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  return Asset.create({ customFields: {}, ...input });
}

export interface ListAssetsFilter {
  type?: AssetType;
  status?: AssetStatus;
}

export async function listAssets(filter: ListAssetsFilter): Promise<Asset[]> {
  const where: Record<string, unknown> = {};
  if (filter.type) where.type = filter.type;
  if (filter.status) where.status = filter.status;
  return Asset.findAll({ where, order: [['name', 'ASC']] });
}

export async function getAsset(id: string): Promise<Asset> {
  const asset = await Asset.findByPk(id);
  if (!asset) throw new NotFoundError('Asset not found');
  return asset;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<Asset> {
  const asset = await getAsset(id);
  await asset.update(input);
  return asset;
}

export async function deleteAsset(id: string): Promise<void> {
  const asset = await getAsset(id);
  await asset.destroy();
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
  const existing = await getActiveAssignment(assetId);
  if (existing) {
    throw new BadRequestError('This asset is already assigned/checked out - check it in first');
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

export async function checkinAsset(assetId: string): Promise<AssetAssignment> {
  const asset = await getAsset(assetId);
  const active = await getActiveAssignment(assetId);
  if (!active) {
    throw new BadRequestError('This asset does not have an active assignment to check in');
  }
  await active.update({ unassignedAt: new Date() });
  await asset.update({ status: 'available' });
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
