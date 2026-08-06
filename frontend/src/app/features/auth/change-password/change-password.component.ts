import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { extractApiError } from '../../../core/utils/api-error';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-sm mx-auto bg-white p-6 rounded-lg shadow">
      <h1 class="text-xl font-semibold mb-4">Change Password</h1>
      <form (ngSubmit)="submit()" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Current Password</label>
          <input type="password" name="currentPassword" [(ngModel)]="currentPassword" required class="mt-1 w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">New Password</label>
          <input
            type="password"
            name="newPassword"
            [(ngModel)]="newPassword"
            required
            minlength="8"
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Confirm New Password</label>
          <input type="password" name="confirmPassword" [(ngModel)]="confirmPassword" required class="mt-1 w-full border rounded px-3 py-2" />
        </div>
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
        @if (message()) {
          <p class="text-sm text-green-700">{{ message() }}</p>
        }
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700">Update Password</button>
      </form>
    </div>
  `,
})
export class ChangePasswordComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  constructor(private readonly auth: AuthService) {}

  async submit(): Promise<void> {
    this.error.set(null);
    this.message.set(null);
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('New password and confirmation do not match.');
      return;
    }
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.message.set('Password updated.');
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not update your password.'));
    }
  }
}
