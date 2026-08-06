import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { User, UserPermission } from '../../src/db/models';

const app = createApp();

async function createStaff(email: string, permissions: string[] = []) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await User.create({ email, displayName: email, role: 'technician', passwordHash, authSource: 'local' });
  for (const key of permissions) {
    await UserPermission.create({ userId: user.id, permissionKey: key });
  }
  const res = await request(app).post('/api/auth/login').send({ username: email, password: 'Password123!' });
  return { token: res.body.accessToken as string, userId: user.id };
}

afterAll(async () => {
  await sequelize.close();
});

describe('Notification group membership', () => {
  it('blocks a technician without notifications.manage_groups from managing groups', async () => {
    const staff = await createStaff('notif-no-perm@example.com');
    const res = await request(app).get('/api/notification-groups').set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('lets a permitted staff member create a group and add/remove members', async () => {
    const manager = await createStaff('notif-manager@example.com', ['notifications.manage_groups']);
    const member = await createStaff('notif-member@example.com');

    const createRes = await request(app)
      .post('/api/notification-groups')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'On-call Rotation' });
    expect(createRes.status).toBe(201);
    const groupId = createRes.body.id;

    const addRes = await request(app)
      .post(`/api/notification-groups/${groupId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: member.userId });
    expect(addRes.status).toBe(204);

    const listRes = await request(app).get('/api/notification-groups').set('Authorization', `Bearer ${manager.token}`);
    const group = listRes.body.find((g: { id: string }) => g.id === groupId);
    expect(group.members.map((m: { id: string }) => m.id)).toContain(member.userId);

    const removeRes = await request(app)
      .delete(`/api/notification-groups/${groupId}/members/${member.userId}`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(removeRes.status).toBe(204);

    const listAfterRemove = await request(app).get('/api/notification-groups').set('Authorization', `Bearer ${manager.token}`);
    const groupAfterRemove = listAfterRemove.body.find((g: { id: string }) => g.id === groupId);
    expect(groupAfterRemove.members.map((m: { id: string }) => m.id)).not.toContain(member.userId);
  });

  it('never leaks member passwordHash in the group listing', async () => {
    const manager = await createStaff('notif-leak-check@example.com', ['notifications.manage_groups']);
    const member = await createStaff('notif-leak-member@example.com');
    const createRes = await request(app)
      .post('/api/notification-groups')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Leak Check Group' });
    await request(app)
      .post(`/api/notification-groups/${createRes.body.id}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: member.userId });

    const listRes = await request(app).get('/api/notification-groups').set('Authorization', `Bearer ${manager.token}`);
    for (const group of listRes.body) {
      for (const m of group.members) {
        expect(m.passwordHash).toBeUndefined();
      }
    }
  });
});
