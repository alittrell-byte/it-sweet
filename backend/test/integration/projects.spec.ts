import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createStaff } from '../helpers/testUsers';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

const VIEW_ONLY = { permissions: ['projects.view'] };
const FULL = {
  permissions: ['projects.view', 'projects.create', 'projects.manage', 'projects.manage_tasks', 'projects.delete_tasks'],
};

async function createProject(token: string, ownerId: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Server Migration', ownerId, ...overrides });
  return res.body;
}

async function createTask(token: string, projectId: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Provision new hardware', ...overrides });
  return res.body;
}

describe('Project CRUD and permission gating', () => {
  it('requires projects.view to reach the list endpoint at all', async () => {
    const noPerms = await createStaff(app, 'p-noperm@example.com', { permissions: [] });
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${noPerms.token}`);
    expect(res.status).toBe(403);
  });

  it('requires projects.create to create, but projects.view alone can list/read', async () => {
    const viewer = await createStaff(app, 'p-viewer@example.com', VIEW_ONLY);
    const denied = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ name: 'Should be blocked', ownerId: viewer.userId });
    expect(denied.status).toBe(403);

    const creator = await createStaff(app, 'p-creator@example.com', FULL);
    const project = await createProject(creator.token, creator.userId);
    expect(project.id).toBeDefined();
    expect(project.status).toBe('planning');
  });

  it('creates a project with sane defaults and rejects an unknown owner', async () => {
    const creator = await createStaff(app, 'p-create-defaults@example.com', FULL);
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ name: 'Office Move', ownerId: creator.userId });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('planning');
    expect(res.body.priority).toBe('medium');

    const badOwner = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ name: 'Bad Owner', ownerId: '00000000-0000-0000-0000-000000000000' });
    expect(badOwner.status).toBe(400);
  });

  it('lists projects with rolled-up stats and supports get/update/delete, gated by projects.manage', async () => {
    const creator = await createStaff(app, 'p-lifecycle@example.com', FULL);
    const project = await createProject(creator.token, creator.userId, { name: 'Lifecycle Project' });

    const listRes = await request(app).get('/api/projects').set('Authorization', `Bearer ${creator.token}`);
    expect(listRes.status).toBe(200);
    const summary = listRes.body.find((p: { id: string }) => p.id === project.id);
    expect(summary).toMatchObject({ percentComplete: 0, taskCount: 0, ticketCount: 0, assetCount: 0 });

    const getRes = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.taskCounts).toEqual({ todo: 0, inProgress: 0, done: 0 });

    const viewer = await createStaff(app, 'p-lifecycle-viewer@example.com', VIEW_ONLY);
    const deniedUpdate = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ status: 'active' });
    expect(deniedUpdate.status).toBe(403);

    const updateRes = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ status: 'active' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('active');

    const deleteRes = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${creator.token}`);
    expect(deleteRes.status).toBe(204);
    const afterDelete = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(afterDelete.status).toBe(404);
  });
});

describe('Membership', () => {
  it('adds, updates the role of, and removes a member', async () => {
    const creator = await createStaff(app, 'p-member-owner@example.com', FULL);
    const member = await createStaff(app, 'p-member-target@example.com', { permissions: [] });
    const project = await createProject(creator.token, creator.userId);

    const addRes = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ userId: member.userId, role: 'contributor' });
    expect(addRes.status).toBe(201);
    expect(addRes.body.role).toBe('contributor');

    const dup = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ userId: member.userId });
    expect(dup.status).toBe(400);

    const roleRes = await request(app)
      .patch(`/api/projects/${project.id}/members/${addRes.body.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ role: 'lead' });
    expect(roleRes.status).toBe(200);
    expect(roleRes.body.role).toBe('lead');

    const detail = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(detail.body.members).toHaveLength(1);
    expect(detail.body.members[0].role).toBe('lead');

    const removeRes = await request(app)
      .delete(`/api/projects/${project.id}/members/${addRes.body.id}`)
      .set('Authorization', `Bearer ${creator.token}`);
    expect(removeRes.status).toBe(204);
  });
});

describe('Ticket and asset linking', () => {
  it('links and unlinks an existing ticket at the project level', async () => {
    const creator = await createStaff(app, 'p-link-ticket@example.com', FULL);
    const project = await createProject(creator.token, creator.userId);
    const ticketRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ subject: 'Migrate DNS records', description: 'Part of the server migration', priority: 'high' });
    const ticketId = ticketRes.body.id;

    const linkRes = await request(app)
      .post(`/api/projects/${project.id}/tickets`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ ticketId });
    expect(linkRes.status).toBe(204);

    const detail = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(detail.body.linkedTickets.map((t: { id: number }) => t.id)).toContain(ticketId);

    const unlinkRes = await request(app)
      .delete(`/api/projects/${project.id}/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${creator.token}`);
    expect(unlinkRes.status).toBe(204);

    const afterUnlink = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(afterUnlink.body.linkedTickets).toHaveLength(0);
  });

  it('links and unlinks an asset', async () => {
    const creator = await createStaff(app, 'p-link-asset@example.com', {
      permissions: [...FULL.permissions, 'assets.view', 'assets.create'],
    });
    const project = await createProject(creator.token, creator.userId);
    const assetRes = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ name: 'db-server-01', type: 'hardware' });
    const assetId = assetRes.body.id;

    const linkRes = await request(app)
      .post(`/api/projects/${project.id}/assets`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ assetId });
    expect(linkRes.status).toBe(204);

    const detail = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(detail.body.linkedAssets.map((a: { id: string }) => a.id)).toContain(assetId);

    const unlinkRes = await request(app)
      .delete(`/api/projects/${project.id}/assets/${assetId}`)
      .set('Authorization', `Bearer ${creator.token}`);
    expect(unlinkRes.status).toBe(204);
  });
});

describe('Tasks, dependencies, and the board', () => {
  it('creates tasks, tracks percent-complete rollup, and forces 100% when a task is marked done', async () => {
    const creator = await createStaff(app, 'p-task-rollup@example.com', FULL);
    const project = await createProject(creator.token, creator.userId);

    const taskA = await createTask(creator.token, project.id, { title: 'Task A', percentComplete: 40 });
    const taskB = await createTask(creator.token, project.id, { title: 'Task B', percentComplete: 60 });
    expect(taskA.position).toBe(0);
    expect(taskB.position).toBe(1);

    let detail = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(detail.body.percentComplete).toBe(50);

    const doneRes = await request(app)
      .patch(`/api/projects/${project.id}/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ status: 'done', percentComplete: 10 });
    expect(doneRes.status).toBe(200);
    expect(doneRes.body.percentComplete).toBe(100);

    detail = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(detail.body.percentComplete).toBe(80);
    expect(detail.body.taskCounts).toEqual({ todo: 1, inProgress: 0, done: 1 });
  });

  it('rejects self, duplicate, cross-project, and cyclic dependencies, and gates forward status moves', async () => {
    const creator = await createStaff(app, 'p-deps@example.com', FULL);
    const project = await createProject(creator.token, creator.userId);
    const otherProject = await createProject(creator.token, creator.userId, { name: 'Other Project' });

    const taskA = await createTask(creator.token, project.id, { title: 'A' });
    const taskB = await createTask(creator.token, project.id, { title: 'B' });
    const otherTask = await createTask(creator.token, otherProject.id, { title: 'Other' });

    const selfDep = await request(app)
      .post(`/api/projects/${project.id}/tasks/${taskA.id}/dependencies`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ dependsOnTaskId: taskA.id });
    expect(selfDep.status).toBe(400);

    const crossProject = await request(app)
      .post(`/api/projects/${project.id}/tasks/${taskA.id}/dependencies`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ dependsOnTaskId: otherTask.id });
    expect(crossProject.status).toBe(404);

    // B depends on A (B cannot start until A is done).
    const addRes = await request(app)
      .post(`/api/projects/${project.id}/tasks/${taskB.id}/dependencies`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ dependsOnTaskId: taskA.id });
    expect(addRes.status).toBe(204);

    const dup = await request(app)
      .post(`/api/projects/${project.id}/tasks/${taskB.id}/dependencies`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ dependsOnTaskId: taskA.id });
    expect(dup.status).toBe(400);

    // A depends on B would close a cycle (A -> B -> A).
    const cycle = await request(app)
      .post(`/api/projects/${project.id}/tasks/${taskA.id}/dependencies`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ dependsOnTaskId: taskB.id });
    expect(cycle.status).toBe(400);

    const blockedMove = await request(app)
      .patch(`/api/projects/${project.id}/tasks/${taskB.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ status: 'in_progress' });
    expect(blockedMove.status).toBe(400);

    await request(app)
      .patch(`/api/projects/${project.id}/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ status: 'done' });

    const allowedMove = await request(app)
      .patch(`/api/projects/${project.id}/tasks/${taskB.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ status: 'in_progress' });
    expect(allowedMove.status).toBe(200);
  });

  it('moves tasks across board columns and renumbers positions', async () => {
    const creator = await createStaff(app, 'p-board@example.com', FULL);
    const project = await createProject(creator.token, creator.userId);
    const t1 = await createTask(creator.token, project.id, { title: 'T1' });
    const t2 = await createTask(creator.token, project.id, { title: 'T2' });
    const t3 = await createTask(creator.token, project.id, { title: 'T3' });

    const moveRes = await request(app)
      .post(`/api/projects/${project.id}/tasks/${t3.id}/move`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ status: 'todo', position: 0 });
    expect(moveRes.status).toBe(200);

    const tasksRes = await request(app).get(`/api/projects/${project.id}/tasks`).set('Authorization', `Bearer ${creator.token}`);
    const todoTasks = tasksRes.body.filter((t: { status: string }) => t.status === 'todo').sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    expect(todoTasks.map((t: { id: string }) => t.id)).toEqual([t3.id, t1.id, t2.id]);

    const crossMove = await request(app)
      .post(`/api/projects/${project.id}/tasks/${t1.id}/move`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ status: 'done', position: 0 });
    expect(crossMove.status).toBe(200);
    expect(crossMove.body.percentComplete).toBe(100);
  });

  it('spawns a ticket from a task, assigns it, and links it at the project level', async () => {
    const creator = await createStaff(app, 'p-spawn-owner@example.com', FULL);
    const assignee = await createStaff(app, 'p-spawn-assignee@example.com', { permissions: [] });
    const project = await createProject(creator.token, creator.userId, { priority: 'high' });
    const task = await createTask(creator.token, project.id, {
      title: 'Rack new switch',
      description: 'Install and configure the new core switch',
      assigneeId: assignee.userId,
    });

    const spawnRes = await request(app)
      .post(`/api/projects/${project.id}/tasks/${task.id}/spawn-ticket`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send();
    expect(spawnRes.status).toBe(201);
    expect(spawnRes.body.subject).toBe('Rack new switch');
    expect(spawnRes.body.priority).toBe('high');
    expect(spawnRes.body.assigneeId).toBe(assignee.userId);

    const again = await request(app)
      .post(`/api/projects/${project.id}/tasks/${task.id}/spawn-ticket`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send();
    expect(again.status).toBe(400);

    const detail = await request(app).get(`/api/projects/${project.id}`).set('Authorization', `Bearer ${creator.token}`);
    expect(detail.body.linkedTickets.map((t: { id: number }) => t.id)).toContain(spawnRes.body.id);
  });
});

describe('Task deletion is a separate permission from managing tasks', () => {
  it('rejects delete for a user with manage_tasks but not delete_tasks, and allows it with delete_tasks', async () => {
    const creator = await createStaff(app, 'p-deltask-creator@example.com', FULL);
    const project = await createProject(creator.token, creator.userId);
    const task = await createTask(creator.token, project.id);

    const manageOnly = await createStaff(app, 'p-deltask-manageonly@example.com', {
      permissions: ['projects.view', 'projects.manage_tasks'],
    });
    const denied = await request(app)
      .delete(`/api/projects/${project.id}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${manageOnly.token}`);
    expect(denied.status).toBe(403);

    const deleter = await createStaff(app, 'p-deltask-deleter@example.com', {
      permissions: ['projects.view', 'projects.delete_tasks'],
    });
    const allowed = await request(app)
      .delete(`/api/projects/${project.id}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${deleter.token}`);
    expect(allowed.status).toBe(204);
  });
});

describe('involvesUserId filter ("My Projects")', () => {
  it('includes projects the user owns or has an assigned task in, and excludes ones they do not', async () => {
    const creator = await createStaff(app, 'p-involves-creator@example.com', FULL);
    const other = await createStaff(app, 'p-involves-other@example.com', { permissions: [] });

    const ownedProject = await createProject(creator.token, creator.userId, { name: 'Owned by creator' });
    const assignedProject = await createProject(creator.token, creator.userId, { name: 'Other has a task here' });
    const unrelatedProject = await createProject(creator.token, creator.userId, { name: 'Unrelated' });
    await createTask(creator.token, assignedProject.id, { title: 'Assigned to other', assigneeId: other.userId });

    const res = await request(app)
      .get('/api/projects')
      .query({ involvesUserId: other.userId })
      .set('Authorization', `Bearer ${creator.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((p: { id: string }) => p.id);
    expect(ids).toContain(assignedProject.id);
    expect(ids).not.toContain(ownedProject.id);
    expect(ids).not.toContain(unrelatedProject.id);

    const ownRes = await request(app)
      .get('/api/projects')
      .query({ involvesUserId: creator.userId })
      .set('Authorization', `Bearer ${creator.token}`);
    const ownIds = ownRes.body.map((p: { id: string }) => p.id);
    expect(ownIds).toEqual(expect.arrayContaining([ownedProject.id, assignedProject.id, unrelatedProject.id]));
  });
});

describe('Superadmin bypass - every mutating route must accept isSuperAdmin with zero explicit grants', () => {
  it('succeeds on create/manage/manage_tasks routes without any projects.* permission grant', async () => {
    const superAdmin = await createStaff(app, 'p-superadmin@example.com', { isSuperAdmin: true, permissions: [] });

    const project = await createProject(superAdmin.token, superAdmin.userId);
    expect(project.id).toBeDefined();

    const updateRes = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ status: 'active' });
    expect(updateRes.status).toBe(200);

    const memberRes = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ userId: superAdmin.userId, role: 'lead' });
    expect(memberRes.status).toBe(201);

    const task = await createTask(superAdmin.token, project.id);
    expect(task.id).toBeDefined();

    const taskUpdateRes = await request(app)
      .patch(`/api/projects/${project.id}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ percentComplete: 50 });
    expect(taskUpdateRes.status).toBe(200);

    const moveRes = await request(app)
      .post(`/api/projects/${project.id}/tasks/${task.id}/move`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ status: 'in_progress', position: 0 });
    expect(moveRes.status).toBe(200);

    const secondTask = await createTask(superAdmin.token, project.id, { title: 'Second' });
    const depRes = await request(app)
      .post(`/api/projects/${project.id}/tasks/${secondTask.id}/dependencies`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({ dependsOnTaskId: task.id });
    expect(depRes.status).toBe(204);

    const spawnRes = await request(app)
      .post(`/api/projects/${project.id}/tasks/${task.id}/spawn-ticket`)
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send();
    expect(spawnRes.status).toBe(201);

    const deleteRes = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${superAdmin.token}`);
    expect(deleteRes.status).toBe(204);
  });
});
