import bcrypt from 'bcrypt';
import request from 'supertest';
import { Application } from 'express';
import { User, UserPermission } from '../../src/db/models';

const PASSWORD = 'Password123!';

export interface CreateStaffOptions {
  role?: 'admin' | 'technician';
  rank?: number;
  isSuperAdmin?: boolean;
  permissions?: string[];
}

export interface TestActor {
  token: string;
  userId: string;
}

/**
 * Creates a staff (admin/technician) user, optionally with a rank and/or permission grants, and
 * logs in. Defaults `rank` to 0 - callers acting as a grantor/manager over another user in the
 * same test must pass an explicit higher rank, or rank-hierarchy checks (canManageUser) will
 * silently block the setup itself (two rank-0 users can never manage each other).
 */
export async function createStaff(app: Application, email: string, opts: CreateStaffOptions = {}): Promise<TestActor> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await User.create({
    email: email.toLowerCase(),
    displayName: email,
    role: opts.role ?? 'technician',
    passwordHash,
    authSource: 'local',
    rank: opts.rank ?? 0,
    isSuperAdmin: opts.isSuperAdmin ?? false,
  });
  for (const key of opts.permissions ?? []) {
    await UserPermission.create({ userId: user.id, permissionKey: key });
  }
  const res = await request(app).post('/api/auth/login').send({ username: email, password: PASSWORD });
  return { token: res.body.accessToken as string, userId: user.id };
}

/** Creates a customer (end-user) account and logs in. Customers never hold permission grants. */
export async function createCustomer(app: Application, email: string): Promise<TestActor> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await User.create({
    email: email.toLowerCase(),
    displayName: email,
    role: 'customer',
    passwordHash,
    authSource: 'local',
  });
  const res = await request(app).post('/api/auth/login').send({ username: email, password: PASSWORD });
  return { token: res.body.accessToken as string, userId: user.id };
}

/** Re-logs in an existing user - needed to observe a mid-test permission/role change taking effect. */
export async function loginAs(app: Application, email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username: email, password: PASSWORD });
  return res.body.accessToken as string;
}
