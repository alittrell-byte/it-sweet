import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user.model';

interface LoginResponse {
  accessToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly currentUserSignal = signal<User | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly isStaff = computed(() => {
    const role = this.currentUserSignal()?.role;
    return role === 'admin' || role === 'technician';
  });
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');
  readonly isSuperAdmin = computed(() => this.currentUserSignal()?.isSuperAdmin === true);

  hasPermission(key: string): boolean {
    const user = this.currentUserSignal();
    if (!user) return false;
    return user.isSuperAdmin || (user.permissions ?? []).includes(key);
  }

  constructor(private readonly http: HttpClient) {}

  getAccessToken(): string | null {
    return this.accessTokenSignal();
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>('/api/auth/login', { username, password }, { withCredentials: true })
    );
    this.accessTokenSignal.set(res.accessToken);
    this.currentUserSignal.set(res.user);
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/register', { email, password, displayName }));
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}, { withCredentials: true }));
    this.accessTokenSignal.set(null);
    this.currentUserSignal.set(null);
  }

  /** Attempts to restore a session from the httpOnly refresh cookie on app start / page reload. */
  async tryRestoreSession(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
      );
      this.accessTokenSignal.set(res.accessToken);
      const me = await firstValueFrom(this.http.get<{ user: User }>('/api/auth/me'));
      this.currentUserSignal.set(me.user);
    } catch {
      this.accessTokenSignal.set(null);
      this.currentUserSignal.set(null);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.patch('/api/auth/change-password', { currentPassword, newPassword }));
  }

  async refreshAccessToken(): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
    );
    this.accessTokenSignal.set(res.accessToken);
    return res.accessToken;
  }
}
