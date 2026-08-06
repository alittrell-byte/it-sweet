import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Users</h1>
        @if (auth.hasPermission('users.create')) {
          <a routerLink="/users/new" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
            + New User
          </a>
        }
      </div>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (u of users(); track u.id) {
          <a [routerLink]="['/users', u.id]" class="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div>
              <div class="font-medium text-sm">{{ u.displayName }}</div>
              <div class="text-xs text-gray-500">{{ u.email }}</div>
            </div>
            <div class="flex items-center gap-2 text-xs">
              @if (u.isSuperAdmin) {
                <span class="px-2 py-1 rounded bg-purple-100 text-purple-800">super admin</span>
              }
              <span class="px-2 py-1 rounded bg-gray-100 text-gray-700">{{ u.role }}</span>
              <span class="px-2 py-1 rounded bg-gray-100 text-gray-700">rank {{ u.rank }}</span>
              @if (!u.isActive) {
                <span class="px-2 py-1 rounded bg-red-100 text-red-700">inactive</span>
              }
            </div>
          </a>
        } @empty {
          <div class="px-4 py-8 text-center text-gray-500">No users yet.</div>
        }
      </div>
    </div>
  `,
})
export class UserListComponent implements OnInit {
  readonly users = signal<User[]>([]);

  constructor(
    readonly auth: AuthService,
    private readonly userService: UserService
  ) {}

  async ngOnInit(): Promise<void> {
    this.users.set(await this.userService.list());
  }
}
