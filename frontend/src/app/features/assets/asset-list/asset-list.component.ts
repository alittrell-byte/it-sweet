import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Asset, ASSET_STATUSES, ASSET_TYPES, AssetStatus, AssetType, CsvImportRowResult } from '../../../core/models/asset.model';
import { AssetService } from '../services/asset.service';

const STATUS_BADGE: Record<AssetStatus, string> = {
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-blue-100 text-blue-800',
  retired: 'bg-gray-200 text-gray-700',
  lost: 'bg-red-100 text-red-800',
  under_repair: 'bg-amber-100 text-amber-800',
};

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [RouterLink],
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

      <div class="bg-white rounded-lg shadow divide-y">
        @for (asset of assets(); track asset.id) {
          <a [routerLink]="['/assets', asset.id]" class="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div>
              <div class="font-medium text-sm">{{ asset.name }}</div>
              <div class="text-xs text-gray-500">
                {{ asset.type }}{{ asset.serialNumber ? ' · ' + asset.serialNumber : '' }}{{ asset.vendor ? ' · ' + asset.vendor : '' }}
              </div>
            </div>
            <span class="text-xs px-2 py-1 rounded" [class]="STATUS_BADGE[asset.status]">{{ asset.status }}</span>
          </a>
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
  readonly types = ASSET_TYPES;
  readonly statuses = ASSET_STATUSES;
  readonly STATUS_BADGE = STATUS_BADGE;
  readonly exportUrl: string;

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
  }

  async load(): Promise<void> {
    this.assets.set(await this.assetService.list({ type: this.currentType, status: this.currentStatus }));
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
}
