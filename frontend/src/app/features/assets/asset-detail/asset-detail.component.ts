import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  Asset,
  AssetAssignment,
  AssetCustomFieldDefinition,
  AssetHistoryEntry,
  ASSET_STATUSES,
  AssetStatus,
  Vendor,
} from '../../../core/models/asset.model';
import { Ticket } from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';
import { AssetService, UpdateAssetInput } from '../services/asset.service';
import { UserService } from '../../users/services/user.service';
import { extractApiError } from '../../../core/utils/api-error';
import { AssetPatchStatus, IssuedPatchAgentKey, PatchAgentKey } from '../../../core/models/patch.model';
import { PatchService } from '../../patches/services/patch.service';

const PATCH_STATUS_BADGE: Record<string, string> = {
  installed: 'bg-green-100 text-green-800',
  missing: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  pending_reboot: 'bg-amber-100 text-amber-800',
};

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    @if (asset(); as a) {
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between mb-4">
            @if (editable) {
              <input [(ngModel)]="form.name" class="text-xl font-semibold border-b border-gray-300 focus:outline-none" />
            } @else {
              <h1 class="text-xl font-semibold">{{ a.name }}</h1>
            }
            <div class="flex gap-2 items-center">
              @if (a.status === 'ordered' && editable) {
                <button (click)="receive()" class="text-sm bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-700">
                  Mark Received
                </button>
              }
              <select
                [ngModel]="a.status"
                (ngModelChange)="changeStatus($event)"
                [disabled]="!editable"
                class="border rounded px-2 py-1 text-sm"
              >
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div><span class="text-gray-500">Type:</span> {{ a.type }}</div>
            <div>
              <span class="text-gray-500">Serial:</span>
              @if (editable) {
                <input [(ngModel)]="form.serialNumber" class="border rounded px-2 py-0.5 text-sm w-40" />
              } @else {
                {{ a.serialNumber || '-' }}
              }
            </div>
            <div>
              <span class="text-gray-500">Vendor:</span>
              @if (editable) {
                <select [(ngModel)]="form.vendorId" class="border rounded px-2 py-0.5 text-sm">
                  <option [ngValue]="null">None</option>
                  @for (v of vendors(); track v.id) {
                    <option [ngValue]="v.id">{{ v.name }}</option>
                  }
                </select>
              } @else {
                {{ a.vendor?.name || '-' }}
              }
            </div>
            <div>
              <span class="text-gray-500">Purchased:</span>
              @if (editable) {
                <input type="date" [(ngModel)]="form.purchaseDate" class="border rounded px-2 py-0.5 text-sm" />
              } @else {
                {{ a.purchaseDate || '-' }}
              }
            </div>
            <div>
              <span class="text-gray-500">Warranty Expiry:</span>
              @if (editable) {
                <input type="date" [(ngModel)]="form.warrantyExpiry" class="border rounded px-2 py-0.5 text-sm" />
              } @else {
                {{ a.warrantyExpiry || '-' }}
              }
            </div>
            @if (a.type === 'software_license') {
              <div>
                <span class="text-gray-500">Seats Purchased:</span>
                @if (editable) {
                  <input type="number" min="0" [(ngModel)]="form.licenseSeatsPurchased" class="border rounded px-2 py-0.5 text-sm w-20" />
                } @else {
                  {{ a.licenseSeatsPurchased ?? 0 }}
                }
              </div>
            }
          </div>

          <div class="mt-4 pt-4 border-t text-sm grid grid-cols-2 gap-4">
            <div>
              <span class="text-gray-500">Purchase Cost:</span>
              @if (editable) {
                <input type="number" min="0" step="0.01" [(ngModel)]="form.purchaseCost" class="border rounded px-2 py-0.5 text-sm w-28" />
              } @else {
                {{ a.purchaseCost != null ? '$' + a.purchaseCost : '-' }}
              }
            </div>
            <div>
              <span class="text-gray-500">Depreciation:</span>
              @if (editable) {
                <select [(ngModel)]="form.depreciationMethod" class="border rounded px-2 py-0.5 text-sm">
                  <option value="none">None</option>
                  <option value="straight_line">Straight-line</option>
                </select>
              } @else {
                {{ a.depreciationMethod === 'straight_line' ? 'Straight-line' : 'None' }}
              }
            </div>
            @if ((editable && form.depreciationMethod === 'straight_line') || a.depreciationMethod === 'straight_line') {
              <div>
                <span class="text-gray-500">Useful Life (months):</span>
                @if (editable) {
                  <input type="number" min="1" [(ngModel)]="form.usefulLifeMonths" class="border rounded px-2 py-0.5 text-sm w-20" />
                } @else {
                  {{ a.usefulLifeMonths ?? '-' }}
                }
              </div>
            }
          </div>

          <div class="mt-4 pt-4 border-t">
            <label class="block text-sm text-gray-500 mb-1">Notes</label>
            @if (editable) {
              <textarea [(ngModel)]="form.notes" rows="2" class="w-full border rounded px-2 py-1.5 text-sm"></textarea>
            } @else {
              <p class="text-sm whitespace-pre-wrap">{{ a.notes || '-' }}</p>
            }
          </div>

          @if (customFieldDefs().length > 0) {
            <div class="mt-4 pt-4 border-t text-sm space-y-2">
              @for (def of customFieldDefs(); track def.key) {
                <div>
                  <label class="text-gray-500">{{ def.label }}:</label>
                  @if (editable) {
                    <input
                      [type]="def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : 'text'"
                      [ngModel]="form.customFields![def.key]"
                      (ngModelChange)="setCustomField(def.key, $event)"
                      class="border rounded px-2 py-0.5 text-sm"
                    />
                  } @else {
                    {{ a.customFields[def.key] ?? '-' }}
                  }
                </div>
              }
            </div>
          }

          @if (editable) {
            <div class="mt-4 pt-4 border-t flex items-center gap-3">
              <button (click)="save()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                Save Changes
              </button>
              @if (saveError()) {
                <span class="text-sm text-red-600">{{ saveError() }}</span>
              }
              @if (saveMessage()) {
                <span class="text-sm text-green-700">{{ saveMessage() }}</span>
              }
            </div>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Assignment</h2>
          @if (a.type === 'software_license') {
            @for (act of activeAssignments(); track act.id) {
              <div class="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0">
                <span>{{ act.assignedToUser?.displayName || act.assignedToLabel }}</span>
                @if (auth.hasPermission('assets.assign')) {
                  <button (click)="checkin(act.id)" class="text-xs text-red-600 hover:underline">Check In</button>
                }
              </div>
            } @empty {
              <p class="text-sm text-gray-400 mb-2">No active assignments.</p>
            }
            @if (auth.hasPermission('assets.assign')) {
              <form (ngSubmit)="checkout()" class="mt-3 flex gap-2">
                <select [(ngModel)]="checkoutUserId" name="checkoutUserId" class="flex-1 border rounded px-2 py-1.5 text-sm">
                  <option value="">Select user...</option>
                  @for (u of users(); track u.id) {
                    <option [value]="u.id">{{ u.displayName }}</option>
                  }
                </select>
                <button type="submit" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                  Assign Seat
                </button>
              </form>
            }
          } @else {
            @if (activeAssignments()[0]; as active) {
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
          <h2 class="font-medium mb-3">Change History</h2>
          @for (h of auditLog(); track h.id) {
            <div class="text-sm py-2 border-b last:border-b-0">
              <div>
                <span class="font-medium">{{ h.changedBy?.displayName || 'System' }}</span>
                {{ actionLabel(h) }} - {{ h.createdAt | date: 'short' }}
              </div>
              @if (h.changes) {
                <ul class="text-xs text-gray-500 ml-4 list-disc mt-1">
                  @for (entry of changeEntries(h.changes); track entry.field) {
                    <li>{{ entry.field }}: {{ entry.from ?? '(empty)' }} &rarr; {{ entry.to ?? '(empty)' }}</li>
                  }
                </ul>
              }
            </div>
          } @empty {
            <p class="text-sm text-gray-400">No change history yet.</p>
          }
        </div>

        @if (auth.hasPermission('patches.view')) {
          <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex items-center justify-between mb-3">
              <h2 class="font-medium">Patch Status</h2>
              @if (auth.hasPermission('patches.manage_agents')) {
                <button (click)="generateAgentKey()" class="text-xs text-blue-600 hover:underline">
                  {{ agentKey() ? 'Rotate' : 'Generate' }} Agent Key
                </button>
              }
            </div>
            @if (revealedAgentKey()) {
              <div class="mb-3 p-2 rounded bg-amber-50 border border-amber-200 text-xs">
                <div class="font-medium text-amber-800">New agent key - copy it now. It will not be shown again.</div>
                <div class="mt-1 flex items-center gap-2">
                  <code class="bg-white px-2 py-1 rounded border select-all">{{ revealedAgentKey() }}</code>
                  <button (click)="revealedAgentKey.set(null)" class="text-gray-600 hover:underline">Dismiss</button>
                </div>
              </div>
            } @else if (agentKey()) {
              <div class="text-xs text-gray-500 mb-3">Agent key issued {{ agentKey()!.createdAt | date: 'medium' }} (stored hashed, not viewable).</div>
            }
            @for (s of patchStatuses(); track s.id) {
              <div class="text-sm py-2 border-b last:border-b-0 flex justify-between items-center">
                <span>{{ s.patch?.title }}</span>
                <span class="text-xs px-2 py-1 rounded" [class]="PATCH_STATUS_BADGE[s.status]">{{ s.status }}</span>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">No patch scans reported for this asset yet.</p>
            }
          </div>
        }

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
  readonly activeAssignments = signal<AssetAssignment[]>([]);
  readonly auditLog = signal<AssetHistoryEntry[]>([]);
  readonly linkedTickets = signal<Ticket[]>([]);
  readonly customFieldDefs = signal<AssetCustomFieldDefinition[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly users = signal<User[]>([]);
  readonly patchStatuses = signal<AssetPatchStatus[]>([]);
  readonly agentKey = signal<PatchAgentKey | null>(null);
  /** Plaintext from the generate/rotate call just made; the server never returns it again. */
  readonly revealedAgentKey = signal<string | null>(null);
  readonly statuses = ASSET_STATUSES;
  readonly saveError = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly PATCH_STATUS_BADGE = PATCH_STATUS_BADGE;

  form: UpdateAssetInput = {};
  editable = false;

  checkoutUserId = '';
  dueBackAt = '';
  assignType: 'location' | 'department' = 'location';
  assignLabel = '';

  constructor(
    readonly auth: AuthService,
    private readonly assetService: AssetService,
    private readonly userService: UserService,
    private readonly patchService: PatchService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  private get assetId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  async ngOnInit(): Promise<void> {
    this.editable = this.auth.hasPermission('assets.edit');
    await this.reload();
    this.customFieldDefs.set(await this.assetService.listCustomFieldDefinitions());
    this.vendors.set(await this.assetService.listVendors());
    if (this.auth.hasPermission('assets.assign')) {
      this.users.set(await this.userService.list());
    }
    if (this.auth.hasPermission('patches.view')) {
      this.patchStatuses.set(await this.patchService.assetPatchStatuses(this.assetId));
    }
    if (this.auth.hasPermission('patches.manage_agents')) {
      this.agentKey.set(await this.patchService.getAgentKey(this.assetId));
    }
  }

  async generateAgentKey(): Promise<void> {
    let issued: IssuedPatchAgentKey;
    if (this.agentKey()) {
      if (!confirm('Rotating issues a new key and immediately invalidates the current one. Continue?')) return;
      issued = await this.patchService.rotateAgentKey(this.assetId);
    } else {
      issued = await this.patchService.generateAgentKey(this.assetId);
    }
    const { apiKey, ...metadata } = issued;
    this.agentKey.set(metadata);
    this.revealedAgentKey.set(apiKey);
  }

  async reload(): Promise<void> {
    const [asset, history, linkedTickets, auditLog] = await Promise.all([
      this.assetService.get(this.assetId),
      this.assetService.history(this.assetId),
      this.assetService.linkedTickets(this.assetId),
      this.assetService.auditLog(this.assetId),
    ]);
    this.asset.set(asset);
    this.history.set(history);
    this.activeAssignments.set(history.filter((h) => !h.unassignedAt));
    this.linkedTickets.set(linkedTickets);
    this.auditLog.set(auditLog);
    this.form = {
      name: asset.name,
      serialNumber: asset.serialNumber,
      vendorId: asset.vendorId,
      purchaseDate: asset.purchaseDate,
      warrantyExpiry: asset.warrantyExpiry,
      licenseSeatsPurchased: asset.licenseSeatsPurchased,
      // Sequelize DECIMAL columns come back from the API as strings (both pg and mysql2 do this
      // to avoid float precision loss) - coerced here so an unedited round-trip save still sends
      // a real number, not the raw string, back to the update endpoint.
      purchaseCost: asset.purchaseCost != null ? Number(asset.purchaseCost) : null,
      depreciationMethod: asset.depreciationMethod,
      usefulLifeMonths: asset.usefulLifeMonths,
      notes: asset.notes,
      customFields: { ...asset.customFields },
    };
  }

  setCustomField(key: string, value: string | number | boolean | null): void {
    this.form.customFields = { ...(this.form.customFields ?? {}), [key]: value };
  }

  changeEntries(changes: Record<string, { from: unknown; to: unknown }>): Array<{ field: string; from: unknown; to: unknown }> {
    return Object.entries(changes).map(([field, v]) => ({ field, from: v.from, to: v.to }));
  }

  actionLabel(h: AssetHistoryEntry): string {
    switch (h.action) {
      case 'created':
        return 'created this asset';
      case 'deleted':
        return 'deleted this asset';
      case 'received':
        return 'marked this asset received';
      default:
        return 'updated this asset';
    }
  }

  async save(): Promise<void> {
    this.saveError.set(null);
    this.saveMessage.set(null);
    try {
      await this.assetService.update(this.assetId, this.form);
      this.saveMessage.set('Saved.');
      await this.reload();
    } catch (err) {
      this.saveError.set(extractApiError(err, 'Could not save changes.'));
    }
  }

  async changeStatus(status: AssetStatus): Promise<void> {
    await this.assetService.update(this.assetId, { status });
    await this.reload();
  }

  async receive(): Promise<void> {
    await this.assetService.receive(this.assetId);
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

  async checkin(assignmentId?: string): Promise<void> {
    await this.assetService.checkin(this.assetId, assignmentId);
    await this.reload();
  }

  async deleteAsset(): Promise<void> {
    if (!confirm(`Delete ${this.asset()?.name}? This cannot be undone.`)) return;
    await this.assetService.delete(this.assetId);
    this.router.navigate(['/assets']);
  }
}
