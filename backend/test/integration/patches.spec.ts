import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createStaff } from '../helpers/testUsers';
import { Patch } from '../../src/modules/patches/patch.model';
import { AssetPatchStatus } from '../../src/modules/patches/assetPatchStatus.model';
import { evaluatePatchOverdue } from '../../src/modules/patches/patchComplianceService';
import { Ticket } from '../../src/modules/tickets/ticket.model';
import { User } from '../../src/db/models';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

async function createAsset(token: string, name: string) {
  const res = await request(app)
    .post('/api/assets')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, type: 'hardware' });
  return res.body;
}

async function registerAgentKey(token: string, assetId: string): Promise<string> {
  const res = await request(app)
    .post(`/api/patches/assets/${assetId}/agent-key`)
    .set('Authorization', `Bearer ${token}`);
  return res.body.apiKey;
}

describe('Patch ingest', () => {
  it('rejects an ingest request with a missing or invalid API key', async () => {
    const res = await request(app)
      .post('/api/patches/ingest')
      .send({ scans: [{ platform: 'windows', externalId: 'KB1', title: 'Test', status: 'missing' }] });
    expect(res.status).toBe(401);
  });

  it('find-or-creates a catalog entry by (platform, externalId) and upserts the per-asset status idempotently', async () => {
    const staff = await createStaff(app, 'p-ingest-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.view'],
    });
    const asset = await createAsset(staff.token, 'Ingest Test Asset');
    const apiKey = await registerAgentKey(staff.token, asset.id);

    const first = await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB1001', title: 'Test Patch', status: 'missing' }] });
    expect(first.status).toBe(201);

    const catalogAfterFirst = await Patch.findAll({ where: { platform: 'windows', externalId: 'KB1001' } });
    expect(catalogAfterFirst).toHaveLength(1);
    expect(catalogAfterFirst[0].approvalStatus).toBe('pending');

    // A second scan for the same (platform, externalId) from the same asset should not create a
    // second catalog row or a second status row - it upserts.
    const second = await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB1001', title: 'Test Patch', status: 'installed' }] });
    expect(second.status).toBe(201);

    const catalogAfterSecond = await Patch.findAll({ where: { platform: 'windows', externalId: 'KB1001' } });
    expect(catalogAfterSecond).toHaveLength(1);

    const statuses = await AssetPatchStatus.findAll({ where: { assetId: asset.id, patchId: catalogAfterSecond[0].id } });
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBe('installed');
    expect(statuses[0].missingSinceAt).toBeNull();
  });

  it('sets missingSinceAt on first transition to missing and does not reset it on repeated missing scans', async () => {
    const staff = await createStaff(app, 'p-missing-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.view'],
    });
    const asset = await createAsset(staff.token, 'Missing Since Test Asset');
    const apiKey = await registerAgentKey(staff.token, asset.id);

    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'linux', externalId: 'pkg-1.0', title: 'Pkg', status: 'missing' }] });

    const patch = await Patch.findOne({ where: { platform: 'linux', externalId: 'pkg-1.0' } });
    const firstStatus = await AssetPatchStatus.findOne({ where: { assetId: asset.id, patchId: patch!.id } });
    const firstMissingSinceAt = firstStatus!.missingSinceAt;
    expect(firstMissingSinceAt).not.toBeNull();

    // Backdate it to simulate time passing, then report 'missing' again - the timestamp must not
    // be reset to "now" just because the agent scanned again.
    await firstStatus!.update({ missingSinceAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'linux', externalId: 'pkg-1.0', title: 'Pkg', status: 'missing' }] });

    const secondStatus = await AssetPatchStatus.findOne({ where: { assetId: asset.id, patchId: patch!.id } });
    expect(secondStatus!.missingSinceAt!.getTime()).toBeLessThan(Date.now() - 4 * 24 * 60 * 60 * 1000);
  });
});

describe('Catalog approval', () => {
  it('blocks approval without patches.manage_catalog', async () => {
    const viewer = await createStaff(app, 'p-approve-viewer@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.view'],
    });
    const asset = await createAsset(viewer.token, 'Approval RBAC Asset');
    const apiKey = await registerAgentKey(viewer.token, asset.id);
    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB2002', title: 'RBAC Patch', status: 'missing' }] });
    const patch = await Patch.findOne({ where: { platform: 'windows', externalId: 'KB2002' } });

    const denied = await request(app)
      .patch(`/api/patches/${patch!.id}/approve`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(denied.status).toBe(403);
  });

  it('approves a patch and reflects the approver', async () => {
    const manager = await createStaff(app, 'p-approve-manager@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.manage_catalog', 'patches.view'],
    });
    const asset = await createAsset(manager.token, 'Approve Manager Asset');
    const apiKey = await registerAgentKey(manager.token, asset.id);
    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB3003', title: 'Manager Patch', status: 'missing' }] });
    const patch = await Patch.findOne({ where: { platform: 'windows', externalId: 'KB3003' } });

    const approved = await request(app)
      .patch(`/api/patches/${patch!.id}/approve`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(approved.status).toBe(200);
    expect(approved.body.approvalStatus).toBe('approved');
    expect(approved.body.approvedById).toBe(manager.userId);
  });
});

describe('Compliance report', () => {
  it('excludes pending and declined patches from the math', async () => {
    const staff = await createStaff(app, 'p-compliance-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.manage_catalog', 'patches.view'],
    });
    const asset = await createAsset(staff.token, 'Compliance Report Asset');
    const apiKey = await registerAgentKey(staff.token, asset.id);

    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({
        scans: [
          { platform: 'windows', externalId: 'KB4001', title: 'Approved Installed', status: 'installed' },
          { platform: 'windows', externalId: 'KB4002', title: 'Approved Missing', status: 'missing' },
          { platform: 'windows', externalId: 'KB4003', title: 'Still Pending', status: 'missing' },
        ],
      });

    const approvedInstalled = await Patch.findOne({ where: { platform: 'windows', externalId: 'KB4001' } });
    const approvedMissing = await Patch.findOne({ where: { platform: 'windows', externalId: 'KB4002' } });
    await request(app).patch(`/api/patches/${approvedInstalled!.id}/approve`).set('Authorization', `Bearer ${staff.token}`);
    await request(app).patch(`/api/patches/${approvedMissing!.id}/approve`).set('Authorization', `Bearer ${staff.token}`);
    // KB4003 stays pending - should not count at all.

    const report = await request(app).get('/api/patches/compliance-report').set('Authorization', `Bearer ${staff.token}`);
    const row = report.body.find((r: { assetId: string }) => r.assetId === asset.id);
    expect(row.compliantCount).toBe(1);
    expect(row.missingCount).toBe(1);
    expect(row.compliancePercent).toBe(50);
  });
});

describe('Overdue patch alerting', () => {
  it('fires once when a critical, approved patch has been missing past the SLA, then stays quiet, and clears once installed', async () => {
    const staff = await createStaff(app, 'p-overdue-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.manage_catalog', 'patches.view'],
    });
    const asset = await createAsset(staff.token, 'Overdue Test Asset');
    const apiKey = await registerAgentKey(staff.token, asset.id);

    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({
        scans: [
          { platform: 'windows', externalId: 'KB5001', title: 'Critical Overdue Patch', severity: 'critical', status: 'missing' },
        ],
      });
    const patch = await Patch.findOne({ where: { platform: 'windows', externalId: 'KB5001' } });
    await request(app).patch(`/api/patches/${patch!.id}/approve`).set('Authorization', `Bearer ${staff.token}`);

    const status = await AssetPatchStatus.findOne({ where: { assetId: asset.id, patchId: patch!.id } });
    // Backdate past the default 14-day SLA (env.PATCH_OVERDUE_DAYS).
    await status!.update({ missingSinceAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) });

    await evaluatePatchOverdue();
    let refreshed = await AssetPatchStatus.findByPk(status!.id);
    expect(refreshed!.overdueAlertedAt).not.toBeNull();

    const ticket = await Ticket.findOne({
      where: { subject: `[Patch Overdue] ${asset.name} missing ${patch!.title}` },
      include: [{ model: User, as: 'requester' }],
    });
    expect(ticket).not.toBeNull();
    expect((ticket as unknown as { requester: User }).requester.email).toBe('monitoring-system@internal.local');

    // Re-running the sweep should not fire again while still missing (edge-triggered, not a
    // cooldown re-fire like the log alert rules).
    const alertedAtAfterFirstFire = refreshed!.overdueAlertedAt;
    await evaluatePatchOverdue();
    refreshed = await AssetPatchStatus.findByPk(status!.id);
    expect(refreshed!.overdueAlertedAt!.getTime()).toBe(alertedAtAfterFirstFire!.getTime());

    // Once installed, the flag clears so a future re-breach can alert again.
    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB5001', title: 'Critical Overdue Patch', severity: 'critical', status: 'installed' }] });
    refreshed = await AssetPatchStatus.findByPk(status!.id);
    expect(refreshed!.overdueAlertedAt).toBeNull();
    expect(refreshed!.missingSinceAt).toBeNull();
  });

  it('does not fire for a patch still within the SLA window', async () => {
    const staff = await createStaff(app, 'p-notoverdue-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.manage_catalog', 'patches.view'],
    });
    const asset = await createAsset(staff.token, 'Not Overdue Yet Asset');
    const apiKey = await registerAgentKey(staff.token, asset.id);

    await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', apiKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB6001', title: 'Recent Patch', severity: 'critical', status: 'missing' }] });
    const patch = await Patch.findOne({ where: { platform: 'windows', externalId: 'KB6001' } });
    await request(app).patch(`/api/patches/${patch!.id}/approve`).set('Authorization', `Bearer ${staff.token}`);

    await evaluatePatchOverdue();
    const status = await AssetPatchStatus.findOne({ where: { assetId: asset.id, patchId: patch!.id } });
    expect(status!.overdueAlertedAt).toBeNull();
  });
});

describe('Agent key rotation', () => {
  it('invalidates the old key once rotated', async () => {
    const staff = await createStaff(app, 'p-rotate-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'patches.manage_agents', 'patches.view'],
    });
    const asset = await createAsset(staff.token, 'Rotate Key Asset');
    const oldKey = await registerAgentKey(staff.token, asset.id);

    const rotateRes = await request(app)
      .post(`/api/patches/assets/${asset.id}/agent-key/rotate`)
      .set('Authorization', `Bearer ${staff.token}`);
    const newKey = rotateRes.body.apiKey;
    expect(newKey).not.toBe(oldKey);

    const withOldKey = await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', oldKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB7001', title: 'Rotate Test', status: 'missing' }] });
    expect(withOldKey.status).toBe(401);

    const withNewKey = await request(app)
      .post('/api/patches/ingest')
      .set('x-api-key', newKey)
      .send({ scans: [{ platform: 'windows', externalId: 'KB7001', title: 'Rotate Test', status: 'missing' }] });
    expect(withNewKey.status).toBe(201);
  });
});

describe('Maintenance windows', () => {
  it('gates writes behind patches.manage_windows but leaves reads open to anyone with patches.view', async () => {
    const viewer = await createStaff(app, 'p-window-viewer@example.com', { permissions: ['patches.view'] });
    const manager = await createStaff(app, 'p-window-manager@example.com', {
      permissions: ['patches.view', 'patches.manage_windows'],
    });

    const denied = await request(app)
      .post('/api/patches/maintenance-windows')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ name: 'Should be blocked', startsAt: new Date().toISOString(), endsAt: new Date().toISOString() });
    expect(denied.status).toBe(403);

    const created = await request(app)
      .post('/api/patches/maintenance-windows')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Patch Tuesday',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        recurrence: 'monthly',
      });
    expect(created.status).toBe(201);

    const listRes = await request(app).get('/api/patches/maintenance-windows').set('Authorization', `Bearer ${viewer.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((w: { id: string }) => w.id === created.body.id)).toBe(true);

    const deleteDenied = await request(app)
      .delete(`/api/patches/maintenance-windows/${created.body.id}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(deleteDenied.status).toBe(403);

    const deleteAllowed = await request(app)
      .delete(`/api/patches/maintenance-windows/${created.body.id}`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(deleteAllowed.status).toBe(204);
  });
});
