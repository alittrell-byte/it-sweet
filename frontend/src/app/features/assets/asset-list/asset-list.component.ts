import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  Asset,
  ASSET_STATUSES,
  ASSET_TYPES,
  AssetStatus,
  AssetType,
  CsvImportRowResult,
  Vendor,
} from '../../../core/models/asset.model';
import { AssetService } from '../services/asset.service';

const STATUS_BADGE: Record<AssetStatus, string> = {
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-blue-100 text-blue-800',
  retired: 'bg-gray-200 text-gray-700',
  lost: 'bg-red-100 text-red-800',
  under_repair: 'bg-amber-100 text-amber-800',
  ordered: 'bg-purple-100 text-purple-800',
};

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="max-w-5xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Assets</h1>
        <div class="flex gap-2 items-center">
          @if (auth.hasPermission('assets.import_export')) {
            <a [href]="exportUrl" class="text-sm px-3 py-1.5 rounded border hover:bg-gray-50">Export CSV</a>
            <label class="text-sm px-3 py-1.5 rounded border hover:bg-gray-50 cursor-pointer">
              Import CSV
              <input type="file" accept=".csv" class="hidden" (change)="onImportFile($event)" />
            </label>
          }
          @if (auth.hasPermission('assets.create')) {
            <a routerLink="/assets/new" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
              + Quick Add
            </a>
          }
        </div>
      </div>

      @if (importResults(); as results) {
        <div class="bg-white rounded-lg shadow p-4 text-sm">
          <div class="font-medium mb-2">Import results</div>
          @for (r of results; track r.row) {
            <div [class.text-red-600]="r.status === 'error'" [class.text-green-700]="r.status !== 'error'">
              Row {{ r.row }}: {{ r.status }}{{ r.error ? ' - ' + r.error : '' }}
            </div>
          }
        </div>
      }

      <div class="flex gap-2">
        <select (change)="onTypeChange($event)" class="text-sm border rounded px-2 py-1">
          <option value="">All types</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        <select (change)="onStatusChange($event)" class="text-sm border rounded px-2 py-1">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>

      @if (selectedIds().size > 0) {
        <div class="bg-slate-100 rounded-lg p-3 flex items-center gap-2 flex-wrap text-sm">
          <span class="font-medium">{{ selectedIds().size }} selected</span>

          <select [(ngModel)]="bulkStatus" class="border rounded px-2 py-1">
            <option value="">Set status...</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
          <button (click)="applyBulkStatus()" class="px-2 py-1 rounded border">Apply</button>

          @if (vendors().length > 0) {
            <select [(ngModel)]="bulkVendorId" class="border rounded px-2 py-1">
              <option value="">Set vendor...</option>
              @for (v of vendors(); track v.id) {
                <option [value]="v.id">{{ v.name }}</option>
              }
            </select>
            <button (click)="applyBulkVendor()" class="px-2 py-1 rounded border">Apply</button>
          }

          @if (auth.hasPermission('assets.delete')) {
            <button (click)="applyBulkDelete()" class="px-2 py-1 rounded border text-red-600 hover:bg-red-50">Delete Selected</button>
          }

          <button (click)="clearSelection()" class="ml-auto text-slate-600 hover:underline">Clear selection</button>
        </div>
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (asset of assets(); track asset.id) {
          <div class="flex items-center px-4 py-3 hover:bg-gray-50">
            @if (auth.hasPermission('assets.edit')) {
              <input type="checkbox" class="mr-3" [checked]="selectedIds().has(asset.id)" (change)="toggleSelected(asset.id)" />
            }
            <a [routerLink]="['/assets', asset.id]" class="flex-1 flex items-center justify-between">
              <div>
                <div class="font-medium text-sm">{{ asset.name }}</div>
                <div class="text-xs text-gray-500">
                  {{ asset.type }}{{ asset.serialNumber ? ' · ' + asset.serialNumber : '' }}{{ asset.vendor ? ' · ' + asset.vendor.name : '' }}
                </div>
              </div>
              <span class="text-xs px-2 py-1 rounded" [class]="STATUS_BADGE[asset.status]">{{ asset.status }}</span>
            </a>
          </div>
        } @empty {
          <div class="px-4 py-8 text-center text-gray-500">No assets yet.</div>
        }
      </div>
    </div>
  `,
})
export class AssetListComponent implements OnInit {
  readonly assets = signal<Asset[]>([]);
  readonly importResults = signal<CsvImportRowResult[] | null>(null);
  readonly vendors = signal<Vendor[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly types = ASSET_TYPES;
  readonly statuses = ASSET_STATUSES;
  readonly STATUS_BADGE = STATUS_BADGE;
  readonly exportUrl: string;
  bulkStatus = '';
  bulkVendorId = '';

  private currentType: AssetType | undefined;
  private currentStatus: AssetStatus | undefined;

  constructor(
    readonly auth: AuthService,
    private readonly assetService: AssetService
  ) {
    this.exportUrl = assetService.exportCsvUrl();
  }

  async ngOnInit(): Promise<void> {
    await this.load();
    if (this.auth.hasPermission('assets.edit')) {
      this.vendors.set(await this.assetService.listVendors());
    }
  }

  async load(): Promise<void> {
    this.assets.set(await this.assetService.list({ type: this.currentType, status: this.currentStatus }));
    this.selectedIds.set(new Set());
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.currentType = (value || undefined) as AssetType | undefined;
    this.load();
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.currentStatus = (value || undefined) as AssetStatus | undefined;
    this.load();
  }

  async onImportFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const res = await this.assetService.importCsv(file);
    this.importResults.set(res.results);
    await this.load();
  }

  toggleSelected(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async applyBulkStatus(): Promise<void> {
    if (!this.bulkStatus) return;
    await this.assetService.bulkChangeStatus([...this.selectedIds()], this.bulkStatus as AssetStatus);
    this.bulkStatus = '';
    await this.load();
  }

  async applyBulkVendor(): Promise<void> {
    if (!this.bulkVendorId) return;
    await this.assetService.bulkSetVendor([...this.selectedIds()], this.bulkVendorId);
    this.bulkVendorId = '';
    await this.load();
  }

  async applyBulkDelete(): Promise<void> {
    if (!confirm(`Delete ${this.selectedIds().size} asset(s)? This cannot be undone.`)) return;
    await this.assetService.bulkDelete([...this.selectedIds()]);
    await this.load();
  }
}
