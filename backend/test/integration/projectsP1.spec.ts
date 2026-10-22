import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createStaff } from '../helpers/testUsers';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

const FULL = {
  permissions: [
    'projects.view',
    'projects.create',
    'projects.manage',
    'projects.manage_tasks',
    'projects.delete_tasks',
    'projects.manage_templates',
  ],
};

async function createProject(token: string, ownerId: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'P1 Test Project', ownerId, ...overrides });
  return res.body;
}

describe('Attachments', () => {
  it('uploads, lists, downloads, and deletes a project attachment', async () => {
    const staff = await createStaff(app, 'p1-attach@example.com', FULL);
    const project = await createProject(staff.token, staff.userId);

    const uploadRes = await request(app)
      .post(`/api/projects/${project.id}/attachments`)
      .set('Authorization', `Bearer ${staff.token}`)
      .attach('file', Buffer.from('hello project attachment'), 'notes.txt');
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.fileName).toBe('notes.txt');

    const listRes = await request(app)
      .get(`/api/projects/${project.id}/attachments`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const downloadRes = await request(app)
      .get(`/api/projects/${project.id}/attachments/${uploadRes.body.id}`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.text).toBe('hello project attachment');

    const deleteRes = await request(app)
      .delete(`/api/projects/${project.id}/attachments/${uploadRes.body.id}`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/api/projects/${project.id}/attachments`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(afterDelete.body).toHaveLength(0);
  });

  it('gates upload/delete behind projects.manage but leaves listing to projects.view', async () => {
    const owner = await createStaff(app, 'p1-attach-owner@example.com', FULL);
    const project = await createProject(owner.token, owner.userId);
    const viewer = await createStaff(app, 'p1-attach-viewer@example.com', { permissions: ['projects.view'] });

    const denied = await request(app)
      .post(`/api/projects/${project.id}/attachments`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .attach('file', Buffer.from('x'), 'x.txt');
    expect(denied.status).toBe(403);

    const listRes = await request(app)
      .get(`/api/projects/${project.id}/attachments`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(listRes.status).toBe(200);
  });
});

describe('Sub-projects', () => {
  it('rejects self, 2-hop, and 3-hop cycles, and allows a valid reparent', async () => {
    const staff = await createStaff(app, 'p1-subproj@example.com', FULL);
    const a = await createProject(staff.token, staff.userId, { name: 'A' });
    const b = await createProject(staff.token, staff.userId, { name: 'B' });
    const c = await createProject(staff.token, staff.userId, { name: 'C' });

    const selfCycle = await request(app)
      .patch(`/api/projects/${a.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ parentProjectId: a.id });
    expect(selfCycle.status).toBe(400);

    // B's parent is A.
    const setBParent = await request(app)
      .patch(`/api/projects/${b.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ parentProjectId: a.id });
    expect(setBParent.status).toBe(200);

    // A's parent = B would close a 2-hop cycle (A -> B -> A).
    const twoHop = await request(app)
      .patch(`/api/projects/${a.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ parentProjectId: b.id });
    expect(twoHop.status).toBe(400);

    // C's parent is B (A -> B -> C chain).
    const setCParent = await request(app)
      .patch(`/api/projects/${c.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ parentProjectId: b.id });
    expect(setCParent.status).toBe(200);

    // A's parent = C would close a 3-hop cycle (A -> B -> C -> A).
    const threeHop = await request(app)
      .patch(`/api/projects/${a.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ parentProjectId: c.id });
    expect(threeHop.status).toBe(400);

    const detail = await request(app).get(`/api/projects/${a.id}`).set('Authorization', `Bearer ${staff.token}`);
    expect(detail.body.subProjects.map((p: { id: string }) => p.id)).toEqual([b.id]);

    const bDetail = await request(app).get(`/api/projects/${b.id}`).set('Authorization', `Bearer ${staff.token}`);
    expect(bDetail.body.parentProject).toMatchObject({ id: a.id, name: 'A' });
  });
});

describe('Templates', () => {
  it('creates a template with tasks and instantiates a project from it, computing due dates from relativeDueDays', async () => {
    const staff = await createStaff(app, 'p1-template@example.com', FULL);

    const template = await request(app)
      .post('/api/projects/templates')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'New Office Setup', description: 'Standard checklist' });
    expect(template.status).toBe(201);

    const task1 = await request(app)
      .post(`/api/projects/templates/${template.body.id}/tasks`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ title: 'Order hardware', relativeDueDays: 3 });
    expect(task1.status).toBe(201);
    expect(task1.body.position).toBe(0);

    const task2 = await request(app)
      .post(`/api/projects/templates/${template.body.id}/tasks`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ title: 'No due date task' });
    expect(task2.body.position).toBe(1);

    const project = await createProject(staff.token, staff.userId, {
      name: 'New Denver Office',
      startDate: '2026-01-01',
      templateId: template.body.id,
    });
    expect(project.id).toBeDefined();

    const tasksRes = await request(app).get(`/api/projects/${project.id}/tasks`).set('Authorization', `Bearer ${staff.token}`);
    expect(tasksRes.body).toHaveLength(2);
    const orderHardware = tasksRes.body.find((t: { title: string }) => t.title === 'Order hardware');
    const noDueDate = tasksRes.body.find((t: { title: string }) => t.title === 'No due date task');
    expect(orderHardware.dueDate).toBe('2026-01-04');
    expect(noDueDate.dueDate).toBeNull();
    expect(orderHardware.position).toBe(0);
    expect(noDueDate.position).toBe(1);
  });

  it('rejects an unknown templateId without leaving behind an orphan project', async () => {
    const staff = await createStaff(app, 'p1-template-bad@example.com', FULL);
    const before = await request(app).get('/api/projects').set('Authorization', `Bearer ${staff.token}`);

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Should not be created', ownerId: staff.userId, templateId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);

    const after = await request(app).get('/api/projects').set('Authorization', `Bearer ${staff.token}`);
    expect(after.body.length).toBe(before.body.length);
  });

  it('gates template management behind projects.manage_templates, separate from projects.manage', async () => {
    const managerOnly = await createStaff(app, 'p1-template-managerOnly@example.com', {
      permissions: ['projects.view', 'projects.manage'],
    });
    const denied = await request(app)
      .post('/api/projects/templates')
      .set('Authorization', `Bearer ${managerOnly.token}`)
      .send({ name: 'Should be blocked' });
    expect(denied.status).toBe(403);
  });
});

describe('Milestones', () => {
  it('creates, completes, uncompletes, and deletes a milestone', async () => {
    const staff = await createStaff(app, 'p1-milestone@example.com', FULL);
    const project = await createProject(staff.token, staff.userId);

    const created = await request(app)
      .post(`/api/projects/${project.id}/milestones`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Phase 1 complete', dueDate: '2026-03-01' });
    expect(created.status).toBe(201);
    expect(created.body.completedAt).toBeNull();

    const completed = await request(app)
      .patch(`/api/projects/${project.id}/milestones/${created.body.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ completed: true });
    expect(completed.status).toBe(200);
    expect(completed.body.completedAt).not.toBeNull();

    const uncompleted = await request(app)
      .patch(`/api/projects/${project.id}/milestones/${created.body.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ completed: false });
    expect(uncompleted.body.completedAt).toBeNull();

    const deleteRes = await request(app)
      .delete(`/api/projects/${project.id}/milestones/${created.body.id}`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get(`/api/projects/${project.id}/milestones`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(listRes.body).toHaveLength(0);
  });
});

describe('Superadmin bypass - P1 routes', () => {
  it('succeeds on template, milestone, attachment, and sub-project routes without any projects.* grant', async () => {
    const superAdmin = await createStaff(app, 'p1-superadmin@example.com', { isSuperAdmin: true, permissions: [] });
    const project = await createProject(superAdmin.token, superAdmin.userId);
    const subProject = await createProject(superAdmin.token, superAdmin.userId, { name: 'Sub', parentProjectId: project.id });
    expect(subProject.id).toBeDefined();

    const template = await request(app)
      .post('/api/projects/templates')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ name: 'Superadmin Template' });
    expect(template.status).toBe(201);

    const milestone = await request(app)
      .post(`/api/projects/${project.id}/milestones`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ name: 'Milestone' });
    expect(milestone.status).toBe(201);

    const attachment = await request(app)
      .post(`/api/projects/${project.id}/attachments`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .attach('file', Buffer.from('x'), 'x.txt');
    expect(attachment.status).toBe(201);
  });
});
