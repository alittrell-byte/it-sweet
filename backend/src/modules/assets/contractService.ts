import { NotFoundError } from '../../common/errors';
import { Vendor } from './vendor.model';
import { Asset } from './asset.model';
import { Contract, ContractType } from './contract.model';

const CONTRACT_INCLUDES = [
  { model: Vendor, as: 'vendor' },
  { model: Asset, as: 'asset' },
];

export interface ListContractsFilter {
  vendorId?: string;
  assetId?: string;
}

export function listContracts(filter: ListContractsFilter = {}): Promise<Contract[]> {
  const where: Record<string, unknown> = {};
  if (filter.vendorId) where.vendorId = filter.vendorId;
  if (filter.assetId) where.assetId = filter.assetId;
  return Contract.findAll({ where, order: [['endDate', 'ASC']], include: CONTRACT_INCLUDES });
}

export async function getContract(id: string): Promise<Contract> {
  const contract = await Contract.findByPk(id, { include: CONTRACT_INCLUDES });
  if (!contract) throw new NotFoundError('Contract not found');
  return contract;
}

export interface ContractInput {
  vendorId: string;
  assetId?: string | null;
  type: ContractType;
  startDate?: string | null;
  endDate?: string | null;
  cost?: number | null;
  autoRenew?: boolean;
  notes?: string | null;
}

export async function createContract(input: ContractInput): Promise<Contract> {
  const contract = await Contract.create(input);
  return getContract(contract.id);
}

export async function updateContract(id: string, input: Partial<ContractInput>): Promise<Contract> {
  const contract = await Contract.findByPk(id);
  if (!contract) throw new NotFoundError('Contract not found');
  // Editing the end date is exactly how a renewal gets recorded - clear the alert flag so a
  // future approach-of-expiry on the new date can trigger a fresh reminder.
  const updates = input.endDate !== undefined && input.endDate !== contract.endDate ? { ...input, renewalAlertedAt: null } : input;
  await contract.update(updates);
  return getContract(id);
}

export async function deleteContract(id: string): Promise<void> {
  const contract = await Contract.findByPk(id);
  if (!contract) throw new NotFoundError('Contract not found');
  await contract.destroy();
}
