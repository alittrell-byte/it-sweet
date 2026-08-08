export type PatchPlatform = 'windows' | 'linux' | 'macos' | 'other';
export type PatchClassification = 'security' | 'critical' | 'feature' | 'other';
export type PatchSeverity = 'critical' | 'important' | 'moderate' | 'low';
export type PatchApprovalStatus = 'pending' | 'approved' | 'declined';
export type AssetPatchStatusValue = 'missing' | 'installed' | 'failed' | 'pending_reboot';
export type MaintenanceWindowRecurrence = 'once' | 'weekly' | 'monthly';

export const PATCH_PLATFORMS: PatchPlatform[] = ['windows', 'linux', 'macos', 'other'];
export const PATCH_CLASSIFICATIONS: PatchClassification[] = ['security', 'critical', 'feature', 'other'];
export const PATCH_SEVERITIES: PatchSeverity[] = ['critical', 'important', 'moderate', 'low'];

export interface Patch {
  id: string;
  platform: PatchPlatform;
  externalId: string;
  title: string;
  description: string | null;
  classification: PatchClassification;
  severity: PatchSeverity;
  cveIds: string[] | null;
  releaseDate: string | null;
  approvalStatus: PatchApprovalStatus;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface AssetPatchStatus {
  id: string;
  assetId: string;
  patchId: string;
  patch?: Patch;
  status: AssetPatchStatusValue;
  lastCheckedAt: string;
  installedAt: string | null;
  failureReason: string | null;
  missingSinceAt: string | null;
}

export interface PatchAgentKey {
  id: string;
  assetId: string;
  apiKey: string;
}

export interface MaintenanceWindow {
  id: string;
  name: string;
  teamId: string | null;
  team?: { id: string; name: string } | null;
  startsAt: string;
  endsAt: string;
  recurrence: MaintenanceWindowRecurrence;
  notes: string | null;
}

export interface ComplianceReportRow {
  assetId: string;
  assetName: string;
  compliantCount: number;
  missingCount: number;
  failedCount: number;
  compliancePercent: number;
}
