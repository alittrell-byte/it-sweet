import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createCustomer, createStaff } from '../helpers/testUsers';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

async function createAsset(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/assets')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Asset', type: 'hardware', ...overrides });
  return res.body;
}

describe('License seat concurrency', () => {
  it('allows multiple concurrent assignments for a software_license asset', async () => {
    const staff = await createStaff(app, 'p1-license-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.assign'],
    });
    const userA = await createStaff(app, 'p1-license-a@example.com');
    const userB = await createStaff(app, 'p1-license-b@example.com');

    const license = await createAsset(staff.token, { name: 'Adobe CC', type: 'software_license', licenseSeatsPurchased: 3 });

    const first = await request(app)
      .post(`/api/assets/${license.id}/checkout`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assignedToUserId: userA.userId });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/assets/${license.id}/checkout`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assignedToUserId: userB.userId });
    expect(second.status).toBe(201);

    const complianceRes = await request(app).get('/api/assets/license-compliance').set('Authorization', `Bearer ${staff.token}`);
    const row = complianceRes.body.find((r: { assetId: string }) => r.assetId === license.id);
    expect(row.seatsDeployed).toBe(2);
  });

  it('still blocks a second concurrent assignment for hardware (regression check)', async () => {
    const staff = await createStaff(app, 'p1-hw-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.assign'],
    });
    const userA = await createStaff(app, 'p1-hw-a@example.com');
    const userB = await createStaff(app, 'p1-hw-b@example.com');
    const laptop = await createAsset(staff.token, { name: 'Laptop', type: 'hardware' });

    await request(app)
      .post(`/api/assets/${laptop.id}/checkout`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assignedToUserId: userA.userId });

    const blocked = await request(app)
      .post(`/api/assets/${laptop.id}/checkout`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assignedToUserId: userB.userId });
    expect(blocked.status).toBe(400);
  });

  it('checks in by assignment id, closing only that seat and leaving the others active', async () => {
    const staff = await createStaff(app, 'p1-checkin-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.assign'],
    });
    const userA = await createStaff(app, 'p1-checkin-a@example.com');
    const userB = await createStaff(app, 'p1-checkin-b@example.com');
    const license = await createAsset(staff.token, { name: 'Slack', type: 'software_license', licenseSeatsPurchased: 5 });

    const seatA = await request(app)
      .post(`/api/assets/${license.id}/checkout`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assignedToUserId: userA.userId });
    const seatB = await request(app)
      .post(`/api/assets/${license.id}/checkout`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assignedToUserId: userB.userId });

    const checkinA = await request(app)
      .post(`/api/assets/${license.id}/checkin`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assignmentId: seatA.body.id });
    expect(checkinA.status).toBe(200);
    expect(checkinA.body.id).toBe(seatA.body.id);

    // Asset should still be in_use since seat B is still active.
    const assetRes = await request(app).get(`/api/assets/${license.id}`).set('Authorization', `Bearer ${staff.token}`);
    expect(assetRes.body.status).toBe('in_use');

    const historyRes = await request(app).get(`/api/assets/${license.id}/history`).set('Authorization', `Bearer ${staff.token}`);
    const stillActive = historyRes.body.find((h: { id: string }) => h.id === seatB.body.id);
    expect(stillActive.unassignedAt).toBeNull();
  });
});

describe('Vendors and contracts RBAC', () => {
  it('allows any authenticated user to read vendors, but blocks writes without assets.manage_vendors', async () => {
    const customer = await createCustomer(app, 'p1-vendor-reader@example.com');
    const staffNoPerm = await createStaff(app, 'p1-vendor-noperm@example.com', { permissions: ['assets.view'] });

    const readRes = await request(app).get('/api/vendors').set('Authorization', `Bearer ${customer.token}`);
    expect(readRes.status).toBe(200);

    const denied = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${staffNoPerm.token}`)
      .send({ name: 'Dell' });
    expect(denied.status).toBe(403);
  });

  it('creates a vendor, attaches a contract, filters contracts by assetId, and blocks vendor deletion with attached contracts', async () => {
    const manager = await createStaff(app, 'p1-vendor-manager@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.manage_vendors'],
    });

    const vendorRes = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Acme Support Co', contactEmail: 'support@acme.example' });
    expect(vendorRes.status).toBe(201);
    const vendorId = vendorRes.body.id;

    const asset = await createAsset(manager.token, { name: 'Server Rack 1' });

    const contractRes = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ vendorId, assetId: asset.id, type: 'support', endDate: '2030-01-01' });
    expect(contractRes.status).toBe(201);

    const otherAsset = await createAsset(manager.token, { name: 'Server Rack 2' });
    await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ vendorId, assetId: otherAsset.id, type: 'maintenance' });

    const filteredRes = await request(app)
      .get(`/api/contracts?assetId=${asset.id}`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(filteredRes.body).toHaveLength(1);
    expect(filteredRes.body[0].assetId).toBe(asset.id);

    const deleteDenied = await request(app).delete(`/api/vendors/${vendorId}`).set('Authorization', `Bearer ${manager.token}`);
    expect(deleteDenied.status).toBe(400);
    expect(deleteDenied.body.error).toMatch(/contract/i);
  });
});

describe('CSV import vendor resolution', () => {
  it('find-or-creates a Vendor by name on import and reuses it for a second row with the same name', async () => {
    const staff = await createStaff(app, 'p1-csv-vendor-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.import_export'],
    });

    const csv =
      'name,type,vendor\n' + 'CSV Import Widget A,hardware,Contoso Ltd\n' + 'CSV Import Widget B,hardware,Contoso Ltd';

    const importRes = await request(app)
      .post('/api/assets/import')
      .set('Authorization', `Bearer ${staff.token}`)
      .attach('file', Buffer.from(csv), 'assets.csv');
    expect(importRes.status).toBe(200);
    expect(importRes.body.results.every((r: { status: string }) => r.status === 'created')).toBe(true);

    const listRes = await request(app).get('/api/assets').set('Authorization', `Bearer ${staff.token}`);
    const created = listRes.body.filter((a: { name: string }) => a.name.startsWith('CSV Import Widget'));
    expect(created).toHaveLength(2);
    expect(created[0].vendorId).toBeTruthy();
    expect(created[0].vendorId).toBe(created[1].vendorId);

    const vendorsRes = await request(app).get('/api/vendors').set('Authorization', `Bearer ${staff.token}`);
    const contosoVendors = vendorsRes.body.filter((v: { name: string }) => v.name === 'Contoso Ltd');
    expect(contosoVendors).toHaveLength(1);
  });
});

describe('Audit trail', () => {
  it('records create/update/delete actions, skips a no-op update, and survives asset deletion', async () => {
    const staff = await createStaff(app, 'p1-audit-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.edit', 'assets.delete'],
    });
    const asset = await createAsset(staff.token, { name: 'Audit Test Asset', notes: 'initial' });

    const noopUpdate = await request(app)
      .patch(`/api/assets/${asset.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ notes: 'initial' });
    expect(noopUpdate.status).toBe(200);

    const realUpdate = await request(app)
      .patch(`/api/assets/${asset.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ notes: 'updated' });
    expect(realUpdate.status).toBe(200);

    const afterUpdateLog = await request(app).get(`/api/assets/${asset.id}/audit-log`).set('Authorization', `Bearer ${staff.token}`);
    expect(afterUpdateLog.body.map((h: { action: string }) => h.action)).toEqual(['updated', 'created']);
    expect(afterUpdateLog.body[0].changes.notes).toEqual({ from: 'initial', to: 'updated' });

    await request(app).delete(`/api/assets/${asset.id}`).set('Authorization', `Bearer ${staff.token}`);

    const afterDeleteLog = await request(app).get(`/api/assets/${asset.id}/audit-log`).set('Authorization', `Bearer ${staff.token}`);
    expect(afterDeleteLog.status).toBe(200);
    expect(afterDeleteLog.body.map((h: { action: string }) => h.action)).toEqual(['deleted', 'updated', 'created']);
  });
});

describe('Bulk actions', () => {
  it('is blocked without assets.edit / assets.delete', async () => {
    const staff = await createStaff(app, 'p1-asset-bulk-noperm@example.com', { permissions: ['assets.view', 'assets.create'] });
    const asset = await createAsset(staff.token);

    const deniedStatus = await request(app)
      .patch('/api/assets/bulk/status')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assetIds: [asset.id], status: 'retired' });
    expect(deniedStatus.status).toBe(403);

    const deniedDelete = await request(app)
      .delete('/api/assets/bulk')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assetIds: [asset.id] });
    expect(deniedDelete.status).toBe(403);
  });

  it('applies a bulk status change and reports a partial failure without failing the whole batch', async () => {
    const staff = await createStaff(app, 'p1-asset-bulk-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.edit'],
    });
    const assetA = await createAsset(staff.token, { name: 'Bulk A' });
    const assetB = await createAsset(staff.token, { name: 'Bulk B' });
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .patch('/api/assets/bulk/status')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ assetIds: [assetA.id, assetB.id, fakeId], status: 'retired' });
    expect(res.status).toBe(200);
    expect(res.body.filter((r: { success: boolean }) => r.success)).toHaveLength(2);
    expect(res.body.find((r: { assetId: string }) => r.assetId === fakeId).success).toBe(false);

    const checkA = await request(app).get(`/api/assets/${assetA.id}`).set('Authorization', `Bearer ${staff.token}`);
    expect(checkA.body.status).toBe('retired');
  });
});

describe('Procurement: ordered -> receive', () => {
  it('creates an asset as ordered, blocks receiving a non-ordered asset, and receives it correctly', async () => {
    const staff = await createStaff(app, 'p1-receive-staff@example.com', {
      permissions: ['assets.view', 'assets.create', 'assets.edit'],
    });
    const inStockAsset = await createAsset(staff.token, { name: 'Already Available' });
    const blockedReceive = await request(app)
      .post(`/api/assets/${inStockAsset.id}/receive`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(blockedReceive.status).toBe(400);

    const ordered = await createAsset(staff.token, { name: 'On Order Monitor', status: 'ordered' });
    expect(ordered.status).toBe('ordered');
    expect(ordered.purchaseDate).toBeFalsy();

    const receiveRes = await request(app)
      .post(`/api/assets/${ordered.id}/receive`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.status).toBe('available');
    expect(receiveRes.body.purchaseDate).toBeTruthy();

    const auditLog = await request(app).get(`/api/assets/${ordered.id}/audit-log`).set('Authorization', `Bearer ${staff.token}`);
    expect(auditLog.body.map((h: { action: string }) => h.action)).toContain('received');
  });
});

describe('Depreciation report', () => {
  it('computes straight-line current value via the live endpoint', async () => {
    const staff = await createStaff(app, 'p1-depreciation-staff@example.com', {
      permissions: ['assets.view', 'assets.create'],
    });
    const twoYearsAgo = new Date();
    twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 1);
    const purchaseDate = twoYearsAgo.toISOString().slice(0, 10);

    const asset = await createAsset(staff.token, {
      name: 'Depreciating Server',
      purchaseCost: 2400,
      depreciationMethod: 'straight_line',
      usefulLifeMonths: 24,
      purchaseDate,
    });

    const reportRes = await request(app).get('/api/assets/depreciation-report').set('Authorization', `Bearer ${staff.token}`);
    expect(reportRes.status).toBe(200);
    const row = reportRes.body.find((r: { assetId: string }) => r.assetId === asset.id);
    expect(row).toBeTruthy();
    expect(row.currentValue).toBeCloseTo(1200, 0);
    expect(row.accumulatedDepreciation).toBeCloseTo(1200, 0);
  });
});
