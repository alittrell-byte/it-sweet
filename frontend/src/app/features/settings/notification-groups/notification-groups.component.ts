import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { User } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/utils/api-error';
import { UserService } from '../../users/services/user.service';

interface NotificationGroup {
  id: string;
  name: string;
  notifyOnNewTicket: boolean;
  notifyOnLicenseOverage: boolean;
  notifyOnContractRenewal: boolean;
  members: Array<{ id: string; displayName: string; email: string }>;
}

@Component({
  selector: 'app-notification-groups',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Notification Groups</h1>
      <p class="text-sm text-gray-500">
        Members of an active group get emailed whenever a new ticket comes in. Toggle a group off to pause its
        alerts without deleting it.
      </p>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow flex gap-3">
        <input [(ngModel)]="name" name="name" placeholder="Group name" required class="flex-1 border rounded px-3 py-2 text-sm" />
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Create</button>
      </form>
      @if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (g of groups(); track g.id) {
          <div class="p-4">
            <div class="flex items-center justify-between">
              <button type="button" (click)="toggleExpanded(g.id)" class="text-left">
                <div class="font-medium text-sm">{{ g.name }}</div>
                <div class="text-xs text-gray-500">{{ g.members.length }} member(s) - click to manage</div>
              </button>
            </div>
            <div class="flex flex-wrap gap-4 mt-2">
              <label class="text-sm flex items-center gap-2">
                <input type="checkbox" [ngModel]="g.notifyOnNewTicket" (ngModelChange)="toggle(g, { notifyOnNewTicket: $event })" />
                New ticket
              </label>
              <label class="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  [ngModel]="g.notifyOnLicenseOverage"
                  (ngModelChange)="toggle(g, { notifyOnLicenseOverage: $event })"
                />
                License over-allocated
              </label>
              <label class="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  [ngModel]="g.notifyOnContractRenewal"
                  (ngModelChange)="toggle(g, { notifyOnContractRenewal: $event })"
                />
                Contract renewal due
              </label>
            </div>

            @if (expandedGroupId() === g.id) {
              <div class="mt-3 pt-3 border-t">
                @for (m of g.members; track m.id) {
                  <div class="flex items-center justify-between text-sm py-1">
                    <span>{{ m.displayName }} ({{ m.email }})</span>
                    <button (click)="removeMember(g, m.id)" class="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                } @empty {
                  <p class="text-sm text-gray-400 mb-2">No members yet.</p>
                }
                <div class="flex gap-2 mt-2">
                  <select [(ngModel)]="userToAdd" name="userToAdd" class="flex-1 border rounded px-2 py-1.5 text-sm">
                    <option value="">Select a user to add...</option>
                    @for (u of addableUsers(g); track u.id) {
                      <option [value]="u.id">{{ u.displayName }} ({{ u.role }})</option>
                    }
                  </select>
                  <button (click)="addMember(g)" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                    Add
                  </button>
                </div>
              </div>
            }
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No notification groups yet.</p>
        }
      </div>
    </div>
  `,
})
export class NotificationGroupsComponent implements OnInit {
  readonly groups = signal<NotificationGroup[]>([]);
  readonly allUsers = signal<User[]>([]);
  readonly expandedGroupId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  name = '';
  userToAdd = '';

  constructor(
    private readonly http: HttpClient,
    private readonly userService: UserService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadUsers()]);
  }

  async load(): Promise<void> {
    this.groups.set(await firstValueFrom(this.http.get<NotificationGroup[]>('/api/notification-groups')));
  }

  async loadUsers(): Promise<void> {
    this.allUsers.set(await this.userService.list());
  }

  addableUsers(group: NotificationGroup): User[] {
    const memberIds = new Set(group.members.map((m) => m.id));
    return this.allUsers().filter((u) => !memberIds.has(u.id));
  }

  toggleExpanded(groupId: string): void {
    this.expandedGroupId.set(this.expandedGroupId() === groupId ? null : groupId);
    this.userToAdd = '';
  }

  async create(): Promise<void> {
    this.error.set(null);
    if (!this.name.trim()) return;
    try {
      await firstValueFrom(this.http.post('/api/notification-groups', { name: this.name }));
      this.name = '';
      await this.load();
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the group.'));
    }
  }

  async toggle(group: NotificationGroup, changes: Partial<NotificationGroup>): Promise<void> {
    await firstValueFrom(this.http.patch(`/api/notification-groups/${group.id}/toggle`, changes));
    await this.load();
  }

  async addMember(group: NotificationGroup): Promise<void> {
    if (!this.userToAdd) return;
    this.error.set(null);
    try {
      await firstValueFrom(this.http.post(`/api/notification-groups/${group.id}/members`, { userId: this.userToAdd }));
      this.userToAdd = '';
      await this.load();
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not add that member.'));
    }
  }

  async removeMember(group: NotificationGroup, userId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/notification-groups/${group.id}/members/${userId}`));
    await this.load();
  }
}
