import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserRole } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/utils/api-error';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h1 class="text-xl font-semibold mb-4">New User</h1>
      <form (ngSubmit)="submit()" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Name</label>
          <input type="text" name="displayName" [(ngModel)]="displayName" required class="mt-1 w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" name="email" [(ngModel)]="email" required class="mt-1 w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Temporary Password</label>
          <input
            type="password"
            name="password"
            [(ngModel)]="password"
            required
            minlength="8"
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Role</label>
          <select name="role" [(ngModel)]="role" class="mt-1 w-full border rounded px-3 py-2">
            <option value="customer">Customer</option>
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
          </select>
          <p class="text-xs text-gray-400 mt-1">
            New staff accounts start with no permissions granted - assign them on the next screen.
          </p>
        </div>
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700">Create User</button>
      </form>
    </div>
  `,
})
export class UserCreateComponent {
  displayName = '';
  email = '';
  password = '';
  role: UserRole = 'customer';
  readonly error = signal<string | null>(null);

  constructor(
    private readonly userService: UserService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    this.error.set(null);
    try {
      const user = await this.userService.create({
        displayName: this.displayName,
        email: this.email,
        password: this.password,
        role: this.role,
      });
      this.router.navigate(['/users', user.id]);
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the user.'));
    }
  }
}
