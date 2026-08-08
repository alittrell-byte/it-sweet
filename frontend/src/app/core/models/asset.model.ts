export type AssetType = 'hardware' | 'software_license' | 'peripheral';
export type AssetStatus = 'available' | 'in_use' | 'retired' | 'lost' | 'under_repair' | 'ordered';
export type AssignedToType = 'user' | 'location' | 'department';
export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean';
export type DepreciationMethod = 'none' | 'straight_line';
export type ContractType = 'support' | 'maintenance' | 'license' | 'other';
export type AssetHistoryAction = 'created' | 'updated' | 'deleted' | 'received';

export interface Vendor {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
}

export interface Contract {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  assetId: string | null;
  asset?: { id: string; name: string } | null;
  type: ContractType;
  startDate: string | null;
  endDate: string | null;
  cost: number | null;
  autoRenew: boolean;
  notes: string | null;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string | null;
  vendorId: string | null;
  vendor?: Vendor | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  licenseSeatsPurchased: number | null;
  purchaseCost: number | null;
  depreciationMethod: DepreciationMethod;
  usefulLifeMonths: number | null;
  customFields: Record<string, string | number | boolean | null>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  assignedToType: AssignedToType;
  assignedToUserId: string | null;
  assignedToUser?: { id: string; displayName: string } | null;
  assignedToLabel: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  dueBackAt: string | null;
  notes: string | null;
}

export interface AssetHistoryEntry {
  id: string;
  assetId: string;
  changedById: string;
  changedBy?: { id: string; displayName: string };
  action: AssetHistoryAction;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
}

export interface AssetCustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  assetType: AssetType | null;
}

export interface LicenseComplianceRow {
  assetId: string;
  name: string;
  seatsPurchased: number;
  seatsDeployed: number;
  utilizationPercent: number;
}

export interface DepreciationRow {
  assetId: string;
  name: string;
  purchaseCost: number;
  usefulLifeMonths: number;
  purchaseDate: string;
  currentValue: number;
  accumulatedDepreciation: number;
}

export interface CsvImportRowResult {
  row: number;
  status: 'created' | 'updated' | 'error';
  error?: string;
}

export interface BulkResult {
  assetId: string;
  success: boolean;
  error?: string;
}

export const ASSET_TYPES: AssetType[] = ['hardware', 'software_license', 'peripheral'];
export const ASSET_STATUSES: AssetStatus[] = ['available', 'in_use', 'retired', 'lost', 'under_repair', 'ordered'];
