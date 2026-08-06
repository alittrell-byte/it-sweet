import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { User, UserPermission } from '../../src/db/models';
import { LogEntry } from '../../src/modules/logs/logEntry.model';
import { LogSource } from '../../src/modules/logs/logSource.model';

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

describe('Log ingestion, search, sources, retention', () => {
  it('blocks a technician without logs.view from searching', async () => {
    const staff = await createStaff('logs-no-perm@example.com');
    const res = await request(app).get('/api/logs').set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('blocks source management without logs.manage_sources even with logs.view', async () => {
    const staff = await createStaff('logs-view-only@example.com', ['logs.view']);
    const res = await request(app)
      .post('/api/logs/sources')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Should Fail', type: 'http' });
    expect(res.status).toBe(403);
  });

  describe('with full log permissions', () => {
    let staff: { token: string; userId: string };
    let sourceId: string;
    let apiKey: string;

    beforeAll(async () => {
      staff = await createStaff('logs-full@example.com', ['logs.view', 'logs.manage_sources', 'logs.manage_retention']);
    });

    it('registers a log source and gets back an API key', async () => {
      const res = await request(app)
        .post('/api/logs/sources')
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ name: 'web-server-1', type: 'http' });
      expect(res.status).toBe(201);
      expect(res.body.apiKey).toBeTruthy();
      sourceId = res.body.id;
      apiKey = res.body.apiKey;
    });

    it('rejects ingestion with a missing or invalid API key', async () => {
      const missing = await request(app).post('/api/logs/ingest').send({ message: 'no key' });
      expect(missing.status).toBe(401);

      const invalid = await request(app).post('/api/logs/ingest').set('x-api-key', 'not-a-real-key').send({ message: 'bad key' });
      expect(invalid.status).toBe(401);
    });

    it('ingests a single entry and a batch with a valid API key, no user login required', async () => {
      const single = await request(app)
        .post('/api/logs/ingest')
        .set('x-api-key', apiKey)
        .send({ severity: 'error', message: 'disk usage at 95% on /var', host: '10.0.0.5' });
      expect(single.status).toBe(201);
      expect(single.body.ingested).toBe(1);

      const batch = await request(app)
        .post('/api/logs/ingest')
        .set('x-api-key', apiKey)
        .send({ entries: [{ message: 'entry A' }, { severity: 'warning', message: 'entry B' }] });
      expect(batch.status).toBe(201);
      expect(batch.body.ingested).toBe(2);
    });

    it('finds ingested entries via search, filtered by source/severity/text', async () => {
      const bySource = await request(app)
        .get('/api/logs')
        .query({ sourceId })
        .set('Authorization', `Bearer ${staff.token}`);
      expect(bySource.status).toBe(200);
      expect(bySource.body.total).toBeGreaterThanOrEqual(3);

      const byText = await request(app)
        .get('/api/logs')
        .query({ q: 'disk usage' })
        .set('Authorization', `Bearer ${staff.token}`);
      expect(byText.body.rows.some((r: { message: string }) => r.message.includes('disk usage'))).toBe(true);

      const bySeverity = await request(app)
        .get('/api/logs')
        .query({ severity: 'error' })
        .set('Authorization', `Bearer ${staff.token}`);
      expect(bySeverity.body.rows.every((r: { severity: string }) => r.severity === 'error')).toBe(true);
    });

    it('reflects ingested entries in the dashboard summary', async () => {
      const res = await request(app).get('/api/logs/dashboard').set('Authorization', `Bearer ${staff.token}`);
      expect(res.status).toBe(200);
      expect(res.body.severityBreakdown.error).toBeGreaterThanOrEqual(1);
      expect(res.body.topSources.some((s: { sourceId: string }) => s.sourceId === sourceId)).toBe(true);
    });

    it('purges entries older than the retention window but keeps recent ones', async () => {
      const oldEntry = await LogEntry.create({
        sourceId,
        severity: 'info',
        message: 'ancient entry',
        receivedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      });

      await request(app)
        .patch(`/api/logs/sources/${sourceId}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ retentionDays: 30 });

      const purgeRes = await request(app)
        .post('/api/logs/retention-settings/purge-now')
        .set('Authorization', `Bearer ${staff.token}`);
      expect(purgeRes.status).toBe(200);
      expect(purgeRes.body.deleted).toBeGreaterThanOrEqual(1);

      const stillThere = await LogEntry.findByPk(oldEntry.id);
      expect(stillThere).toBeNull();

      const recentStillThere = await LogEntry.count({ where: { sourceId } });
      expect(recentStillThere).toBeGreaterThan(0);
    });

    it('rotates the API key, invalidating the old one', async () => {
      const rotateRes = await request(app)
        .post(`/api/logs/sources/${sourceId}/rotate-key`)
        .set('Authorization', `Bearer ${staff.token}`);
      expect(rotateRes.status).toBe(200);
      const newKey = rotateRes.body.apiKey;
      expect(newKey).not.toBe(apiKey);

      const withOldKey = await request(app).post('/api/logs/ingest').set('x-api-key', apiKey).send({ message: 'x' });
      expect(withOldKey.status).toBe(401);

      const withNewKey = await request(app).post('/api/logs/ingest').set('x-api-key', newKey).send({ message: 'x' });
      expect(withNewKey.status).toBe(201);
    });
  });

  it('auto-creates an "Unregistered" source for syslog-style ingestion without a pre-registered source', async () => {
    // Simulated the same way the UDP syslog receiver does internally (ingestUnregistered) -
    // exercised here through the service layer since there is no HTTP surface for it.
    const { ingestUnregistered } = await import('../../src/modules/logs/logIngestService');
    await ingestUnregistered({ message: 'unsolicited syslog line', host: '192.168.1.1' });
    const source = await LogSource.findOne({ where: { name: 'Unregistered' } });
    expect(source).not.toBeNull();
  });
});
