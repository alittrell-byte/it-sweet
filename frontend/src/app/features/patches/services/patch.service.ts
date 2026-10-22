import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Team } from '../../../core/models/ticket.model';
import {
  AssetPatchStatus,
  ComplianceReportRow,
  IssuedPatchAgentKey,
  MaintenanceWindow,
  MaintenanceWindowRecurrence,
  Patch,
  PatchAgentKey,
  PatchApprovalStatus,
  PatchClassification,
  PatchPlatform,
} from '../../../core/models/patch.model';

export interface PatchCatalogFilter {
  platform?: PatchPlatform;
  classification?: PatchClassification;
  approvalStatus?: PatchApprovalStatus;
}

export interface MaintenanceWindowInput {
  name: string;
  teamId?: string | null;
  startsAt: string;
  endsAt: string;
  recurrence?: MaintenanceWindowRecurrence;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PatchService {
  constructor(private readonly http: HttpClient) {}

  listPatches(filter: PatchCatalogFilter = {}): Promise<Patch[]> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value) params[key] = String(value);
    }
    return firstValueFrom(this.http.get<Patch[]>('/api/patches', { params }));
  }

  approvePatch(id: string): Promise<Patch> {
    return firstValueFrom(this.http.patch<Patch>(`/api/patches/${id}/approve`, {}));
  }

  declinePatch(id: string): Promise<Patch> {
    return firstValueFrom(this.http.patch<Patch>(`/api/patches/${id}/decline`, {}));
  }

  complianceReport(): Promise<ComplianceReportRow[]> {
    return firstValueFrom(this.http.get<ComplianceReportRow[]>('/api/patches/compliance-report'));
  }

  assetPatchStatuses(assetId: string): Promise<AssetPatchStatus[]> {
    return firstValueFrom(this.http.get<AssetPatchStatus[]>(`/api/patches/assets/${assetId}/status`));
  }

  /** Metadata for the asset's agent key, or null when none has been issued yet. */
  async getAgentKey(assetId: string): Promise<PatchAgentKey | null> {
    try {
      return await firstValueFrom(this.http.get<PatchAgentKey>(`/api/patches/assets/${assetId}/agent-key`));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) return null;
      throw err;
    }
  }

  generateAgentKey(assetId: string): Promise<IssuedPatchAgentKey> {
    return firstValueFrom(this.http.post<IssuedPatchAgentKey>(`/api/patches/assets/${assetId}/agent-key`, {}));
  }

  rotateAgentKey(assetId: string): Promise<IssuedPatchAgentKey> {
    return firstValueFrom(this.http.post<IssuedPatchAgentKey>(`/api/patches/assets/${assetId}/agent-key/rotate`, {}));
  }

  listMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    return firstValueFrom(this.http.get<MaintenanceWindow[]>('/api/patches/maintenance-windows'));
  }

  createMaintenanceWindow(input: MaintenanceWindowInput): Promise<MaintenanceWindow> {
    return firstValueFrom(this.http.post<MaintenanceWindow>('/api/patches/maintenance-windows', input));
  }

  deleteMaintenanceWindow(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/patches/maintenance-windows/${id}`));
  }

  listTeams(): Promise<Team[]> {
    return firstValueFrom(this.http.get<Team[]>('/api/teams'));
  }
}
