import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { User, UserPermission } from '../../src/db/models';
import { evaluateRulesOnce } from '../../src/modules/logs/alertService';
import { ingestUnregistered } from '../../src/modules/logs/logIngestService';
import { AlertEvent } from '../../src/modules/logs/alertEvent.model';
import { Ticket } from '../../src/modules/tickets/ticket.model';

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

describe('Alert rules and evaluation', () => {
  it('blocks alert-rule management without logs.manage_alerts', async () => {
    const staff = await createStaff('alerts-no-perm@example.com');
    const res = await request(app).get('/api/logs/alert-rules').set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('creates an alert rule and lists it', async () => {
    const staff = await createStaff('alerts-manager1@example.com', ['logs.manage_alerts']);
    const createRes = await request(app)
      .post('/api/logs/alert-rules')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Disk space errors', pattern: 'disk space critical', thresholdCount: 3, thresholdWindowMinutes: 5 });
    expect(createRes.status).toBe(201);

    const listRes = await request(app).get('/api/logs/alert-rules').set('Authorization', `Bearer ${staff.token}`);
    expect(listRes.body.some((r: { id: string }) => r.id === createRes.body.id)).toBe(true);
  });

  it('does not fire below threshold, fires once threshold is crossed, and auto-creates a ticket attributed to Monitoring System', async () => {
    const staff = await createStaff('alerts-manager2@example.com', ['logs.manage_alerts']);
    const createRes = await request(app)
      .post('/api/logs/alert-rules')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        name: 'Auth failures spike',
        pattern: 'auth failure spike marker',
        thresholdCount: 3,
        thresholdWindowMinutes: 5,
        createTicket: true,
      });
    const ruleId = createRes.body.id;

    // Below threshold: two matching entries only.
    await ingestUnregistered({ message: 'auth failure spike marker for user a' });
    await ingestUnregistered({ message: 'auth failure spike marker for user b' });
    await evaluateRulesOnce();
    let events = await AlertEvent.findAll({ where: { ruleId } });
    expect(events).toHaveLength(0);

    // Cross the threshold.
    await ingestUnregistered({ message: 'auth failure spike marker for user c' });
    await evaluateRulesOnce();
    events = await AlertEvent.findAll({ where: { ruleId } });
    expect(events).toHaveLength(1);
    expect(events[0].matchCount).toBeGreaterThanOrEqual(3);
    expect(events[0].resolvedTicketId).toBeTruthy();

    const ticket = await Ticket.findByPk(events[0].resolvedTicketId!, {
      include: [{ model: User, as: 'requester' }],
    });
    expect((ticket as unknown as { requester: User }).requester.email).toBe('monitoring-system@internal.local');

    // Re-running evaluation within the same window should not fire a second time (cooldown).
    await ingestUnregistered({ message: 'auth failure spike marker for user d' });
    await evaluateRulesOnce();
    events = await AlertEvent.findAll({ where: { ruleId } });
    expect(events).toHaveLength(1);
  });

  it('does not fire for an inactive rule', async () => {
    const staff = await createStaff('alerts-manager3@example.com', ['logs.manage_alerts']);
    const createRes = await request(app)
      .post('/api/logs/alert-rules')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Disabled rule', pattern: 'disabled marker', thresholdCount: 1, thresholdWindowMinutes: 5, isActive: false });
    await ingestUnregistered({ message: 'disabled marker present' });
    await evaluateRulesOnce();
    const events = await AlertEvent.findAll({ where: { ruleId: createRes.body.id } });
    expect(events).toHaveLength(0);
  });
});
