import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { extractApiError } from '../../../core/utils/api-error';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="max-w-sm mx-auto mt-16 bg-white p-8 rounded-lg shadow">
      <h1 class="text-xl font-semibold mb-6">Create an account</h1>
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
          <label class="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            name="password"
            [(ngModel)]="password"
            required
            minlength="8"
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
        <button type="submit" class="w-full bg-slate-800 text-white rounded py-2 hover:bg-slate-700">Register</button>
      </form>
      <p class="mt-4 text-sm text-gray-600">
        Already have an account? <a routerLink="/login" class="text-blue-600 hover:underline">Sign in</a>
      </p>
    </div>
  `,
})
export class RegisterComponent {
  displayName = '';
  email = '';
  password = '';
  readonly error = signal<string | null>(null);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.register(this.email, this.password, this.displayName);
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/tickets']);
    } catch (err) {
      this.error.set(extractApiError(err, 'Registration failed.'));
    }
  }
}
