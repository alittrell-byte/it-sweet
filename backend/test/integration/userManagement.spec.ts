import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { User, UserPermission } from '../../src/db/models';

const app = createApp();

async function createStaff(
  email: string,
  opts: { role?: 'admin' | 'technician'; rank?: number; isSuperAdmin?: boolean; permissions?: string[] } = {}
) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await User.create({
    email,
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
  const res = await request(app).post('/api/auth/login').send({ username: email, password: 'Password123!' });
  return { token: res.body.accessToken as string, userId: user.id };
}

afterAll(async () => {
  await sequelize.close();
});

describe('User management: permissions and hierarchy', () => {
  it('exposes the permission catalog to any staff member', async () => {
    const staff = await createStaff('perm-catalog-staff@example.com');
    const res = await request(app).get('/api/users/permission-catalog').set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((m: { module: string }) => m.module === 'users')).toBe(true);
  });

  it('blocks a technician without users.create from creating a user', async () => {
    const staff = await createStaff('no-create-perm@example.com');
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ email: 'new1@example.com', password: 'Password123!', displayName: 'New One', role: 'technician' });
    expect(res.status).toBe(403);
  });

  it('lets a technician with users.create create a new user, starting at rank 0', async () => {
    const staff = await createStaff('has-create-perm@example.com', { permissions: ['users.create'] });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ email: 'new2@example.com', password: 'Password123!', displayName: 'New Two', role: 'technician' });
    expect(res.status).toBe(201);
    expect(res.body.rank).toBe(0);
    expect(res.body.isSuperAdmin).toBe(false);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('never leaks passwordHash through create, get, update, or rank responses', async () => {
    const superAdmin = await createStaff('super-leak-check@example.com', {
      isSuperAdmin: true,
      rank: 1000,
      permissions: ['users.create', 'users.view', 'users.edit'],
    });
    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ email: 'leak-check@example.com', password: 'Password123!', displayName: 'Leak Check', role: 'technician' });
    expect(createRes.body.passwordHash).toBeUndefined();
    const targetId = createRes.body.id;

    const getRes = await request(app).get(`/api/users/${targetId}`).set('Authorization', `Bearer ${superAdmin.token}`);
    expect(getRes.body.passwordHash).toBeUndefined();

    const updateRes = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ displayName: 'Leak Check Updated' });
    expect(updateRes.body.passwordHash).toBeUndefined();

    const rankRes = await request(app)
      .patch(`/api/users/${targetId}/rank`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ rank: 1 });
    expect(rankRes.body.passwordHash).toBeUndefined();
  });

  it('rejects an unknown permission key when granting permissions', async () => {
    const superAdmin = await createStaff('super1@example.com', { isSuperAdmin: true, rank: 1000 });
    const target = await createStaff('grant-target1@example.com');
    const res = await request(app)
      .put(`/api/users/${target.userId}/permissions`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ permissionKeys: ['not.a.real.permission'] });
    expect(res.status).toBe(400);
  });

  it('blocks peers at the same rank from deleting each other even with users.delete', async () => {
    const actorUser = await createStaff('peer-actor@example.com', { rank: 2, permissions: ['users.delete'] });
    const peer = await createStaff('peer-target@example.com', { rank: 2 });
    const res = await request(app).delete(`/api/users/${peer.userId}`).set('Authorization', `Bearer ${actorUser.token}`);
    expect(res.status).toBe(403);
  });

  it('lets a higher-rank user delete a lower-rank user when granted users.delete', async () => {
    const actorUser = await createStaff('senior-actor@example.com', { rank: 10, permissions: ['users.delete'] });
    const junior = await createStaff('junior-target@example.com', { rank: 1 });
    const res = await request(app).delete(`/api/users/${junior.userId}`).set('Authorization', `Bearer ${actorUser.token}`);
    expect(res.status).toBe(204);
    expect(await User.findByPk(junior.userId)).toBeNull();
  });

  it('blocks anyone but a super admin from deleting a super admin', async () => {
    const superAdmin = await createStaff('super2@example.com', { isSuperAdmin: true, rank: 1000 });
    const highRankNonSuper = await createStaff('high-non-super@example.com', { rank: 999, permissions: ['users.delete'] });
    const res = await request(app)
      .delete(`/api/users/${superAdmin.userId}`)
      .set('Authorization', `Bearer ${highRankNonSuper.token}`);
    expect(res.status).toBe(403);
  });

  it('blocks a non-super-admin from changing rank or super-admin status, even with other permissions', async () => {
    const actorUser = await createStaff('rank-attempt@example.com', {
      permissions: ['users.edit', 'users.manage_permissions'],
    });
    const target = await createStaff('rank-victim@example.com');
    const res = await request(app)
      .patch(`/api/users/${target.userId}/rank`)
      .set('Authorization', `Bearer ${actorUser.token}`)
      .send({ rank: 500 });
    expect(res.status).toBe(403);
  });

  it('lets a super admin promote rank', async () => {
    const superAdmin = await createStaff('super3@example.com', { isSuperAdmin: true, rank: 1000 });
    const target = await createStaff('rank-promotee@example.com');
    const res = await request(app)
      .patch(`/api/users/${target.userId}/rank`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ rank: 50 });
    expect(res.status).toBe(200);
    expect(res.body.rank).toBe(50);
  });

  it('refuses to grant staff permissions to a customer account', async () => {
    const superAdmin = await createStaff('super4@example.com', { isSuperAdmin: true, rank: 1000 });
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const customer = await User.create({
      email: 'perm-customer@example.com',
      displayName: 'Customer',
      role: 'customer',
      passwordHash,
      authSource: 'local',
    });
    const res = await request(app)
      .put(`/api/users/${customer.id}/permissions`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ permissionKeys: ['users.view'] });
    expect(res.status).toBe(400);
  });

  describe('PATCH /api/users/:id/password (admin reset)', () => {
    it('lets a manager with users.edit reset a lower-rank local account and the new password works', async () => {
      const manager = await createStaff('reset-manager@example.com', { rank: 10, permissions: ['users.edit'] });
      const target = await createStaff('reset-target@example.com', { rank: 1 });

      const res = await request(app)
        .patch(`/api/users/${target.userId}/password`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ newPassword: 'AdminResetPassword1' });
      expect(res.status).toBe(204);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'reset-target@example.com', password: 'AdminResetPassword1' });
      expect(loginRes.status).toBe(200);
    });

    it('blocks resetting the password of a peer at the same rank', async () => {
      const actorUser = await createStaff('reset-peer-actor@example.com', { rank: 2, permissions: ['users.edit'] });
      const peer = await createStaff('reset-peer-target@example.com', { rank: 2 });
      const res = await request(app)
        .patch(`/api/users/${peer.userId}/password`)
        .set('Authorization', `Bearer ${actorUser.token}`)
        .send({ newPassword: 'AdminResetPassword1' });
      expect(res.status).toBe(403);
    });

    it('refuses to reset the password of an LDAP-sourced account', async () => {
      const superAdmin = await createStaff('reset-super@example.com', { isSuperAdmin: true, rank: 1000 });
      const ldapUser = await User.create({
        email: 'reset-ldap-user@example.com',
        displayName: 'LDAP User',
        role: 'technician',
        authSource: 'ldap',
        externalId: 'CN=ldap-user,DC=corp,DC=local',
      });
      const res = await request(app)
        .patch(`/api/users/${ldapUser.id}/password`)
        .set('Authorization', `Bearer ${superAdmin.token}`)
        .send({ newPassword: 'AdminResetPassword1' });
      expect(res.status).toBe(400);
    });

    it('blocks a technician without users.edit from resetting anyone', async () => {
      const noPerm = await createStaff('reset-no-perm@example.com', { rank: 100 });
      const target = await createStaff('reset-no-perm-target@example.com', { rank: 1 });
      const res = await request(app)
        .patch(`/api/users/${target.userId}/password`)
        .set('Authorization', `Bearer ${noPerm.token}`)
        .send({ newPassword: 'AdminResetPassword1' });
      expect(res.status).toBe(403);
    });
  });
});
