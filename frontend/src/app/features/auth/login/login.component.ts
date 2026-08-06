import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="max-w-sm mx-auto mt-16 bg-white p-8 rounded-lg shadow">
      <h1 class="text-xl font-semibold mb-6">Sign in</h1>
      <form (ngSubmit)="submit()" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="text"
            name="username"
            [(ngModel)]="username"
            required
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            name="password"
            [(ngModel)]="password"
            required
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
        <button type="submit" class="w-full bg-slate-800 text-white rounded py-2 hover:bg-slate-700">Sign in</button>
      </form>
      <p class="mt-4 text-sm text-gray-600">
        No account? <a routerLink="/register" class="text-blue-600 hover:underline">Register</a>
      </p>
    </div>
  `,
})
export class LoginComponent {
  username = '';
  password = '';
  readonly error = signal<string | null>(null);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.login(this.username, this.password);
      this.router.navigate(['/tickets']);
    } catch {
      this.error.set('Invalid email or password.');
    }
  }
}
