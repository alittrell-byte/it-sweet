import { gunzipSync } from 'zlib';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createCustomer, createStaff } from '../helpers/testUsers';
import { evaluateRulesOnce } from '../../src/modules/logs/alertService';
import { ingestEntry, ingestUnregistered } from '../../src/modules/logs/logIngestService';
import { AlertEvent } from '../../src/modules/logs/alertEvent.model';
import { LogSource } from '../../src/modules/logs/logSource.model';
import { LogEntry } from '../../src/modules/logs/logEntry.model';
import { Team } from '../../src/modules/tickets/team.model';
import { TeamMembership } from '../../src/modules/tickets/teamMembership.model';
import { purgeExpiredEntries } from '../../src/modules/logs/retentionService';
import { storageProvider } from '../../src/common/storage';
import { hashApiKey } from '../../src/common/apiKeys';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

describe('Alert rule correlation (groupByMetadataField)', () => {
  it('fires when N matching events share the same grouped metadata value', async () => {
    const staff = await createStaff(app, 'p1-logs-corr-staff@example.com', { permissions: ['logs.manage_alerts'] });
    const createRes = await request(app)
      .post('/api/logs/alert-rules')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        name: 'Repeated failed logins from one IP',
        pattern: 'failed login corr-marker',
        thresholdCount: 3,
        thresholdWindowMinutes: 5,
        groupByMetadataField: 'sourceIp',
      });
    const ruleId = createRes.body.id;

    // 3 from 10.0.0.1, 2 from 10.0.0.2 - total is 5, but no single IP reaches the threshold of 3
    // ... except 10.0.0.1 does (exactly 3), so this should fire on that group specifically.
    await ingestUnregistered({ message: 'failed login corr-marker a', metadata: { sourceIp: '10.0.0.1' } });
    await ingestUnregistered({ message: 'failed login corr-marker b', metadata: { sourceIp: '10.0.0.1' } });
    await ingestUnregistered({ message: 'failed login corr-marker c', metadata: { sourceIp: '10.0.0.1' } });
    await ingestUnregistered({ message: 'failed login corr-marker d', metadata: { sourceIp: '10.0.0.2' } });
    await ingestUnregistered({ message: 'failed login corr-marker e', metadata: { sourceIp: '10.0.0.2' } });

    await evaluateRulesOnce();
    const events = await AlertEvent.findAll({ where: { ruleId } });
    expect(events).toHaveLength(1);
    expect(events[0].matchCount).toBe(3);
  });

  it('does not fire when the same total count is spread across distinct group values with none crossing threshold', async () => {
    const staff = await createStaff(app, 'p1-logs-nocorr-staff@example.com', { permissions: ['logs.manage_alerts'] });
    const createRes = await request(app)
      .post('/api/logs/alert-rules')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        name: 'Spread out failures',
        pattern: 'failed login spread-marker',
        thresholdCount: 3,
        thresholdWindowMinutes: 5,
        groupByMetadataField: 'sourceIp',
      });
    const ruleId = createRes.body.id;

    // 5 total matches, but spread one-per-IP across 5 distinct IPs - no single group reaches 3.
    for (let i = 0; i < 5; i++) {
      await ingestUnregistered({ message: `failed login spread-marker ${i}`, metadata: { sourceIp: `10.0.1.${i}` } });
    }

    await evaluateRulesOnce();
    const events = await AlertEvent.findAll({ where: { ruleId } });
    expect(events).toHaveLength(0);
  });
});

describe('Per-source RBAC', () => {
  it('hides entries from a team-restricted source from a user outside that team, shows them to a member, and logs.view_all_sources bypasses the restriction', async () => {
    const securityTeam = await Team.create({ name: 'Security Team RBAC Test' });
    const securityMember = await createStaff(app, 'p1-logs-rbac-member@example.com', { permissions: ['logs.view'] });
    const outsider = await createStaff(app, 'p1-logs-rbac-outsider@example.com', { permissions: ['logs.view'] });
    const superviewer = await createStaff(app, 'p1-logs-rbac-superviewer@example.com', {
      permissions: ['logs.view', 'logs.view_all_sources'],
    });
    await TeamMembership.create({ teamId: securityTeam.id, userId: securityMember.userId });

    const source = await LogSource.create({ name: 'Firewall RBAC Test', type: 'http', apiKeyHash: hashApiKey('rbac-test-key'), restrictedToTeamId: securityTeam.id });
    await ingestEntry(source.id, { message: 'restricted rbac-marker entry' });

    const outsiderSearch = await request(app)
      .get('/api/logs?q=rbac-marker')
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(outsiderSearch.body.rows).toHaveLength(0);

    const memberSearch = await request(app)
      .get('/api/logs?q=rbac-marker')
      .set('Authorization', `Bearer ${securityMember.token}`);
    expect(memberSearch.body.rows).toHaveLength(1);

    const superviewerSearch = await request(app)
      .get('/api/logs?q=rbac-marker')
      .set('Authorization', `Bearer ${superviewer.token}`);
    expect(superviewerSearch.body.rows).toHaveLength(1);
  });

  it('still shows unsourced entries (no sourceId) to everyone regardless of team restrictions', async () => {
    const outsider = await createStaff(app, 'p1-logs-rbac-unsourced@example.com', { permissions: ['logs.view'] });
    await ingestUnregistered({ message: 'unsourced rbac-unsourced-marker entry' });

    const res = await request(app).get('/api/logs?q=rbac-unsourced-marker').set('Authorization', `Bearer ${outsider.token}`);
    expect(res.body.rows).toHaveLength(1);
  });
});

describe('Saved searches', () => {
  it('scopes saved searches to their owner - another user cannot see or delete them', async () => {
    const owner = await createStaff(app, 'p1-logs-saved-owner@example.com', { permissions: ['logs.view'] });
    const other = await createStaff(app, 'p1-logs-saved-other@example.com', { permissions: ['logs.view'] });

    const createRes = await request(app)
      .post('/api/logs/saved-searches')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'My Search', filters: { q: 'disk space' } });
    expect(createRes.status).toBe(201);
    const savedId = createRes.body.id;

    const ownerList = await request(app).get('/api/logs/saved-searches').set('Authorization', `Bearer ${owner.token}`);
    expect(ownerList.body.map((s: { id: string }) => s.id)).toContain(savedId);

    const otherList = await request(app).get('/api/logs/saved-searches').set('Authorization', `Bearer ${other.token}`);
    expect(otherList.body.map((s: { id: string }) => s.id)).not.toContain(savedId);

    const deniedDelete = await request(app)
      .delete(`/api/logs/saved-searches/${savedId}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(deniedDelete.status).toBe(403);

    const allowedDelete = await request(app)
      .delete(`/api/logs/saved-searches/${savedId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(allowedDelete.status).toBe(204);
  });
});

describe('Metadata field/value search filter', () => {
  it('finds an entry by an exact metadata field/value match and excludes non-matching values', async () => {
    const staff = await createStaff(app, 'p1-logs-meta-staff@example.com', { permissions: ['logs.view'] });
    await ingestUnregistered({ message: 'meta-marker request handled', metadata: { sourceIp: '9.9.9.9' } });
    await ingestUnregistered({ message: 'meta-marker request handled', metadata: { sourceIp: '1.1.1.1' } });

    const matchRes = await request(app)
      .get('/api/logs?q=meta-marker&metadataField=sourceIp&metadataValue=9.9.9.9')
      .set('Authorization', `Bearer ${staff.token}`);
    expect(matchRes.body.rows).toHaveLength(1);
    expect(matchRes.body.rows[0].metadata.sourceIp).toBe('9.9.9.9');

    const noMatchRes = await request(app)
      .get('/api/logs?q=meta-marker&metadataField=sourceIp&metadataValue=6.6.6.6')
      .set('Authorization', `Bearer ${staff.token}`);
    expect(noMatchRes.body.rows).toHaveLength(0);
  });
});

describe('Archive-before-purge', () => {
  it('writes an archive object to storage before deleting expired entries when the flag is enabled', async () => {
    const staff = await createStaff(app, 'p1-logs-archive-staff@example.com', { permissions: ['logs.view', 'logs.manage_retention'] });
    const source = await LogSource.create({ name: 'Archive Test Source', type: 'http', apiKeyHash: hashApiKey('archive-test-key'), retentionDays: 1 });
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await ingestEntry(source.id, { message: 'archive-marker expiring entry', receivedAt: oldDate });

    const toggleRes = await request(app)
      .patch('/api/logs/retention-settings')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ archiveBeforePurge: true });
    expect(toggleRes.body.archiveBeforePurge).toBe(true);

    await purgeExpiredEntries();

    const remaining = await LogEntry.findOne({ where: { sourceId: source.id } });
    expect(remaining).toBeNull();

    // The archive key is namespaced by source id and a timestamp - just confirm at least one
    // object was written under this source's archive prefix rather than guessing the exact key.
    const archived = await storageProvider.get(`log-archives/${source.id}/${await findArchiveFileSuffix(source.id)}`);
    expect(gunzipSync(archived).toString('utf-8')).toContain('archive-marker expiring entry');

    // Reset the global flag - other test files in this run share the same database/settings
    // row and shouldn't have to account for archiving being left on behind this test.
    await request(app)
      .patch('/api/logs/retention-settings')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ archiveBeforePurge: false });
  });
});

// The archive filename embeds the purge run's timestamp, which the test doesn't control - so
// this walks the local storage directory to find the one file the purge just wrote for this
// source, rather than trying to predict the exact millisecond-precision key.
async function findArchiveFileSuffix(sourceId: string): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const dir = path.join(process.env.STORAGE_LOCAL_DIR!, 'log-archives', sourceId);
  const files = await fs.readdir(dir);
  if (files.length === 0) throw new Error(`No archive files found for source ${sourceId}`);
  return files[0];
}
