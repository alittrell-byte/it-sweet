import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createCustomer, createStaff } from '../helpers/testUsers';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

describe('Canned responses RBAC', () => {
  it('blocks customers entirely, lets any staff read, and gates writes by tickets.manage_canned_responses', async () => {
    const customer = await createCustomer(app, 'cr-customer@example.com');
    const staffNoPerm = await createStaff(app, 'cr-staff-noperm@example.com');
    const manager = await createStaff(app, 'cr-manager@example.com', { permissions: ['tickets.manage_canned_responses'] });

    const customerDenied = await request(app).get('/api/canned-responses').set('Authorization', `Bearer ${customer.token}`);
    expect(customerDenied.status).toBe(403);

    const staffRead = await request(app).get('/api/canned-responses').set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(staffRead.status).toBe(200);

    const createDenied = await request(app)
      .post('/api/canned-responses')
      .set('Authorization', `Bearer ${staffNoPerm.token}`)
      .send({ title: 'Password reset', body: 'Here are the steps...' });
    expect(createDenied.status).toBe(403);

    const created = await request(app)
      .post('/api/canned-responses')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Password reset', body: 'Here are the steps...' });
    expect(created.status).toBe(201);

    const updateDenied = await request(app)
      .put(`/api/canned-responses/${created.body.id}`)
      .set('Authorization', `Bearer ${staffNoPerm.token}`)
      .send({ title: 'Password reset v2', body: 'Updated steps' });
    expect(updateDenied.status).toBe(403);

    const updated = await request(app)
      .put(`/api/canned-responses/${created.body.id}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Password reset v2', body: 'Updated steps' });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Password reset v2');

    const deleteDenied = await request(app)
      .delete(`/api/canned-responses/${created.body.id}`)
      .set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(deleteDenied.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/canned-responses/${created.body.id}`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(deleted.status).toBe(204);
  });
});
