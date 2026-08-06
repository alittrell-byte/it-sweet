import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { User, UserPermission } from '../../src/db/models';

const app = createApp();

async function createStaff(email: string, permissions: string[] = [], rank = 0) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await User.create({ email, displayName: email, role: 'technician', passwordHash, authSource: 'local', rank });
  for (const key of permissions) {
    await UserPermission.create({ userId: user.id, permissionKey: key });
  }
  const res = await request(app).post('/api/auth/login').send({ username: email, password: 'Password123!' });
  return { token: res.body.accessToken as string, userId: user.id };
}

afterAll(async () => {
  await sequelize.close();
});

// These pin down the fix for a reported bug: a technician had the user-creation form open,
// had "users.create" revoked by an admin in another session, and was still able to submit
// the form successfully - because the access token embedded permissions at login time and
// nothing re-checked the DB until the token expired (up to JWT_ACCESS_TTL later). Every case
// here uses ONE token obtained before the underlying state changes, to prove the *existing*
// unexpired token is what gets re-evaluated - not a fresh login picking up new state.
describe('Live re-authorization on every request (no stale JWT claims)', () => {
  it('blocks a still-valid token immediately after its users.create permission is revoked', async () => {
    const grantor = await createStaff('live-authz-grantor1@example.com', ['users.manage_permissions', 'users.view'], 10);
    const actor = await createStaff('live-authz-actor1@example.com', ['users.create']);

    const beforeRevoke = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ email: 'live-authz-created1@example.com', password: 'Password123!', displayName: 'x', role: 'customer' });
    expect(beforeRevoke.status).toBe(201);

    const revokeRes = await request(app)
      .put(`/api/users/${actor.userId}/permissions`)
      .set('Authorization', `Bearer ${grantor.token}`)
      .send({ permissionKeys: [] });
    expect(revokeRes.status).toBe(204);

    const afterRevoke = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`) // same token as above, never refreshed
      .send({ email: 'live-authz-created2@example.com', password: 'Password123!', displayName: 'y', role: 'customer' });
    expect(afterRevoke.status).toBe(403);
  });

  it('grants a still-valid token access immediately after a permission is added, with no re-login', async () => {
    const grantor = await createStaff('live-authz-grantor2@example.com', ['users.manage_permissions', 'users.view'], 10);
    const actor = await createStaff('live-authz-actor2@example.com'); // no permissions yet

    const before = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ email: 'live-authz-created3@example.com', password: 'Password123!', displayName: 'x', role: 'customer' });
    expect(before.status).toBe(403);

    const grantRes = await request(app)
      .put(`/api/users/${actor.userId}/permissions`)
      .set('Authorization', `Bearer ${grantor.token}`)
      .send({ permissionKeys: ['users.create'] });
    expect(grantRes.status).toBe(204);

    const after = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${actor.token}`) // same token, still the one from before the grant
      .send({ email: 'live-authz-created4@example.com', password: 'Password123!', displayName: 'y', role: 'customer' });
    expect(after.status).toBe(201);
  });

  it('rejects a still-valid token immediately after the account is deactivated', async () => {
    const actor = await createStaff('live-authz-deactivate@example.com');
    const before = await request(app).get('/api/tickets').set('Authorization', `Bearer ${actor.token}`);
    expect(before.status).toBe(200);

    await User.update({ isActive: false }, { where: { id: actor.userId } });

    const after = await request(app).get('/api/tickets').set('Authorization', `Bearer ${actor.token}`);
    expect(after.status).toBe(401);
  });

  it('rejects a still-valid token immediately after the account is deleted', async () => {
    const actor = await createStaff('live-authz-delete@example.com');
    const before = await request(app).get('/api/tickets').set('Authorization', `Bearer ${actor.token}`);
    expect(before.status).toBe(200);

    await User.destroy({ where: { id: actor.userId } });

    const after = await request(app).get('/api/tickets').set('Authorization', `Bearer ${actor.token}`);
    expect(after.status).toBe(401);
  });

  it('applies a role demotion to a still-valid token immediately', async () => {
    const actor = await createStaff('live-authz-demote@example.com');
    const beforeDemote = await request(app)
      .patch('/api/tickets/1/status')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ status: 'resolved' });
    // technician role permits the attempt (404 for a nonexistent ticket, not 403 for role)
    expect(beforeDemote.status).not.toBe(403);

    await User.update({ role: 'customer' }, { where: { id: actor.userId } });

    const afterDemote = await request(app)
      .patch('/api/tickets/1/status')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ status: 'resolved' });
    expect(afterDemote.status).toBe(403);
  });
});
