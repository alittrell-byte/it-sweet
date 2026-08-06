import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Asset,
  AssetAssignment,
  AssetCustomFieldDefinition,
  AssetStatus,
  AssetType,
  AssignedToType,
  CsvImportRowResult,
  CustomFieldType,
  LicenseComplianceRow,
} from '../../../core/models/asset.model';
import { Ticket } from '../../../core/models/ticket.model';

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

export type UpdateAssetInput = Partial<CreateAssetInput>;

@Injectable({ providedIn: 'root' })
export class AssetService {
  constructor(private readonly http: HttpClient) {}

  list(filter: { type?: AssetType; status?: AssetStatus } = {}): Promise<Asset[]> {
    const params: Record<string, string> = {};
    if (filter.type) params['type'] = filter.type;
    if (filter.status) params['status'] = filter.status;
    return firstValueFrom(this.http.get<Asset[]>('/api/assets', { params }));
  }

  get(id: string): Promise<Asset> {
    return firstValueFrom(this.http.get<Asset>(`/api/assets/${id}`));
  }

  create(input: CreateAssetInput): Promise<Asset> {
    return firstValueFrom(this.http.post<Asset>('/api/assets', input));
  }

  update(id: string, input: UpdateAssetInput): Promise<Asset> {
    return firstValueFrom(this.http.patch<Asset>(`/api/assets/${id}`, input));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/assets/${id}`));
  }

  assign(id: string, input: { assignedToType: AssignedToType; assignedToUserId?: string; assignedToLabel?: string; notes?: string }) {
    return firstValueFrom(this.http.post(`/api/assets/${id}/assign`, input));
  }

  checkout(id: string, input: { assignedToUserId: string; dueBackAt?: string; notes?: string }) {
    return firstValueFrom(this.http.post(`/api/assets/${id}/checkout`, input));
  }

  checkin(id: string) {
    return firstValueFrom(this.http.post(`/api/assets/${id}/checkin`, {}));
  }

  history(id: string): Promise<AssetAssignment[]> {
    return firstValueFrom(this.http.get<AssetAssignment[]>(`/api/assets/${id}/history`));
  }

  linkedTickets(id: string): Promise<Ticket[]> {
    return firstValueFrom(this.http.get<Ticket[]>(`/api/assets/${id}/tickets`));
  }

  licenseCompliance(): Promise<LicenseComplianceRow[]> {
    return firstValueFrom(this.http.get<LicenseComplianceRow[]>('/api/assets/license-compliance'));
  }

  exportCsvUrl(): string {
    return '/api/assets/export.csv';
  }

  importCsv(file: File): Promise<{ results: CsvImportRowResult[] }> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<{ results: CsvImportRowResult[] }>('/api/assets/import', form));
  }

  listCustomFieldDefinitions(): Promise<AssetCustomFieldDefinition[]> {
    return firstValueFrom(this.http.get<AssetCustomFieldDefinition[]>('/api/assets/custom-field-definitions'));
  }

  createCustomFieldDefinition(input: { key: string; label: string; fieldType: CustomFieldType }) {
    return firstValueFrom(this.http.post<AssetCustomFieldDefinition>('/api/assets/custom-field-definitions', input));
  }

  deleteCustomFieldDefinition(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/assets/custom-field-definitions/${id}`));
  }
}
