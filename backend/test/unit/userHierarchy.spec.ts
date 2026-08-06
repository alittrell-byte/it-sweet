import { canManageUser } from '../../src/modules/auth/userManagementService';
import { AccessTokenPayload } from '../../src/modules/auth/authService';
import { User } from '../../src/modules/auth/user.model';

function actor(overrides: Partial<AccessTokenPayload> = {}): AccessTokenPayload {
  return { sub: 'actor-id', role: 'admin', email: 'actor@example.com', rank: 0, isSuperAdmin: false, permissions: [], ...overrides };
}

function target(overrides: Partial<{ id: string; rank: number; isSuperAdmin: boolean }> = {}): User {
  return { id: 'target-id', rank: 0, isSuperAdmin: false, ...overrides } as User;
}

describe('canManageUser (hierarchy rules)', () => {
  it('lets a super admin manage anyone, regardless of rank', () => {
    expect(canManageUser(actor({ isSuperAdmin: true, rank: 0 }), target({ rank: 999 }))).toBe(true);
  });

  it('lets a super admin manage another super admin', () => {
    expect(canManageUser(actor({ isSuperAdmin: true }), target({ isSuperAdmin: true }))).toBe(true);
  });

  it('never lets a non-super-admin manage a super admin', () => {
    expect(canManageUser(actor({ rank: 1000 }), target({ isSuperAdmin: true, rank: 1 }))).toBe(false);
  });

  it('lets a higher-rank user manage a lower-rank user', () => {
    expect(canManageUser(actor({ rank: 5 }), target({ rank: 1 }))).toBe(true);
  });

  it('blocks a lower-rank user from managing a higher-rank user', () => {
    expect(canManageUser(actor({ rank: 1 }), target({ rank: 5 }))).toBe(false);
  });

  it('blocks peers at the same rank from managing each other', () => {
    expect(canManageUser(actor({ rank: 3 }), target({ rank: 3 }))).toBe(false);
  });

  it('never lets a user manage themself through this path', () => {
    const same = actor({ sub: 'same-id', isSuperAdmin: true });
    expect(canManageUser(same, target({ id: 'same-id' }))).toBe(false);
  });
});
