import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionModule, UserRole } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/utils/api-error';
import { UserDetail, UserService } from '../services/user.service';

@Component({
  selector: 'app-user-edit',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (user(); as u) {
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-xl font-semibold">{{ u.displayName }}</h1>
            <div class="flex gap-2 text-xs">
              @if (u.isSuperAdmin) {
                <span class="px-2 py-1 rounded bg-purple-100 text-purple-800">super admin</span>
              }
              <span class="px-2 py-1 rounded bg-gray-100 text-gray-700">rank {{ u.rank }}</span>
            </div>
          </div>

          @if (!canManage()) {
            <p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
              You cannot edit this user - they outrank you or are a super admin.
            </p>
          }

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                [(ngModel)]="displayName"
                [disabled]="!canEditProfile()"
                class="mt-1 w-full border rounded px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Role</label>
              <select [(ngModel)]="role" [disabled]="!canEditProfile()" class="mt-1 w-full border rounded px-3 py-2 disabled:bg-gray-100">
                <option value="customer">Customer</option>
                <option value="technician">Technician</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <label class="flex items-center gap-2 mt-4 text-sm">
            <input type="checkbox" [(ngModel)]="isActive" [disabled]="!canEditProfile()" />
            Active
          </label>

          @if (canEditProfile()) {
            <button (click)="saveProfile()" class="mt-4 bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
              Save Profile
            </button>
          }
        </div>

        @if (auth.isSuperAdmin() && u.id !== auth.currentUser()?.id) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">Rank &amp; Super Admin (super admin only)</h2>
            <div class="flex items-end gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Rank</label>
                <input type="number" min="0" [(ngModel)]="rank" class="mt-1 w-32 border rounded px-3 py-2" />
              </div>
              <label class="flex items-center gap-2 text-sm mb-2">
                <input type="checkbox" [(ngModel)]="isSuperAdminFlag" />
                Super admin
              </label>
              <button (click)="saveRank()" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700 mb-0.5">
                Save Rank
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-2">
              Higher rank can manage lower rank. Nobody but a super admin can manage a super admin.
            </p>
          </div>
        }

        @if (canEditProfile() && u.authSource === 'local') {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">Reset Password</h2>
            <p class="text-sm text-gray-500 mb-3">
              Sets this local account's password directly - useful when a user is locked out and there's no
              AD/LDAP self-service reset.
            </p>
            <div class="flex items-end gap-3">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  [(ngModel)]="newPassword"
                  minlength="8"
                  placeholder="At least 8 characters"
                  class="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <button (click)="resetPassword()" class="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700">
                Reset Password
              </button>
            </div>
          </div>
        } @else if (canEditProfile() && u.authSource === 'ldap') {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-1">Reset Password</h2>
            <p class="text-sm text-gray-500">This account signs in via LDAP/AD - its password is managed there, not here.</p>
          </div>
        }

        @if (canManagePermissions()) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-4">Permissions</h2>
            @for (mod of catalog(); track mod.module) {
              <div class="mb-4 pb-4 border-b last:border-b-0">
                <label class="flex items-center gap-2 font-medium text-sm mb-2">
                  <input type="checkbox" [checked]="isModuleFullySelected(mod)" (change)="toggleModuleAll(mod)" />
                  {{ mod.label }}
                  <span class="text-xs font-normal text-gray-400">(select all)</span>
                </label>
                <div class="grid grid-cols-2 gap-2 pl-6">
                  @for (perm of mod.permissions; track perm.key) {
                    <label class="flex items-center gap-2 text-sm">
                      <input type="checkbox" [checked]="selected().has(perm.key)" (change)="togglePermission(perm.key)" />
                      {{ perm.label }}
                    </label>
                  }
                </div>
              </div>
            }
            <button (click)="savePermissions()" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
              Save Permissions
            </button>
          </div>
        }

        @if (canManage() && auth.hasPermission('users.delete')) {
          <div class="bg-white p-6 rounded-lg shadow border border-red-200">
            <h2 class="font-medium mb-2 text-red-700">Danger Zone</h2>
            <button (click)="deleteUser()" class="text-sm text-red-600 border border-red-300 rounded px-4 py-1.5 hover:bg-red-50">
              Delete User
            </button>
          </div>
        }

        @if (message()) {
          <p class="text-sm text-green-700">{{ message() }}</p>
        }
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
      </div>
    }
  `,
})
export class UserEditComponent implements OnInit {
  readonly user = signal<UserDetail | null>(null);
  readonly catalog = signal<PermissionModule[]>([]);
  readonly selected = signal<Set<string>>(new Set());
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  displayName = '';
  role: UserRole = 'customer';
  isActive = true;
  rank = 0;
  isSuperAdminFlag = false;
  newPassword = '';

  readonly canManage = computed(() => {
    const me = this.auth.currentUser();
    const target = this.user();
    if (!me || !target) return false;
    if (me.id === target.id) return false;
    if (me.isSuperAdmin) return true;
    if (target.isSuperAdmin) return false;
    return me.rank > target.rank;
  });

  readonly canEditProfile = computed(() => this.canManage() && this.auth.hasPermission('users.edit'));
  readonly canManagePermissions = computed(
    () => this.canManage() && this.auth.hasPermission('users.manage_permissions') && this.user()?.role !== 'customer'
  );

  constructor(
    readonly auth: AuthService,
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    const [user, catalog] = await Promise.all([this.userService.get(id), this.userService.getPermissionCatalog()]);
    this.applyUser(user);
    this.catalog.set(catalog);
  }

  private applyUser(user: UserDetail): void {
    this.user.set(user);
    this.displayName = user.displayName;
    this.role = user.role;
    this.isActive = user.isActive ?? true;
    this.rank = user.rank;
    this.isSuperAdminFlag = user.isSuperAdmin;
    this.selected.set(new Set(user.permissions));
  }

  isModuleFullySelected(mod: PermissionModule): boolean {
    return mod.permissions.every((p) => this.selected().has(p.key));
  }

  toggleModuleAll(mod: PermissionModule): void {
    const next = new Set(this.selected());
    const shouldSelectAll = !this.isModuleFullySelected(mod);
    for (const perm of mod.permissions) {
      if (shouldSelectAll) next.add(perm.key);
      else next.delete(perm.key);
    }
    this.selected.set(next);
  }

  togglePermission(key: string): void {
    const next = new Set(this.selected());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.selected.set(next);
  }

  async saveProfile(): Promise<void> {
    this.clearNotices();
    try {
      const updated = await this.userService.update(this.user()!.id, {
        displayName: this.displayName,
        role: this.role,
        isActive: this.isActive,
      });
      this.user.update((u) => (u ? { ...u, ...updated } : u));
      this.message.set('Profile saved.');
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not save profile.'));
    }
  }

  async savePermissions(): Promise<void> {
    this.clearNotices();
    try {
      await this.userService.setPermissions(this.user()!.id, [...this.selected()]);
      this.message.set('Permissions saved.');
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not save permissions.'));
    }
  }

  async saveRank(): Promise<void> {
    this.clearNotices();
    try {
      const updated = await this.userService.setRank(this.user()!.id, { rank: this.rank, isSuperAdmin: this.isSuperAdminFlag });
      this.user.update((u) => (u ? { ...u, ...updated } : u));
      this.message.set('Rank saved.');
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not save rank.'));
    }
  }

  async resetPassword(): Promise<void> {
    this.clearNotices();
    if (this.newPassword.length < 8) {
      this.error.set('New password must be at least 8 characters.');
      return;
    }
    try {
      await this.userService.resetPassword(this.user()!.id, this.newPassword);
      this.newPassword = '';
      this.message.set('Password reset.');
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not reset the password.'));
    }
  }

  async deleteUser(): Promise<void> {
    if (!confirm(`Delete ${this.user()?.displayName}? This cannot be undone.`)) return;
    this.clearNotices();
    try {
      await this.userService.delete(this.user()!.id);
      this.router.navigate(['/users']);
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not delete user.'));
    }
  }

  private clearNotices(): void {
    this.message.set(null);
    this.error.set(null);
  }
}
