import bcrypt from 'bcrypt';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { AccessTokenPayload } from './authService';
import { isValidPermissionKey } from './permissionCatalog';
import { User, UserRole } from './user.model';
import { UserPermission } from './userPermission.model';

// Nobody can manage (edit / delete / change permissions of) a user who outranks them.
// A super admin bypasses this entirely; nobody but another super admin can touch a
// super admin; otherwise strictly-higher rank is required, and nobody can act on themself
// through these management endpoints.
export function canManageUser(actor: AccessTokenPayload, target: User): boolean {
  if (actor.sub === target.id) return false;
  if (actor.isSuperAdmin) return true;
  if (target.isSuperAdmin) return false;
  return actor.rank > target.rank;
}

function assertCanManage(actor: AccessTokenPayload, target: User): void {
  if (!canManageUser(actor, target)) {
    throw new ForbiddenError('You cannot manage a user who outranks you');
  }
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const existing = await User.findOne({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw new BadRequestError('An account with that email already exists');
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  // New accounts always start at rank 0 with no permissions - a super admin promotes
  // rank/permissions afterwards. This stops a non-super-admin from creating a peer or
  // superior outright.
  return User.create({
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    role: input.role,
    passwordHash,
    authSource: 'local',
    rank: 0,
    isSuperAdmin: false,
  });
}

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function updateUser(targetId: string, input: UpdateUserInput, actor: AccessTokenPayload): Promise<User> {
  const target = await User.findByPk(targetId);
  if (!target) throw new NotFoundError('User not found');
  assertCanManage(actor, target);
  await target.update(input);
  return target;
}

export async function deleteUser(targetId: string, actor: AccessTokenPayload): Promise<void> {
  const target = await User.findByPk(targetId);
  if (!target) throw new NotFoundError('User not found');
  assertCanManage(actor, target);
  await target.destroy();
}

export async function getUserWithPermissions(targetId: string): Promise<{ user: User; permissions: string[] }> {
  const user = await User.findByPk(targetId);
  if (!user) throw new NotFoundError('User not found');
  const grants = await UserPermission.findAll({ where: { userId: targetId } });
  return { user, permissions: grants.map((g) => g.permissionKey) };
}

export async function setUserPermissions(targetId: string, permissionKeys: string[], actor: AccessTokenPayload): Promise<void> {
  const target = await User.findByPk(targetId);
  if (!target) throw new NotFoundError('User not found');
  assertCanManage(actor, target);
  if (target.role === 'customer') {
    throw new BadRequestError('Customers cannot be granted staff permissions');
  }
  const invalid = permissionKeys.filter((key) => !isValidPermissionKey(key));
  if (invalid.length > 0) {
    throw new BadRequestError(`Unknown permission key(s): ${invalid.join(', ')}`);
  }

  await UserPermission.destroy({ where: { userId: targetId } });
  if (permissionKeys.length > 0) {
    await UserPermission.bulkCreate(permissionKeys.map((permissionKey) => ({ userId: targetId, permissionKey })));
  }
}

// Lets staff with users.edit reset a local account's password directly - the primary
// escape hatch for "this person is locked out and we're not on LDAP/AD so there's no
// self-service reset flow." Hierarchy rules still apply: you can't reset a password for
// someone who outranks you.
export async function resetUserPassword(targetId: string, newPassword: string, actor: AccessTokenPayload): Promise<void> {
  const target = await User.findByPk(targetId);
  if (!target) throw new NotFoundError('User not found');
  assertCanManage(actor, target);
  if (target.authSource !== 'local') {
    throw new BadRequestError('This account signs in via LDAP/AD - its password is managed there, not here');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await target.update({ passwordHash, tokenVersion: target.tokenVersion + 1 });
}

// Rank / super-admin status is the root of the whole hierarchy, so granting it is never
// delegable through the regular permission checkboxes - only an existing super admin can
// promote rank or mint another super admin.
export async function setUserRank(
  targetId: string,
  input: { rank?: number; isSuperAdmin?: boolean },
  actor: AccessTokenPayload
): Promise<User> {
  if (!actor.isSuperAdmin) {
    throw new ForbiddenError('Only a super admin can change rank or super-admin status');
  }
  const target = await User.findByPk(targetId);
  if (!target) throw new NotFoundError('User not found');
  if (target.id === actor.sub) {
    throw new BadRequestError('You cannot change your own rank');
  }
  await target.update(input);
  return target;
}
