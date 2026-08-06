import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { User, UserPermission } from '../../src/db/models';

const app = createApp();

async function createUser(email: string, role: 'admin' | 'technician' | 'customer') {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  await User.create({ email, displayName: email, role, passwordHash, authSource: 'local' });
  const res = await request(app).post('/api/auth/login').send({ username: email, password: 'Password123!' });
  return { token: res.body.accessToken as string, userId: res.body.user.id as string };
}

async function login(email: string) {
  const res = await request(app).post('/api/auth/login').send({ username: email, password: 'Password123!' });
  return { token: res.body.accessToken as string, userId: res.body.user.id as string };
}

afterAll(async () => {
  await sequelize.close();
});

describe('Ticket lifecycle', () => {
  let customer: { token: string; userId: string };
  let tech: { token: string; userId: string };
  let ticketId: number;

  beforeAll(async () => {
    customer = await createUser('ticket-spec-customer@example.com', 'customer');
    tech = await createUser('ticket-spec-tech@example.com', 'technician');
  });

  it('lets a customer create a ticket, with SLA due dates set', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ subject: 'Printer is on fire', description: 'Smoke coming out the side', priority: 'urgent' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('new');
    expect(res.body.responseDueAt).toBeTruthy();
    expect(res.body.resolutionDueAt).toBeTruthy();
    ticketId = res.body.id;
  });

  it("prevents a different customer from viewing someone else's ticket", async () => {
    const otherCustomer = await createUser('ticket-spec-other-customer@example.com', 'customer');
    const res = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${otherCustomer.token}`);
    expect(res.status).toBe(403);
  });

  it('lets a technician add an internal note', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${tech.token}`)
      .send({ body: 'Escalating to facilities, do not tell the customer yet', isInternal: true });
    expect(res.status).toBe(201);
  });

  it('never returns internal notes to the requesting customer', async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}/comments`).set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns internal notes to technicians', async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}/comments`).set('Authorization', `Bearer ${tech.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].isInternal).toBe(true);
  });

  it('blocks customers from creating internal notes', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ body: 'trying to sneak an internal note', isInternal: true });
    expect(res.status).toBe(403);
  });

  it('blocks customers from changing ticket status', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(403);
  });

  it('lets a technician assign and resolve the ticket, recording resolvedAt', async () => {
    const assignRes = await request(app)
      .patch(`/api/tickets/${ticketId}/assign`)
      .set('Authorization', `Bearer ${tech.token}`)
      .send({ assigneeId: tech.userId });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.assigneeId).toBe(tech.userId);

    const resolveRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${tech.token}`)
      .send({ status: 'resolved' });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.status).toBe('resolved');
    expect(resolveRes.body.resolvedAt).toBeTruthy();
  });

  it('blocks a technician who has not been granted the tickets.view_dashboard permission', async () => {
    const res = await request(app).get('/api/tickets/dashboard').set('Authorization', `Bearer ${tech.token}`);
    expect(res.status).toBe(403);
  });

  it('reflects the resolved ticket in the dashboard summary once granted the permission', async () => {
    await UserPermission.create({ userId: tech.userId, permissionKey: 'tickets.view_dashboard' });
    const refreshedTech = await login('ticket-spec-tech@example.com');

    const res = await request(app).get('/api/tickets/dashboard').set('Authorization', `Bearer ${refreshedTech.token}`);
    expect(res.status).toBe(200);
    expect(res.body.openByStatus.resolved).toBeGreaterThanOrEqual(1);
  });

  it('blocks customers from viewing the dashboard', async () => {
    const res = await request(app).get('/api/tickets/dashboard').set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(403);
  });

  it('never leaks passwordHash for the requester/assignee/comment author embedded in ticket responses', async () => {
    const detailRes = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${tech.token}`);
    expect(detailRes.body.requester.passwordHash).toBeUndefined();
    expect(detailRes.body.assignee.passwordHash).toBeUndefined();

    const listRes = await request(app).get('/api/tickets').set('Authorization', `Bearer ${tech.token}`);
    for (const ticket of listRes.body) {
      expect(ticket.requester?.passwordHash).toBeUndefined();
      expect(ticket.assignee?.passwordHash).toBeUndefined();
    }

    const commentsRes = await request(app).get(`/api/tickets/${ticketId}/comments`).set('Authorization', `Bearer ${tech.token}`);
    for (const comment of commentsRes.body) {
      expect(comment.author?.passwordHash).toBeUndefined();
    }
  });
});
