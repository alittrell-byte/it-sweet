import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { User, UserPermission } from '../../src/db/models';

const app = createApp();

async function createUser(email: string, role: 'admin' | 'technician' | 'customer', permissions: string[] = []) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await User.create({ email, displayName: email, role, passwordHash, authSource: 'local' });
  for (const key of permissions) {
    await UserPermission.create({ userId: user.id, permissionKey: key });
  }
  const res = await request(app).post('/api/auth/login').send({ username: email, password: 'Password123!' });
  return { token: res.body.accessToken as string, userId: user.id };
}

afterAll(async () => {
  await sequelize.close();
});

describe('Knowledge base: spaces, permissions, versioning', () => {
  it('blocks creating an article without the matching space-manage permission', async () => {
    const staff = await createUser('kb-no-perm@example.com', 'technician');
    const res = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ title: 'Should fail', space: 'external', body: '<p>hi</p>' });
    expect(res.status).toBe(403);
  });

  it('lets a customer view a published external article but never an internal one', async () => {
    const editor = await createUser('kb-editor1@example.com', 'technician', ['kb.manage_internal', 'kb.manage_external']);
    const externalRes = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'How to reset your password', space: 'external', body: '<p>Click forgot password.</p>' });
    const internalRes = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Internal runbook: VPN outage', space: 'internal', body: '<p>Restart the concentrator.</p>' });

    const customer = await createUser('kb-customer1@example.com', 'customer');

    const getExternal = await request(app)
      .get(`/api/kb/articles/${externalRes.body.id}`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(getExternal.status).toBe(200);

    const getInternal = await request(app)
      .get(`/api/kb/articles/${internalRes.body.id}`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(getInternal.status).toBe(403);

    const listRes = await request(app).get('/api/kb/articles').set('Authorization', `Bearer ${customer.token}`);
    expect(listRes.body.every((a: { space: string }) => a.space === 'external')).toBe(true);
  });

  it('requires kb.view_internal for staff to see internal articles, independent of role', async () => {
    const editor = await createUser('kb-editor2@example.com', 'technician', ['kb.manage_internal']);
    const created = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Firewall rules reference', space: 'internal', body: '<p>...</p>' });

    const staffNoView = await createUser('kb-staff-no-view@example.com', 'technician');
    const blocked = await request(app)
      .get(`/api/kb/articles/${created.body.id}`)
      .set('Authorization', `Bearer ${staffNoView.token}`);
    expect(blocked.status).toBe(403);

    const staffWithView = await createUser('kb-staff-with-view@example.com', 'technician', ['kb.view_internal']);
    const allowed = await request(app)
      .get(`/api/kb/articles/${created.body.id}`)
      .set('Authorization', `Bearer ${staffWithView.token}`);
    expect(allowed.status).toBe(200);
  });

  it('hides unpublished drafts from everyone except staff who can manage that space', async () => {
    const editor = await createUser('kb-editor3@example.com', 'technician', ['kb.manage_external']);
    const draft = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Draft article', space: 'external', body: '<p>wip</p>', isPublished: false });

    const customer = await createUser('kb-customer2@example.com', 'customer');
    const blocked = await request(app)
      .get(`/api/kb/articles/${draft.body.id}`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(blocked.status).toBe(403);

    const ownerView = await request(app)
      .get(`/api/kb/articles/${draft.body.id}`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(ownerView.status).toBe(200);
  });

  it('sanitizes HTML on save and creates a revision on create and on every update, with working restore', async () => {
    const editor = await createUser('kb-editor4@example.com', 'technician', ['kb.manage_external']);
    const created = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Printer setup', space: 'external', body: '<p>Step 1</p><script>evil()</script>' });
    expect(created.body.body).not.toContain('<script>');

    let revisions = await request(app)
      .get(`/api/kb/articles/${created.body.id}/revisions`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(revisions.body).toHaveLength(1);
    const firstRevisionId = revisions.body[0].id;

    await request(app)
      .patch(`/api/kb/articles/${created.body.id}`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ body: '<p>Step 1 updated</p>' });

    revisions = await request(app)
      .get(`/api/kb/articles/${created.body.id}/revisions`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(revisions.body).toHaveLength(2);

    const restoreRes = await request(app)
      .post(`/api/kb/articles/${created.body.id}/revisions/${firstRevisionId}/restore`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.body).toContain('Step 1</p>');
    expect(restoreRes.body.body).not.toContain('updated');

    revisions = await request(app)
      .get(`/api/kb/articles/${created.body.id}/revisions`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(revisions.body).toHaveLength(3); // restore itself is logged as a new revision
  });

  it('uploads and downloads an article attachment, authorized by the same view rules as the article', async () => {
    const editor = await createUser('kb-editor5@example.com', 'technician', ['kb.manage_external']);
    const created = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Diagram article', space: 'external', body: '<p>see below</p>' });

    const uploadRes = await request(app)
      .post(`/api/kb/articles/${created.body.id}/attachments`)
      .set('Authorization', `Bearer ${editor.token}`)
      .attach('file', Buffer.from('fake-png-bytes'), { filename: 'diagram.png', contentType: 'image/png' });
    expect(uploadRes.status).toBe(201);

    const downloadRes = await request(app)
      .get(`/api/kb/articles/${created.body.id}/attachments/${uploadRes.body.id}`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(downloadRes.status).toBe(200);
    // image/png is a binary content type, so superagent buffers it into .body rather than .text.
    expect(Buffer.from(downloadRes.body).toString('utf-8')).toBe('fake-png-bytes');

    // Same download works via the ?token= query fallback, needed for <img> embedding.
    const viaQueryToken = await request(app).get(
      `/api/kb/articles/${created.body.id}/attachments/${uploadRes.body.id}?token=${editor.token}`
    );
    expect(viaQueryToken.status).toBe(200);
  });

  it('links and unlinks an article to a ticket from the ticket side', async () => {
    const editor = await createUser('kb-editor6@example.com', 'technician', ['kb.manage_external']);
    const article = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Canned solution article', space: 'external', body: '<p>fix</p>' });

    const customer = await createUser('kb-customer3@example.com', 'customer');
    const ticketRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ subject: 'Printer broken', description: 'Wont print', priority: 'low' });

    const linkRes = await request(app)
      .post(`/api/tickets/${ticketRes.body.id}/kb-articles`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ articleId: article.body.id });
    expect(linkRes.status).toBe(204);

    const ticketDetail = await request(app)
      .get(`/api/tickets/${ticketRes.body.id}`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(ticketDetail.body.linkedArticles.map((a: { id: string }) => a.id)).toContain(article.body.id);

    const linkedTicketsRes = await request(app)
      .get(`/api/kb/articles/${article.body.id}/tickets`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(linkedTicketsRes.status).toBe(200);
    expect(linkedTicketsRes.body.map((t: { id: number }) => t.id)).toContain(ticketRes.body.id);

    const unlinkRes = await request(app)
      .delete(`/api/tickets/${ticketRes.body.id}/kb-articles/${article.body.id}`)
      .set('Authorization', `Bearer ${editor.token}`);
    expect(unlinkRes.status).toBe(204);
  });

  it('keeps the legacy GET /api/kb search external-only even when a matching internal article exists', async () => {
    const editor = await createUser('kb-editor7@example.com', 'technician', ['kb.manage_internal', 'kb.manage_external']);
    await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Shared keyword external', space: 'external', body: '<p>uniquekeywordxyz</p>' });
    await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Shared keyword internal', space: 'internal', body: '<p>uniquekeywordxyz</p>' });

    const customer = await createUser('kb-customer4@example.com', 'customer');
    const res = await request(app).get('/api/kb').query({ q: 'uniquekeywordxyz' }).set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Shared keyword external');
  });
});

describe('kb.manage -> granular permission migration', () => {
  it('translates an existing kb.manage grant into kb.manage_internal + kb.manage_external and removes the old key', async () => {
    const user = await createUser('kb-migration-user@example.com', 'technician');
    await UserPermission.create({ userId: user.userId, permissionKey: 'kb.manage' });

    const migration = require('../../src/db/migrations/20240101000023-migrate-kb-manage-permission.js');
    await migration.up(sequelize.getQueryInterface());

    const grants = await UserPermission.findAll({ where: { userId: user.userId } });
    const keys = grants.map((g) => g.permissionKey).sort();
    expect(keys).toEqual(['kb.manage_external', 'kb.manage_internal']);
  });

  it('is idempotent - running it twice does not duplicate or error', async () => {
    const migration = require('../../src/db/migrations/20240101000023-migrate-kb-manage-permission.js');
    await expect(migration.up(sequelize.getQueryInterface())).resolves.not.toThrow();
  });
});
