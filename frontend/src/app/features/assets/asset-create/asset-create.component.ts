import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ASSET_TYPES, AssetCustomFieldDefinition, AssetType, DepreciationMethod, Vendor } from '../../../core/models/asset.model';
import { extractApiError } from '../../../core/utils/api-error';
import { AssetService } from '../services/asset.service';

@Component({
  selector: 'app-asset-create',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h1 class="text-xl font-semibold mb-1">Quick Add Asset</h1>
      <p class="text-sm text-gray-500 mb-4">Only name and type are required - fill in the rest now or later.</p>
      <form (ngSubmit)="submit()" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Name</label>
          <input type="text" name="name" [(ngModel)]="name" required class="mt-1 w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Type</label>
          <select name="type" [(ngModel)]="type" class="mt-1 w-full border rounded px-3 py-2">
            @for (t of types; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" [(ngModel)]="onOrder" name="onOrder" />
          This has been ordered but not received yet
        </label>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Serial Number</label>
            <input type="text" name="serialNumber" [(ngModel)]="serialNumber" class="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Vendor</label>
            <select name="vendorId" [(ngModel)]="vendorId" class="mt-1 w-full border rounded px-3 py-2">
              <option [ngValue]="null">None</option>
              @for (v of vendors(); track v.id) {
                <option [ngValue]="v.id">{{ v.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Purchase Date</label>
            <input type="date" name="purchaseDate" [(ngModel)]="purchaseDate" class="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Warranty Expiry</label>
            <input type="date" name="warrantyExpiry" [(ngModel)]="warrantyExpiry" class="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Purchase Cost</label>
            <input type="number" min="0" step="0.01" name="purchaseCost" [(ngModel)]="purchaseCost" class="mt-1 w-full border rounded px-3 py-2" />
          </div>
          @if (type === 'software_license') {
            <div>
              <label class="block text-sm font-medium text-gray-700">License Seats Purchased</label>
              <input type="number" min="0" name="seats" [(ngModel)]="licenseSeatsPurchased" class="mt-1 w-full border rounded px-3 py-2" />
            </div>
          }
        </div>

        <div class="border-t pt-4">
          <label class="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              [ngModel]="depreciationMethod === 'straight_line'"
              (ngModelChange)="depreciationMethod = $event ? 'straight_line' : 'none'"
              name="trackDepreciation"
            />
            Track straight-line depreciation
          </label>
          @if (depreciationMethod === 'straight_line') {
            <div>
              <label class="block text-sm font-medium text-gray-700">Useful Life (months)</label>
              <input type="number" min="1" name="usefulLifeMonths" [(ngModel)]="usefulLifeMonths" class="mt-1 w-full border rounded px-3 py-2" />
            </div>
          }
        </div>

        @if (relevantCustomFieldDefs().length > 0) {
          <div class="border-t pt-4">
            <div class="text-sm font-medium text-gray-700 mb-2">Custom Fields</div>
            @for (def of relevantCustomFieldDefs(); track def.key) {
              <div class="mb-2">
                <label class="block text-xs text-gray-600">{{ def.label }}</label>
                <input
                  [type]="def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : 'text'"
                  [ngModel]="customFieldValues[def.key]"
                  (ngModelChange)="customFieldValues[def.key] = $event"
                  [name]="'cf_' + def.key"
                  class="mt-1 w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            }
          </div>
        }

        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700">Create Asset</button>
      </form>
    </div>
  `,
})
export class AssetCreateComponent implements OnInit {
  name = '';
  type: AssetType = 'hardware';
  onOrder = false;
  serialNumber = '';
  vendorId: string | null = null;
  purchaseDate = '';
  warrantyExpiry = '';
  purchaseCost: number | null = null;
  licenseSeatsPurchased: number | null = null;
  depreciationMethod: DepreciationMethod = 'none';
  usefulLifeMonths: number | null = null;
  customFieldValues: Record<string, string> = {};
  readonly types = ASSET_TYPES;
  readonly customFieldDefs = signal<AssetCustomFieldDefinition[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly error = signal<string | null>(null);

  constructor(
    private readonly assetService: AssetService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.customFieldDefs.set(await this.assetService.listCustomFieldDefinitions());
    this.vendors.set(await this.assetService.listVendors());
  }

  relevantCustomFieldDefs(): AssetCustomFieldDefinition[] {
    return this.customFieldDefs().filter((d) => d.assetType === null || d.assetType === this.type);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    try {
      const asset = await this.assetService.create({
        name: this.name,
        type: this.type,
        status: this.onOrder ? 'ordered' : undefined,
        serialNumber: this.serialNumber || null,
        vendorId: this.vendorId,
        purchaseDate: this.purchaseDate || null,
        warrantyExpiry: this.warrantyExpiry || null,
        purchaseCost: this.purchaseCost,
        licenseSeatsPurchased: this.type === 'software_license' ? this.licenseSeatsPurchased : null,
        depreciationMethod: this.depreciationMethod,
        usefulLifeMonths: this.depreciationMethod === 'straight_line' ? this.usefulLifeMonths : null,
        customFields: this.customFieldValues,
      });
      this.router.navigate(['/assets', asset.id]);
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the asset.'));
    }
  }
}
