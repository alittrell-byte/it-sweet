import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PermissionModule, User, UserRole } from '../../../core/models/user.model';

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserDetail extends User {
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private readonly http: HttpClient) {}

  getPermissionCatalog(): Promise<PermissionModule[]> {
    return firstValueFrom(this.http.get<PermissionModule[]>('/api/users/permission-catalog'));
  }

  list(): Promise<User[]> {
    return firstValueFrom(this.http.get<User[]>('/api/users'));
  }

  get(id: string): Promise<UserDetail> {
    return firstValueFrom(this.http.get<UserDetail>(`/api/users/${id}`));
  }

  create(input: CreateUserInput): Promise<User> {
    return firstValueFrom(this.http.post<User>('/api/users', input));
  }

  update(id: string, input: UpdateUserInput): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`/api/users/${id}`, input));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/users/${id}`));
  }

  setPermissions(id: string, permissionKeys: string[]): Promise<void> {
    return firstValueFrom(this.http.put<void>(`/api/users/${id}/permissions`, { permissionKeys }));
  }

  setRank(id: string, input: { rank?: number; isSuperAdmin?: boolean }): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`/api/users/${id}/rank`, input));
  }

  resetPassword(id: string, newPassword: string): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`/api/users/${id}/password`, { newPassword }));
  }
}
