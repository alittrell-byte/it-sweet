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

describe('Assets module', () => {
  it('blocks a technician without assets.view entirely', async () => {
    const staff = await createStaff('assets-no-perm@example.com');
    const res = await request(app).get('/api/assets').set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('blocks asset creation without assets.create even with assets.view', async () => {
    const staff = await createStaff('assets-view-only@example.com', ['assets.view']);
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Test Laptop', type: 'hardware' });
    expect(res.status).toBe(403);
  });

  describe('with full asset permissions', () => {
    let staff: { token: string; userId: string };
    let assetId: string;

    beforeAll(async () => {
      staff = await createStaff('assets-full@example.com', [
        'assets.view',
        'assets.create',
        'assets.edit',
        'assets.delete',
        'assets.assign',
        'assets.import_export',
      ]);
    });

    it('creates an asset with common fields and custom fields', async () => {
      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${staff.token}`)
        .send({
          name: 'ThinkPad X1',
          type: 'hardware',
          serialNumber: 'TP-001',
          vendor: 'Lenovo',
          customFields: { costCenter: 'IT-100' },
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('available');
      expect(res.body.customFields).toEqual({ costCenter: 'IT-100' });
      assetId = res.body.id;
    });

    it('checks the asset out to a user, flipping status to in_use', async () => {
      const requester = await createStaff('assets-recipient1@example.com');
      const res = await request(app)
        .post(`/api/assets/${assetId}/checkout`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ assignedToUserId: requester.userId, dueBackAt: new Date(Date.now() + 86_400_000).toISOString() });
      expect(res.status).toBe(201);

      const assetRes = await request(app).get(`/api/assets/${assetId}`).set('Authorization', `Bearer ${staff.token}`);
      expect(assetRes.body.status).toBe('in_use');
    });

    it('blocks checking out an asset that is already checked out', async () => {
      const otherRequester = await createStaff('assets-recipient2@example.com');
      const res = await request(app)
        .post(`/api/assets/${assetId}/checkout`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ assignedToUserId: otherRequester.userId });
      expect(res.status).toBe(400);
    });

    it('checks the asset back in, flipping status to available and closing the assignment', async () => {
      const res = await request(app).post(`/api/assets/${assetId}/checkin`).set('Authorization', `Bearer ${staff.token}`);
      expect(res.status).toBe(200);
      expect(res.body.unassignedAt).toBeTruthy();

      const assetRes = await request(app).get(`/api/assets/${assetId}`).set('Authorization', `Bearer ${staff.token}`);
      expect(assetRes.body.status).toBe('available');
    });

    it('records both the checkout and check-in in the assignment history, with the assigned-to user joined in', async () => {
      const res = await request(app).get(`/api/assets/${assetId}/history`).set('Authorization', `Bearer ${staff.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].unassignedAt).toBeTruthy();
      expect(res.body[0].assignedToUser?.displayName).toBeTruthy();
      expect(res.body[0].assignedToUser?.passwordHash).toBeUndefined();
    });

    it('allows checking the asset out again after check-in', async () => {
      const requester = await createStaff('assets-recipient3@example.com');
      const res = await request(app)
        .post(`/api/assets/${assetId}/checkout`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ assignedToUserId: requester.userId });
      expect(res.status).toBe(201);
      await request(app).post(`/api/assets/${assetId}/checkin`).set('Authorization', `Bearer ${staff.token}`);
    });

    it('exports assets as CSV including the header row', async () => {
      const res = await request(app).get('/api/assets/export.csv').set('Authorization', `Bearer ${staff.token}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/^name,type,status/);
      expect(res.text).toContain('ThinkPad X1');
    });

    it('deletes the asset', async () => {
      const res = await request(app).delete(`/api/assets/${assetId}`).set('Authorization', `Bearer ${staff.token}`);
      expect(res.status).toBe(204);
      const getRes = await request(app).get(`/api/assets/${assetId}`).set('Authorization', `Bearer ${staff.token}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('license compliance', () => {
    it('reflects purchased vs. currently-deployed seats', async () => {
      const staff = await createStaff('assets-license@example.com', ['assets.view', 'assets.create', 'assets.assign']);
      const createRes = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ name: 'Adobe Creative Cloud', type: 'software_license', licenseSeatsPurchased: 2 });
      const licenseId = createRes.body.id;

      const userA = await createStaff('license-user-a@example.com');

      await request(app)
        .post(`/api/assets/${licenseId}/checkout`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ assignedToUserId: userA.userId });

      let complianceRes = await request(app)
        .get('/api/assets/license-compliance')
        .set('Authorization', `Bearer ${staff.token}`);
      let row = complianceRes.body.find((r: { assetId: string }) => r.assetId === licenseId);
      expect(row.seatsPurchased).toBe(2);
      expect(row.seatsDeployed).toBe(1);
      expect(row.utilizationPercent).toBe(50);

      // A software license models multiple concurrent "seats" as separate assets in this
      // MVP (one assignable row = one seat), so check the first seat back in before
      // showing full compliance would require deploying a second license asset - here we
      // just confirm check-in brings deployed back down to 0.
      await request(app).post(`/api/assets/${licenseId}/checkin`).set('Authorization', `Bearer ${staff.token}`);
      complianceRes = await request(app).get('/api/assets/license-compliance').set('Authorization', `Bearer ${staff.token}`);
      row = complianceRes.body.find((r: { assetId: string }) => r.assetId === licenseId);
      expect(row.seatsDeployed).toBe(0);
      expect(row.utilizationPercent).toBe(0);
    });
  });

  describe('ticket linking', () => {
    it('links an asset to a ticket and shows it on both sides', async () => {
      const staff = await createStaff('assets-linking@example.com', ['assets.view', 'assets.create']);
      const assetRes = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ name: 'Linked Printer', type: 'hardware' });
      const linkAssetId = assetRes.body.id;

      const customerPasswordHash = await bcrypt.hash('Password123!', 10);
      await User.create({
        email: 'assets-linking-customer@example.com',
        displayName: 'Linking Customer',
        role: 'customer',
        passwordHash: customerPasswordHash,
        authSource: 'local',
      });
      const customerLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: 'assets-linking-customer@example.com', password: 'Password123!' });
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerLogin.body.accessToken}`)
        .send({ subject: 'Printer jam', description: 'Paper jam on floor 3 printer', priority: 'low' });
      const ticketId = ticketRes.body.id;

      const linkRes = await request(app)
        .post(`/api/tickets/${ticketId}/assets`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send({ assetId: linkAssetId });
      expect(linkRes.status).toBe(204);

      const ticketDetail = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${staff.token}`);
      expect(ticketDetail.body.linkedAssets.map((a: { id: string }) => a.id)).toContain(linkAssetId);

      const assetTickets = await request(app)
        .get(`/api/assets/${linkAssetId}/tickets`)
        .set('Authorization', `Bearer ${staff.token}`);
      expect(assetTickets.body.map((t: { id: number }) => t.id)).toContain(ticketId);
    });
  });
});
