export type UserRole = 'admin' | 'technician' | 'customer';
export type AuthSource = 'local' | 'ldap';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive?: boolean;
  rank: number;
  isSuperAdmin: boolean;
  authSource?: AuthSource;
  /** Only present on the current session's own user (login/me responses), not on other users in lists. */
  permissions?: string[];
}

export interface PermissionDefinition {
  key: string;
  label: string;
}

export interface PermissionModule {
  module: string;
  label: string;
  permissions: PermissionDefinition[];
}
