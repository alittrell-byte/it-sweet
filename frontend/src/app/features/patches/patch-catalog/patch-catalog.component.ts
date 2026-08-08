import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Patch,
  PatchApprovalStatus,
  PatchClassification,
  PatchPlatform,
  PATCH_CLASSIFICATIONS,
  PATCH_PLATFORMS,
} from '../../../core/models/patch.model';
import { AuthService } from '../../../core/services/auth.service';
import { PatchService } from '../services/patch.service';

const APPROVAL_BADGE: Record<PatchApprovalStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-gray-100 text-gray-600',
};

@Component({
  selector: 'app-patch-catalog',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-5xl mx-auto space-y-4">
      <h1 class="text-xl font-semibold">Patch Catalog</h1>
      <p class="text-sm text-gray-500">
        Patches are discovered automatically as devices report scans - review and approve/decline
        them here. Only approved patches count toward compliance reporting and overdue alerting.
      </p>

      <div class="bg-white p-4 rounded-lg shadow flex flex-wrap gap-2 items-end">
        <div>
          <label class="block text-xs text-gray-600">Platform</label>
          <select [(ngModel)]="platform" (ngModelChange)="load()" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All</option>
            @for (p of platforms; track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600">Classification</label>
          <select [(ngModel)]="classification" (ngModelChange)="load()" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All</option>
            @for (c of classifications; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600">Approval</label>
          <select [(ngModel)]="approvalStatus" (ngModelChange)="load()" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (patch of patches(); track patch.id) {
          <div class="p-4 flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="font-medium text-sm truncate">{{ patch.title }}</div>
              <div class="text-xs text-gray-500">
                {{ patch.platform }} &middot; {{ patch.externalId }} &middot; {{ patch.classification }} &middot;
                {{ patch.severity }}
                @if (patch.releaseDate) {
                  &middot; released {{ patch.releaseDate | date: 'mediumDate' }}
                }
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs px-2 py-1 rounded" [class]="APPROVAL_BADGE[patch.approvalStatus]">
                {{ patch.approvalStatus }}
              </span>
              @if (auth.hasPermission('patches.manage_catalog') && patch.approvalStatus !== 'approved') {
                <button (click)="approve(patch)" class="text-xs text-green-700 hover:underline">Approve</button>
              }
              @if (auth.hasPermission('patches.manage_catalog') && patch.approvalStatus !== 'declined') {
                <button (click)="decline(patch)" class="text-xs text-red-600 hover:underline">Decline</button>
              }
            </div>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No patches discovered yet.</p>
        }
      </div>
    </div>
  `,
})
export class PatchCatalogComponent implements OnInit {
  readonly patches = signal<Patch[]>([]);
  readonly platforms = PATCH_PLATFORMS;
  readonly classifications = PATCH_CLASSIFICATIONS;
  readonly APPROVAL_BADGE = APPROVAL_BADGE;

  platform: PatchPlatform | '' = '';
  classification: PatchClassification | '' = '';
  approvalStatus: PatchApprovalStatus | '' = '';

  constructor(
    readonly auth: AuthService,
    private readonly patchService: PatchService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.patches.set(
      await this.patchService.listPatches({
        platform: this.platform || undefined,
        classification: this.classification || undefined,
        approvalStatus: this.approvalStatus || undefined,
      })
    );
  }

  async approve(patch: Patch): Promise<void> {
    await this.patchService.approvePatch(patch.id);
    await this.load();
  }

  async decline(patch: Patch): Promise<void> {
    await this.patchService.declinePatch(patch.id);
    await this.load();
  }
}
