import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Asset, Contract, ContractType, Vendor } from '../../../core/models/asset.model';
import { extractApiError } from '../../../core/utils/api-error';
import { AssetService } from '../../assets/services/asset.service';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-3xl mx-auto space-y-8">
      <div class="space-y-4">
        <h1 class="text-xl font-semibold">Vendors</h1>

        <form (ngSubmit)="createVendor()" class="bg-white p-4 rounded-lg shadow grid grid-cols-2 gap-2">
          <input [(ngModel)]="vendorName" name="vendorName" placeholder="Name" required class="border rounded px-2 py-1.5 text-sm" />
          <input [(ngModel)]="vendorContactName" name="vendorContactName" placeholder="Contact name" class="border rounded px-2 py-1.5 text-sm" />
          <input [(ngModel)]="vendorContactEmail" name="vendorContactEmail" placeholder="Contact email" class="border rounded px-2 py-1.5 text-sm" />
          <input [(ngModel)]="vendorContactPhone" name="vendorContactPhone" placeholder="Contact phone" class="border rounded px-2 py-1.5 text-sm" />
          <button type="submit" class="col-span-2 bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
            Add Vendor
          </button>
        </form>
        @if (vendorError()) {
          <p class="text-sm text-red-600">{{ vendorError() }}</p>
        }

        <div class="bg-white rounded-lg shadow divide-y">
          @for (v of vendors(); track v.id) {
            <div class="p-4 flex justify-between items-center">
              <div>
                <div class="font-medium text-sm">{{ v.name }}</div>
                <div class="text-xs text-gray-500">{{ v.contactName }} {{ v.contactEmail ? '· ' + v.contactEmail : '' }}</div>
              </div>
              <button (click)="removeVendor(v)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          } @empty {
            <p class="p-4 text-sm text-gray-400">No vendors yet.</p>
          }
        </div>
      </div>

      <div class="space-y-4">
        <h1 class="text-xl font-semibold">Contracts</h1>

        <form (ngSubmit)="createContract()" class="bg-white p-4 rounded-lg shadow space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <select [(ngModel)]="contractVendorId" name="contractVendorId" required class="border rounded px-2 py-1.5 text-sm">
              <option value="">Select vendor...</option>
              @for (v of vendors(); track v.id) {
                <option [value]="v.id">{{ v.name }}</option>
              }
            </select>
            <select [(ngModel)]="contractAssetId" name="contractAssetId" class="border rounded px-2 py-1.5 text-sm">
              <option [ngValue]="null">No specific asset</option>
              @for (a of assets(); track a.id) {
                <option [value]="a.id">{{ a.name }}</option>
              }
            </select>
            <select [(ngModel)]="contractType" name="contractType" class="border rounded px-2 py-1.5 text-sm">
              <option value="support">Support</option>
              <option value="maintenance">Maintenance</option>
              <option value="license">License</option>
              <option value="other">Other</option>
            </select>
            <input type="number" min="0" step="0.01" [(ngModel)]="contractCost" name="contractCost" placeholder="Cost" class="border rounded px-2 py-1.5 text-sm" />
            <div>
              <label class="block text-xs text-gray-600">Start date</label>
              <input type="date" [(ngModel)]="contractStartDate" name="contractStartDate" class="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-600">End date</label>
              <input type="date" [(ngModel)]="contractEndDate" name="contractEndDate" class="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" [(ngModel)]="contractAutoRenew" name="contractAutoRenew" />
            Auto-renews
          </label>
          <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add Contract</button>
        </form>
        @if (contractError()) {
          <p class="text-sm text-red-600">{{ contractError() }}</p>
        }

        <div class="bg-white rounded-lg shadow divide-y">
          @for (c of contracts(); track c.id) {
            <div class="p-4 flex justify-between items-center">
              <div>
                <div class="font-medium text-sm">{{ c.vendor?.name }} - {{ c.type }}</div>
                <div class="text-xs text-gray-500">
                  {{ c.asset?.name ? c.asset!.name + ' · ' : '' }}
                  @if (c.endDate) {
                    Expires {{ c.endDate | date: 'mediumDate' }}
                  } @else {
                    No expiry set
                  }
                  {{ c.autoRenew ? '· Auto-renews' : '' }}
                </div>
              </div>
              <button (click)="removeContract(c.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          } @empty {
            <p class="p-4 text-sm text-gray-400">No contracts yet.</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class VendorsComponent implements OnInit {
  readonly vendors = signal<Vendor[]>([]);
  readonly contracts = signal<Contract[]>([]);
  readonly assets = signal<Asset[]>([]);
  readonly vendorError = signal<string | null>(null);
  readonly contractError = signal<string | null>(null);

  vendorName = '';
  vendorContactName = '';
  vendorContactEmail = '';
  vendorContactPhone = '';

  contractVendorId = '';
  contractAssetId: string | null = null;
  contractType: ContractType = 'support';
  contractCost: number | null = null;
  contractStartDate = '';
  contractEndDate = '';
  contractAutoRenew = false;

  constructor(private readonly assetService: AssetService) {}

  async ngOnInit(): Promise<void> {
    await this.loadVendors();
    await this.loadContracts();
    this.assets.set(await this.assetService.list());
  }

  async loadVendors(): Promise<void> {
    this.vendors.set(await this.assetService.listVendors());
  }

  async loadContracts(): Promise<void> {
    this.contracts.set(await this.assetService.listContracts());
  }

  async createVendor(): Promise<void> {
    this.vendorError.set(null);
    try {
      await this.assetService.createVendor({
        name: this.vendorName,
        contactName: this.vendorContactName || null,
        contactEmail: this.vendorContactEmail || null,
        contactPhone: this.vendorContactPhone || null,
        notes: null,
      });
      this.vendorName = '';
      this.vendorContactName = '';
      this.vendorContactEmail = '';
      this.vendorContactPhone = '';
      await this.loadVendors();
    } catch (err) {
      this.vendorError.set(extractApiError(err, 'Could not create the vendor.'));
    }
  }

  async removeVendor(vendor: Vendor): Promise<void> {
    this.vendorError.set(null);
    if (!confirm(`Delete "${vendor.name}"?`)) return;
    try {
      await this.assetService.deleteVendor(vendor.id);
      await this.loadVendors();
    } catch (err) {
      this.vendorError.set(extractApiError(err, 'Could not delete the vendor.'));
    }
  }

  async createContract(): Promise<void> {
    this.contractError.set(null);
    if (!this.contractVendorId) return;
    try {
      await this.assetService.createContract({
        vendorId: this.contractVendorId,
        assetId: this.contractAssetId,
        type: this.contractType,
        startDate: this.contractStartDate || null,
        endDate: this.contractEndDate || null,
        cost: this.contractCost,
        autoRenew: this.contractAutoRenew,
      });
      this.contractVendorId = '';
      this.contractAssetId = null;
      this.contractCost = null;
      this.contractStartDate = '';
      this.contractEndDate = '';
      this.contractAutoRenew = false;
      await this.loadContracts();
    } catch (err) {
      this.contractError.set(extractApiError(err, 'Could not create the contract.'));
    }
  }

  async removeContract(id: string): Promise<void> {
    if (!confirm('Delete this contract?')) return;
    await this.assetService.deleteContract(id);
    await this.loadContracts();
  }
}
