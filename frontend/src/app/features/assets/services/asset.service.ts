import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Asset,
  AssetAssignment,
  AssetCustomFieldDefinition,
  AssetHistoryEntry,
  AssetStatus,
  AssetType,
  AssignedToType,
  BulkResult,
  Contract,
  ContractType,
  CsvImportRowResult,
  CustomFieldType,
  DepreciationRow,
  LicenseComplianceRow,
  Vendor,
} from '../../../core/models/asset.model';
import { Ticket } from '../../../core/models/ticket.model';

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
  depreciationMethod?: 'none' | 'straight_line';
  usefulLifeMonths?: number | null;
  customFields?: Record<string, string | number | boolean | null>;
  notes?: string | null;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

@Injectable({ providedIn: 'root' })
export class AssetService {
  constructor(private readonly http: HttpClient) {}

  list(filter: { type?: AssetType; status?: AssetStatus; vendorId?: string } = {}): Promise<Asset[]> {
    const params: Record<string, string> = {};
    if (filter.type) params['type'] = filter.type;
    if (filter.status) params['status'] = filter.status;
    if (filter.vendorId) params['vendorId'] = filter.vendorId;
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

  receive(id: string): Promise<Asset> {
    return firstValueFrom(this.http.post<Asset>(`/api/assets/${id}/receive`, {}));
  }

  auditLog(id: string): Promise<AssetHistoryEntry[]> {
    return firstValueFrom(this.http.get<AssetHistoryEntry[]>(`/api/assets/${id}/audit-log`));
  }

  assign(id: string, input: { assignedToType: AssignedToType; assignedToUserId?: string; assignedToLabel?: string; notes?: string }) {
    return firstValueFrom(this.http.post(`/api/assets/${id}/assign`, input));
  }

  checkout(id: string, input: { assignedToUserId: string; dueBackAt?: string; notes?: string }) {
    return firstValueFrom(this.http.post(`/api/assets/${id}/checkout`, input));
  }

  checkin(id: string, assignmentId?: string) {
    return firstValueFrom(this.http.post(`/api/assets/${id}/checkin`, assignmentId ? { assignmentId } : {}));
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

  depreciationReport(): Promise<DepreciationRow[]> {
    return firstValueFrom(this.http.get<DepreciationRow[]>('/api/assets/depreciation-report'));
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

  createCustomFieldDefinition(input: { key: string; label: string; fieldType: CustomFieldType; assetType?: AssetType | null }) {
    return firstValueFrom(this.http.post<AssetCustomFieldDefinition>('/api/assets/custom-field-definitions', input));
  }

  deleteCustomFieldDefinition(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/assets/custom-field-definitions/${id}`));
  }

  // --- Bulk actions ---

  bulkChangeStatus(assetIds: string[], status: AssetStatus): Promise<BulkResult[]> {
    return firstValueFrom(this.http.patch<BulkResult[]>('/api/assets/bulk/status', { assetIds, status }));
  }

  bulkSetVendor(assetIds: string[], vendorId: string | null): Promise<BulkResult[]> {
    return firstValueFrom(this.http.patch<BulkResult[]>('/api/assets/bulk/vendor', { assetIds, vendorId }));
  }

  bulkDelete(assetIds: string[]): Promise<BulkResult[]> {
    return firstValueFrom(this.http.request<BulkResult[]>('DELETE', '/api/assets/bulk', { body: { assetIds } }));
  }

  // --- Vendors ---

  listVendors(): Promise<Vendor[]> {
    return firstValueFrom(this.http.get<Vendor[]>('/api/vendors'));
  }

  createVendor(input: Omit<Vendor, 'id'>): Promise<Vendor> {
    return firstValueFrom(this.http.post<Vendor>('/api/vendors', input));
  }

  updateVendor(id: string, input: Partial<Omit<Vendor, 'id'>>): Promise<Vendor> {
    return firstValueFrom(this.http.patch<Vendor>(`/api/vendors/${id}`, input));
  }

  deleteVendor(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/vendors/${id}`));
  }

  // --- Contracts ---

  listContracts(filter: { vendorId?: string; assetId?: string } = {}): Promise<Contract[]> {
    const params: Record<string, string> = {};
    if (filter.vendorId) params['vendorId'] = filter.vendorId;
    if (filter.assetId) params['assetId'] = filter.assetId;
    return firstValueFrom(this.http.get<Contract[]>('/api/contracts', { params }));
  }

  createContract(input: {
    vendorId: string;
    assetId?: string | null;
    type: ContractType;
    startDate?: string | null;
    endDate?: string | null;
    cost?: number | null;
    autoRenew?: boolean;
    notes?: string | null;
  }): Promise<Contract> {
    return firstValueFrom(this.http.post<Contract>('/api/contracts', input));
  }

  updateContract(id: string, input: Partial<Parameters<AssetService['createContract']>[0]>): Promise<Contract> {
    return firstValueFrom(this.http.patch<Contract>(`/api/contracts/${id}`, input));
  }

  deleteContract(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/contracts/${id}`));
  }
}
