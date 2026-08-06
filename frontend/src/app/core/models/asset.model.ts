export type AssetType = 'hardware' | 'software_license' | 'peripheral';
export type AssetStatus = 'available' | 'in_use' | 'retired' | 'lost' | 'under_repair';
export type AssignedToType = 'user' | 'location' | 'department';
export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string | null;
  vendor: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  licenseSeatsPurchased: number | null;
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

export interface AssetCustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
}

export interface LicenseComplianceRow {
  assetId: string;
  name: string;
  seatsPurchased: number;
  seatsDeployed: number;
  utilizationPercent: number;
}

export interface CsvImportRowResult {
  row: number;
  status: 'created' | 'updated' | 'error';
  error?: string;
}

export const ASSET_TYPES: AssetType[] = ['hardware', 'software_license', 'peripheral'];
export const ASSET_STATUSES: AssetStatus[] = ['available', 'in_use', 'retired', 'lost', 'under_repair'];
