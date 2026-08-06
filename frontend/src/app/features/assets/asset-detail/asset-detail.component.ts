import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Asset, AssetAssignment, AssetCustomFieldDefinition, ASSET_STATUSES, AssetStatus } from '../../../core/models/asset.model';
import { Ticket } from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';
import { AssetService } from '../services/asset.service';
import { UserService } from '../../users/services/user.service';

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    @if (asset(); as a) {
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-xl font-semibold">{{ a.name }}</h1>
            <select
              [ngModel]="a.status"
              (ngModelChange)="changeStatus($event)"
              [disabled]="!auth.hasPermission('assets.edit')"
              class="border rounded px-2 py-1 text-sm"
            >
              @for (s of statuses; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div><span class="text-gray-500">Type:</span> {{ a.type }}</div>
            <div><span class="text-gray-500">Serial:</span> {{ a.serialNumber || '-' }}</div>
            <div><span class="text-gray-500">Vendor:</span> {{ a.vendor || '-' }}</div>
            <div><span class="text-gray-500">Purchased:</span> {{ a.purchaseDate || '-' }}</div>
            <div><span class="text-gray-500">Warranty Expiry:</span> {{ a.warrantyExpiry || '-' }}</div>
            @if (a.type === 'software_license') {
              <div><span class="text-gray-500">Seats Purchased:</span> {{ a.licenseSeatsPurchased ?? 0 }}</div>
            }
          </div>

          @if (customFieldDefs().length > 0) {
            <div class="mt-4 pt-4 border-t text-sm">
              @for (def of customFieldDefs(); track def.key) {
                <div><span class="text-gray-500">{{ def.label }}:</span> {{ a.customFields[def.key] ?? '-' }}</div>
              }
            </div>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Assignment</h2>
          @if (activeAssignment(); as active) {
            <div class="text-sm mb-3">
              <div>
                Currently assigned to:
                <strong>{{ active.assignedToUser?.displayName || active.assignedToLabel }}</strong>
                ({{ active.assignedToType }})
              </div>
              @if (active.dueBackAt) {
                <div class="text-gray-500">Due back {{ active.dueBackAt | date: 'medium' }}</div>
              }
            </div>
            @if (auth.hasPermission('assets.assign')) {
              <button (click)="checkin()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                Check In
              </button>
            }
          } @else if (auth.hasPermission('assets.assign')) {
            <div class="grid grid-cols-2 gap-6">
              <form (ngSubmit)="checkout()" class="space-y-2">
                <div class="text-sm font-medium">Check Out to a Person</div>
                <select [(ngModel)]="checkoutUserId" name="checkoutUserId" class="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">Select user...</option>
                  @for (u of users(); track u.id) {
                    <option [value]="u.id">{{ u.displayName }}</option>
                  }
                </select>
                <input type="date" [(ngModel)]="dueBackAt" name="dueBackAt" class="w-full border rounded px-2 py-1.5 text-sm" />
                <button type="submit" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                  Check Out
                </button>
              </form>
              <form (ngSubmit)="assignToLocation()" class="space-y-2">
                <div class="text-sm font-medium">Assign to Location/Department</div>
                <select [(ngModel)]="assignType" name="assignType" class="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="location">Location</option>
                  <option value="department">Department</option>
                </select>
                <input
                  type="text"
                  [(ngModel)]="assignLabel"
                  name="assignLabel"
                  placeholder="e.g. Building 3 / IT Dept"
                  class="w-full border rounded px-2 py-1.5 text-sm"
                />
                <button type="submit" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                  Assign
                </button>
              </form>
            </div>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Assignment History</h2>
          @for (h of history(); track h.id) {
            <div class="text-sm py-2 border-b last:border-b-0">
              {{ h.assignedToUser?.displayName || h.assignedToLabel }} ({{ h.assignedToType }}) -
              {{ h.assignedAt | date: 'short' }} to {{ h.unassignedAt ? (h.unassignedAt | date: 'short') : 'present' }}
            </div>
          } @empty {
            <p class="text-sm text-gray-400">No assignment history.</p>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Linked Tickets</h2>
          @for (t of linkedTickets(); track t.id) {
            <a [routerLink]="['/tickets', t.id]" class="block text-sm py-1 hover:text-blue-600">#{{ t.id }} - {{ t.subject }}</a>
          } @empty {
            <p class="text-sm text-gray-400">No linked tickets.</p>
          }
        </div>

        @if (auth.hasPermission('assets.delete')) {
          <div class="bg-white p-6 rounded-lg shadow border border-red-200">
            <button (click)="deleteAsset()" class="text-sm text-red-600 border border-red-300 rounded px-4 py-1.5 hover:bg-red-50">
              Delete Asset
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class AssetDetailComponent implements OnInit {
  readonly asset = signal<Asset | null>(null);
  readonly history = signal<AssetAssignment[]>([]);
  readonly linkedTickets = signal<Ticket[]>([]);
  readonly customFieldDefs = signal<AssetCustomFieldDefinition[]>([]);
  readonly users = signal<User[]>([]);
  readonly statuses = ASSET_STATUSES;

  checkoutUserId = '';
  dueBackAt = '';
  assignType: 'location' | 'department' = 'location';
  assignLabel = '';

  readonly activeAssignment = signal<AssetAssignment | null>(null);

  constructor(
    readonly auth: AuthService,
    private readonly assetService: AssetService,
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  private get assetId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.customFieldDefs.set(await this.assetService.listCustomFieldDefinitions());
    if (this.auth.hasPermission('assets.assign')) {
      this.users.set(await this.userService.list());
    }
  }

  async reload(): Promise<void> {
    const [asset, history, linkedTickets] = await Promise.all([
      this.assetService.get(this.assetId),
      this.assetService.history(this.assetId),
      this.assetService.linkedTickets(this.assetId),
    ]);
    this.asset.set(asset);
    this.history.set(history);
    this.linkedTickets.set(linkedTickets);
    this.activeAssignment.set(history.find((h) => !h.unassignedAt) ?? null);
  }

  async changeStatus(status: AssetStatus): Promise<void> {
    await this.assetService.update(this.assetId, { status });
    await this.reload();
  }

  async checkout(): Promise<void> {
    if (!this.checkoutUserId) return;
    await this.assetService.checkout(this.assetId, {
      assignedToUserId: this.checkoutUserId,
      dueBackAt: this.dueBackAt || undefined,
    });
    this.checkoutUserId = '';
    this.dueBackAt = '';
    await this.reload();
  }

  async assignToLocation(): Promise<void> {
    if (!this.assignLabel.trim()) return;
    await this.assetService.assign(this.assetId, { assignedToType: this.assignType, assignedToLabel: this.assignLabel });
    this.assignLabel = '';
    await this.reload();
  }

  async checkin(): Promise<void> {
    await this.assetService.checkin(this.assetId);
    await this.reload();
  }

  async deleteAsset(): Promise<void> {
    if (!confirm(`Delete ${this.asset()?.name}? This cannot be undone.`)) return;
    await this.assetService.delete(this.assetId);
    this.router.navigate(['/assets']);
  }
}
