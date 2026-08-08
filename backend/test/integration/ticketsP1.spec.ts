import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createCustomer, createStaff } from '../helpers/testUsers';
import { runDueRecurringTickets } from '../../src/modules/tickets/recurringTicketService';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

async function createTicket(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ subject: 'Test ticket', description: 'Something is broken', priority: 'medium', ...overrides });
  return res.body;
}

describe('Assignment RBAC (pre-existing gap, filled per the P1 RBAC audit)', () => {
  it('blocks customers from assigning tickets', async () => {
    const customer = await createCustomer(app, 'p1-assign-customer@example.com');
    const staff = await createStaff(app, 'p1-assign-staff@example.com');
    const ticket = await createTicket(customer.token);

    const denied = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ assigneeId: staff.userId });
    expect(denied.status).toBe(403);
  });
});

describe('Ticket templates', () => {
  it('is readable by any authenticated user but only manageable with tickets.manage_templates', async () => {
    const customer = await createCustomer(app, 'p1-templates-customer@example.com');
    const staffNoPerm = await createStaff(app, 'p1-templates-staff-noperm@example.com');
    const staffManager = await createStaff(app, 'p1-templates-staff-manager@example.com', {
      permissions: ['tickets.manage_templates'],
    });

    const readRes = await request(app).get('/api/ticket-templates').set('Authorization', `Bearer ${customer.token}`);
    expect(readRes.status).toBe(200);

    const denied = await request(app)
      .post('/api/ticket-templates')
      .set('Authorization', `Bearer ${staffNoPerm.token}`)
      .send({ name: 'New Hire', subjectTemplate: 'New hire setup', descriptionTemplate: 'Provision accounts', priority: 'medium' });
    expect(denied.status).toBe(403);

    const created = await request(app)
      .post('/api/ticket-templates')
      .set('Authorization', `Bearer ${staffManager.token}`)
      .send({ name: 'New Hire', subjectTemplate: 'New hire setup', descriptionTemplate: 'Provision accounts', priority: 'medium', category: 'onboarding' });
    expect(created.status).toBe(201);

    const manageListDenied = await request(app).get('/api/ticket-templates/manage').set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(manageListDenied.status).toBe(403);

    const ticket = await createTicket(customer.token, { sourceTemplateId: created.body.id });
    expect(ticket.sourceTemplateId).toBe(created.body.id);

    const deleted = await request(app)
      .delete(`/api/ticket-templates/${created.body.id}`)
      .set('Authorization', `Bearer ${staffManager.token}`);
    expect(deleted.status).toBe(204);
  });
});

describe('Approval workflow', () => {
  it('routes a ticket through pending_approval and blocks direct status changes while pending', async () => {
    const customer = await createCustomer(app, 'p1-approval-customer@example.com');
    const staffNoPerm = await createStaff(app, 'p1-approval-staff-noperm@example.com');
    const approver = await createStaff(app, 'p1-approval-approver@example.com', { permissions: ['tickets.approve'] });

    const ticket = await createTicket(customer.token, { requiresApproval: true });
    expect(ticket.status).toBe('pending_approval');
    expect(ticket.approvalStatus).toBe('pending');

    const blockedStatusChange = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${approver.token}`)
      .send({ status: 'in_progress' });
    expect(blockedStatusChange.status).toBe(400);

    const deniedApprove = await request(app)
      .patch(`/api/tickets/${ticket.id}/approve`)
      .set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(deniedApprove.status).toBe(403);

    const approved = await request(app).patch(`/api/tickets/${ticket.id}/approve`).set('Authorization', `Bearer ${approver.token}`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('new');
    expect(approved.body.approvalStatus).toBe('approved');
  });

  it('closes and records a reason when rejected, and auto-creates a survey slot', async () => {
    const customer = await createCustomer(app, 'p1-reject-customer@example.com');
    const approver = await createStaff(app, 'p1-reject-approver@example.com', { permissions: ['tickets.approve'] });

    const ticket = await createTicket(customer.token, { requiresApproval: true });
    const rejected = await request(app)
      .patch(`/api/tickets/${ticket.id}/reject`)
      .set('Authorization', `Bearer ${approver.token}`)
      .send({ reason: 'Not needed' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('closed');
    expect(rejected.body.approvalStatus).toBe('rejected');
    expect(rejected.body.approvalReason).toBe('Not needed');

    const submitted = await request(app)
      .post(`/api/tickets/${ticket.id}/survey`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ rating: 3 });
    expect(submitted.status).toBe(200);
  });
});

describe('Teams and escalation', () => {
  it('gates team management by tickets.manage_teams while listing stays open', async () => {
    const customer = await createCustomer(app, 'p1-teams-customer@example.com');
    const staffNoPerm = await createStaff(app, 'p1-teams-staff-noperm@example.com');
    const manager = await createStaff(app, 'p1-teams-manager@example.com', { permissions: ['tickets.manage_teams'] });

    const listRes = await request(app).get('/api/teams').set('Authorization', `Bearer ${customer.token}`);
    expect(listRes.status).toBe(200);

    const denied = await request(app).post('/api/teams').set('Authorization', `Bearer ${staffNoPerm.token}`).send({ name: 'Tier 1' });
    expect(denied.status).toBe(403);

    const tier1 = await request(app).post('/api/teams').set('Authorization', `Bearer ${manager.token}`).send({ name: 'p1-Tier1', tier: 1 });
    expect(tier1.status).toBe(201);
    const tier2 = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'p1-Tier2', tier: 2, escalatesToTeamId: null });
    expect(tier2.status).toBe(201);

    const linkTier = await request(app)
      .patch(`/api/teams/${tier1.body.id}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ escalatesToTeamId: tier2.body.id });
    expect(linkTier.status).toBe(200);

    const memberDenied = await request(app)
      .post(`/api/teams/${tier1.body.id}/members`)
      .set('Authorization', `Bearer ${staffNoPerm.token}`)
      .send({ userId: staffNoPerm.userId });
    expect(memberDenied.status).toBe(403);

    const memberAdded = await request(app)
      .post(`/api/teams/${tier1.body.id}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: staffNoPerm.userId });
    expect(memberAdded.status).toBe(204);
  });

  it('escalates to the default next-tier team, clears the assignee, and records history', async () => {
    const customer = await createCustomer(app, 'p1-escalate-customer@example.com');
    const manager = await createStaff(app, 'p1-escalate-manager@example.com', { permissions: ['tickets.manage_teams'] });
    const staff = await createStaff(app, 'p1-escalate-staff@example.com');

    const tier2 = await request(app).post('/api/teams').set('Authorization', `Bearer ${manager.token}`).send({ name: 'p1-esc-Tier2' });
    const tier1 = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'p1-esc-Tier1', escalatesToTeamId: tier2.body.id });

    const ticket = await createTicket(customer.token, { teamId: tier1.body.id });
    const assigned = await request(app)
      .patch(`/api/tickets/${ticket.id}/assign`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assigneeId: staff.userId });
    expect(assigned.status).toBe(200);

    const deniedForCustomer = await request(app)
      .post(`/api/tickets/${ticket.id}/escalate`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({});
    expect(deniedForCustomer.status).toBe(403);

    const escalated = await request(app).post(`/api/tickets/${ticket.id}/escalate`).set('Authorization', `Bearer ${staff.token}`).send({});
    expect(escalated.status).toBe(200);
    expect(escalated.body.teamId).toBe(tier2.body.id);
    expect(escalated.body.assigneeId).toBeNull();
  });

  it('rejects escalation with no explicit target and no default configured', async () => {
    const customer = await createCustomer(app, 'p1-escalate-noteam-customer@example.com');
    const staff = await createStaff(app, 'p1-escalate-noteam-staff@example.com');
    const ticket = await createTicket(customer.token);

    const res = await request(app).post(`/api/tickets/${ticket.id}/escalate`).set('Authorization', `Bearer ${staff.token}`).send({});
    expect(res.status).toBe(400);
  });
});

describe('Tags', () => {
  it('is staff-only, normalizes names, and filters via the indexed join', async () => {
    const customer = await createCustomer(app, 'p1-tags-customer@example.com');
    const staff = await createStaff(app, 'p1-tags-staff@example.com');

    const ticketA = await createTicket(customer.token, { subject: 'Tag target A' });
    const ticketB = await createTicket(customer.token, { subject: 'Tag target B' });

    const denied = await request(app)
      .patch(`/api/tickets/${ticketA.id}/tags`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ tags: ['vpn'] });
    expect(denied.status).toBe(403);

    const tagged = await request(app)
      .patch(`/api/tickets/${ticketA.id}/tags`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ tags: ['VPN', ' vpn ', 'Networking'] });
    expect(tagged.status).toBe(200);
    const names = (tagged.body.tags as Array<{ name: string }>).map((t) => t.name).sort();
    expect(names).toEqual(['networking', 'vpn']);

    const filtered = await request(app).get('/api/tickets').query({ tag: 'vpn' }).set('Authorization', `Bearer ${staff.token}`);
    expect(filtered.status).toBe(200);
    const ids = (filtered.body as Array<{ id: number }>).map((t) => t.id);
    expect(ids).toContain(ticketA.id);
    expect(ids).not.toContain(ticketB.id);
  });
});

describe('Time tracking', () => {
  it('is staff-only to log, and only the logging technician or an admin may delete', async () => {
    const customer = await createCustomer(app, 'p1-time-customer@example.com');
    const techA = await createStaff(app, 'p1-time-techA@example.com');
    const techB = await createStaff(app, 'p1-time-techB@example.com');
    const admin = await createStaff(app, 'p1-time-admin@example.com', { role: 'admin' });

    const ticket = await createTicket(customer.token);

    const deniedForCustomer = await request(app)
      .post(`/api/tickets/${ticket.id}/time-entries`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ minutes: 30 });
    expect(deniedForCustomer.status).toBe(403);

    const entry = await request(app)
      .post(`/api/tickets/${ticket.id}/time-entries`)
      .set('Authorization', `Bearer ${techA.token}`)
      .send({ minutes: 45, note: 'Investigated logs' });
    expect(entry.status).toBe(201);

    const getTicketRes = await request(app).get(`/api/tickets/${ticket.id}`).set('Authorization', `Bearer ${techA.token}`);
    expect(getTicketRes.body.totalMinutesLogged).toBe(45);

    const deniedDelete = await request(app)
      .delete(`/api/tickets/${ticket.id}/time-entries/${entry.body.id}`)
      .set('Authorization', `Bearer ${techB.token}`);
    expect(deniedDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/tickets/${ticket.id}/time-entries/${entry.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(adminDelete.status).toBe(204);
  });
});

describe('CSAT surveys', () => {
  it('is only submittable by the requester once the ticket is closed, exactly once', async () => {
    const customer = await createCustomer(app, 'p1-csat-customer@example.com');
    const staff = await createStaff(app, 'p1-csat-staff@example.com');
    const ticket = await createTicket(customer.token);

    const tooEarly = await request(app)
      .post(`/api/tickets/${ticket.id}/survey`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ rating: 5 });
    expect(tooEarly.status).toBe(400);

    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'resolved' });
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'closed' });

    const wrongUser = await request(app)
      .post(`/api/tickets/${ticket.id}/survey`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ rating: 5 });
    expect(wrongUser.status).toBe(403);

    const submitted = await request(app)
      .post(`/api/tickets/${ticket.id}/survey`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ rating: 4, comment: 'Quick resolution' });
    expect(submitted.status).toBe(200);
    expect(submitted.body.rating).toBe(4);

    const duplicate = await request(app)
      .post(`/api/tickets/${ticket.id}/survey`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ rating: 2 });
    expect(duplicate.status).toBe(400);
  });
});

describe('Bulk ticket actions', () => {
  it('is staff-only and reports per-ticket results without failing the whole batch', async () => {
    const customer = await createCustomer(app, 'p1-bulk-customer@example.com');
    const staff = await createStaff(app, 'p1-bulk-staff@example.com');

    const t1 = await createTicket(customer.token, { subject: 'Bulk 1' });
    const t2 = await createTicket(customer.token, { subject: 'Bulk 2' });

    const denied = await request(app)
      .patch('/api/tickets/bulk/status')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ ticketIds: [t1.id, t2.id], status: 'in_progress' });
    expect(denied.status).toBe(403);

    const bulk = await request(app)
      .patch('/api/tickets/bulk/status')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ ticketIds: [t1.id, t2.id, 999999], status: 'in_progress' });
    expect(bulk.status).toBe(200);
    const results = bulk.body as Array<{ ticketId: number; success: boolean }>;
    expect(results.find((r) => r.ticketId === t1.id)?.success).toBe(true);
    expect(results.find((r) => r.ticketId === t2.id)?.success).toBe(true);
    expect(results.find((r) => r.ticketId === 999999)?.success).toBe(false);
  });
});

describe('Watcher hardening', () => {
  it('lets customers only add/remove themselves, while staff can add anyone', async () => {
    const customer = await createCustomer(app, 'p1-watcher-customer@example.com');
    const otherCustomer = await createCustomer(app, 'p1-watcher-other@example.com');
    const staff = await createStaff(app, 'p1-watcher-staff@example.com');
    const ticket = await createTicket(customer.token);

    const deniedOther = await request(app)
      .post(`/api/tickets/${ticket.id}/watchers`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ userId: otherCustomer.userId });
    expect(deniedOther.status).toBe(403);

    const self = await request(app)
      .post(`/api/tickets/${ticket.id}/watchers`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ userId: customer.userId });
    expect(self.status).toBe(204);

    const staffAddsOther = await request(app)
      .post(`/api/tickets/${ticket.id}/watchers`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ userId: otherCustomer.userId });
    expect(staffAddsOther.status).toBe(204);
  });
});

describe('Saved views', () => {
  it('isolates saved views per user', async () => {
    const userA = await createStaff(app, 'p1-savedview-a@example.com');
    const userB = await createStaff(app, 'p1-savedview-b@example.com');

    const created = await request(app)
      .post('/api/ticket-saved-views')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'My open tickets', filters: { status: 'new' } });
    expect(created.status).toBe(201);

    const listA = await request(app).get('/api/ticket-saved-views').set('Authorization', `Bearer ${userA.token}`);
    expect(listA.body.map((v: { id: string }) => v.id)).toContain(created.body.id);

    const listB = await request(app).get('/api/ticket-saved-views').set('Authorization', `Bearer ${userB.token}`);
    expect(listB.body.map((v: { id: string }) => v.id)).not.toContain(created.body.id);

    const deniedDelete = await request(app)
      .delete(`/api/ticket-saved-views/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deniedDelete.status).toBe(403);
  });
});

describe('Recurring ticket templates', () => {
  it('gates every route (including read) by tickets.manage_recurring and fires due templates on sweep', async () => {
    const staffNoPerm = await createStaff(app, 'p1-recurring-staff-noperm@example.com');
    const manager = await createStaff(app, 'p1-recurring-manager@example.com', { permissions: ['tickets.manage_recurring'] });

    const deniedList = await request(app).get('/api/recurring-ticket-templates').set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(deniedList.status).toBe(403);

    const created = await request(app)
      .post('/api/recurring-ticket-templates')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'p1-Weekly Backup Check',
        subjectTemplate: 'Check backups',
        descriptionTemplate: 'Verify last week’s backup jobs completed',
        priority: 'low',
        recurrenceRule: { type: 'weekly', dayOfWeek: 1 },
        nextRunAt: new Date(Date.now() - 60_000).toISOString(),
      });
    expect(created.status).toBe(201);

    const createdCount = await runDueRecurringTickets();
    expect(createdCount).toBeGreaterThanOrEqual(1);

    const tickets = await request(app).get('/api/tickets').set('Authorization', `Bearer ${manager.token}`);
    expect(tickets.body.some((t: { subject: string }) => t.subject === 'Check backups')).toBe(true);
  });
});

describe('List filtering and sorting', () => {
  it('filters by multiple statuses and multiple priorities at once', async () => {
    const customer = await createCustomer(app, 'p1-multifilter-customer@example.com');
    const staff = await createStaff(app, 'p1-multifilter-staff@example.com');

    const newTicket = await createTicket(customer.token, { subject: 'p1-multifilter new', priority: 'low' });
    const urgentTicket = await createTicket(customer.token, { subject: 'p1-multifilter urgent', priority: 'urgent' });
    const inProgressTicket = await createTicket(customer.token, { subject: 'p1-multifilter in-progress', priority: 'medium' });
    await request(app)
      .patch(`/api/tickets/${urgentTicket.id}/status`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ status: 'waiting' });
    await request(app)
      .patch(`/api/tickets/${inProgressTicket.id}/status`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ status: 'in_progress' });

    const statusFiltered = await request(app)
      .get('/api/tickets')
      .query({ status: 'new,waiting' })
      .set('Authorization', `Bearer ${staff.token}`);
    const statusIds = (statusFiltered.body as Array<{ id: number }>).map((t) => t.id);
    expect(statusIds).toContain(newTicket.id);
    expect(statusIds).toContain(urgentTicket.id);
    expect(statusIds).not.toContain(inProgressTicket.id);

    const priorityFiltered = await request(app)
      .get('/api/tickets')
      .query({ priority: 'low,urgent' })
      .set('Authorization', `Bearer ${staff.token}`);
    const priorityIds = (priorityFiltered.body as Array<{ id: number }>).map((t) => t.id);
    expect(priorityIds).toContain(newTicket.id);
    expect(priorityIds).toContain(urgentTicket.id);
    expect(priorityIds).not.toContain(inProgressTicket.id);
  });

  it('sorts by priority in both directions', async () => {
    const customer = await createCustomer(app, 'p1-sort-customer@example.com');
    const staff = await createStaff(app, 'p1-sort-staff@example.com');
    const low = await createTicket(customer.token, { subject: 'p1-sort low', priority: 'low' });
    const urgent = await createTicket(customer.token, { subject: 'p1-sort urgent', priority: 'urgent' });

    const highToLow = await request(app)
      .get('/api/tickets')
      .query({ sortBy: 'priority', sortDir: 'DESC' })
      .set('Authorization', `Bearer ${staff.token}`);
    const highToLowIds = (highToLow.body as Array<{ id: number }>).map((t) => t.id);
    expect(highToLowIds.indexOf(urgent.id)).toBeLessThan(highToLowIds.indexOf(low.id));

    const lowToHigh = await request(app)
      .get('/api/tickets')
      .query({ sortBy: 'priority', sortDir: 'ASC' })
      .set('Authorization', `Bearer ${staff.token}`);
    const lowToHighIds = (lowToHigh.body as Array<{ id: number }>).map((t) => t.id);
    expect(lowToHighIds.indexOf(low.id)).toBeLessThan(lowToHighIds.indexOf(urgent.id));
  });
});

describe('Attachments on replies', () => {
  it('lets anyone with ticket access attach a file to a specific comment, listed separately from ticket-level attachments', async () => {
    const customer = await createCustomer(app, 'p1-reply-attach-customer@example.com');
    const staff = await createStaff(app, 'p1-reply-attach-staff@example.com');
    const ticket = await createTicket(customer.token);

    const ticketLevel = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set('Authorization', `Bearer ${customer.token}`)
      .attach('file', Buffer.from('ticket level file'), 'ticket-level.txt');
    expect(ticketLevel.status).toBe(201);
    expect(ticketLevel.body.commentId).toBeNull();

    const comment = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ body: 'Here is a screenshot', isInternal: false });
    expect(comment.status).toBe(201);

    const replyAttachment = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set('Authorization', `Bearer ${staff.token}`)
      .field('commentId', comment.body.id)
      .attach('file', Buffer.from('reply screenshot'), 'reply.png');
    expect(replyAttachment.status).toBe(201);
    expect(replyAttachment.body.commentId).toBe(comment.body.id);

    const list = await request(app).get(`/api/tickets/${ticket.id}/attachments`).set('Authorization', `Bearer ${customer.token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.find((a: { commentId: string | null }) => a.commentId === null).fileName).toBe('ticket-level.txt');
    expect(list.body.find((a: { commentId: string | null }) => a.commentId === comment.body.id).fileName).toBe('reply.png');

    const otherCustomer = await createCustomer(app, 'p1-reply-attach-other@example.com');
    const denied = await request(app).get(`/api/tickets/${ticket.id}/attachments`).set('Authorization', `Bearer ${otherCustomer.token}`);
    expect(denied.status).toBe(403);
  });
});
