import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createCustomer, createStaff } from '../helpers/testUsers';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

async function createArticle(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/kb/articles')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Test article', space: 'internal', body: '<p>content</p>', isPublished: true, ...overrides });
  return res.body;
}

describe('KB article templates', () => {
  it('is readable by any authenticated user but only manageable with kb.manage_templates', async () => {
    const customer = await createCustomer(app, 'kbp1-templates-customer@example.com');
    const staffNoPerm = await createStaff(app, 'kbp1-templates-staff-noperm@example.com');
    const manager = await createStaff(app, 'kbp1-templates-manager@example.com', { permissions: ['kb.manage_templates'] });

    const readRes = await request(app).get('/api/kb/templates').set('Authorization', `Bearer ${customer.token}`);
    expect(readRes.status).toBe(200);

    const denied = await request(app)
      .post('/api/kb/templates')
      .set('Authorization', `Bearer ${staffNoPerm.token}`)
      .send({ name: 'Device Doc', titleTemplate: 'Device: ', bodyTemplate: '<p>IP: </p>' });
    expect(denied.status).toBe(403);

    const created = await request(app)
      .post('/api/kb/templates')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Device Doc', titleTemplate: 'Device: ', bodyTemplate: '<p>IP: </p>', suggestedSpace: 'internal' });
    expect(created.status).toBe(201);

    const manageListDenied = await request(app).get('/api/kb/templates/manage').set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(manageListDenied.status).toBe(403);

    const manageList = await request(app).get('/api/kb/templates/manage').set('Authorization', `Bearer ${manager.token}`);
    expect(manageList.status).toBe(200);
    expect(manageList.body.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    const deleted = await request(app).delete(`/api/kb/templates/${created.body.id}`).set('Authorization', `Bearer ${manager.token}`);
    expect(deleted.status).toBe(204);
  });
});

describe('KB article feedback', () => {
  it('upserts per-user votes, aggregates correctly, and still enforces view permission', async () => {
    const author = await createStaff(app, 'kbp1-feedback-author@example.com', {
      permissions: ['kb.manage_external', 'kb.manage_internal'],
    });
    const viewerA = await createCustomer(app, 'kbp1-feedback-viewerA@example.com');
    const viewerB = await createCustomer(app, 'kbp1-feedback-viewerB@example.com');
    const article = await createArticle(author.token, { space: 'external' });

    const voteA = await request(app)
      .post(`/api/kb/articles/${article.id}/feedback`)
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ helpful: true });
    expect(voteA.status).toBe(204);

    const voteB = await request(app)
      .post(`/api/kb/articles/${article.id}/feedback`)
      .set('Authorization', `Bearer ${viewerB.token}`)
      .send({ helpful: false, comment: 'Outdated screenshots' });
    expect(voteB.status).toBe(204);

    const summary1 = await request(app).get(`/api/kb/articles/${article.id}/feedback`).set('Authorization', `Bearer ${viewerA.token}`);
    expect(summary1.body).toEqual({ helpfulCount: 1, notHelpfulCount: 1, myVote: true });

    // Resubmitting by the same user updates their vote rather than creating a duplicate row.
    const resubmit = await request(app)
      .post(`/api/kb/articles/${article.id}/feedback`)
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ helpful: false });
    expect(resubmit.status).toBe(204);

    const summary2 = await request(app).get(`/api/kb/articles/${article.id}/feedback`).set('Authorization', `Bearer ${viewerA.token}`);
    expect(summary2.body).toEqual({ helpfulCount: 0, notHelpfulCount: 2, myVote: false });

    const internalArticle = await createArticle(author.token, { space: 'internal' });
    const blockedVote = await request(app)
      .post(`/api/kb/articles/${internalArticle.id}/feedback`)
      .set('Authorization', `Bearer ${viewerA.token}`)
      .send({ helpful: true });
    expect(blockedVote.status).toBe(403);
  });
});

describe('KB draft/review/publish workflow', () => {
  it('routes an article through submit-for-review -> approve, and gates review actions by kb.review_<space>', async () => {
    const author = await createStaff(app, 'kbp1-review-author@example.com', {
      permissions: ['kb.manage_internal', 'kb.view_internal'],
    });
    const staffNoPerm = await createStaff(app, 'kbp1-review-staff-noperm@example.com');
    const reviewer = await createStaff(app, 'kbp1-review-reviewer@example.com', { permissions: ['kb.review_internal'] });

    const article = await createArticle(author.token, { space: 'internal', isPublished: false });
    expect(article.reviewStatus).toBe('none');

    const submitted = await request(app)
      .patch(`/api/kb/articles/${article.id}/submit-for-review`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.reviewStatus).toBe('pending_review');

    const deniedApprove = await request(app)
      .patch(`/api/kb/articles/${article.id}/approve`)
      .set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(deniedApprove.status).toBe(403);

    const approved = await request(app).patch(`/api/kb/articles/${article.id}/approve`).set('Authorization', `Bearer ${reviewer.token}`);
    expect(approved.status).toBe(200);
    expect(approved.body.reviewStatus).toBe('approved');
    expect(approved.body.isPublished).toBe(true);

    const revisions = await request(app)
      .get(`/api/kb/articles/${article.id}/revisions`)
      .set('Authorization', `Bearer ${author.token}`);
    // create (1) + approve's snapshot (1) = 2
    expect(revisions.body.length).toBe(2);
  });

  it('supports a request-changes -> resubmit -> approve cycle and records the reviewer note', async () => {
    const author = await createStaff(app, 'kbp1-changes-author@example.com', { permissions: ['kb.manage_external'] });
    const reviewer = await createStaff(app, 'kbp1-changes-reviewer@example.com', { permissions: ['kb.review_external'] });
    const article = await createArticle(author.token, { space: 'external', isPublished: false });

    await request(app).patch(`/api/kb/articles/${article.id}/submit-for-review`).set('Authorization', `Bearer ${author.token}`);

    const changesRequested = await request(app)
      .patch(`/api/kb/articles/${article.id}/request-changes`)
      .set('Authorization', `Bearer ${reviewer.token}`)
      .send({ note: 'Please add a screenshot' });
    expect(changesRequested.status).toBe(200);
    expect(changesRequested.body.reviewStatus).toBe('changes_requested');
    expect(changesRequested.body.reviewNote).toBe('Please add a screenshot');
    expect(changesRequested.body.isPublished).toBe(false);

    const notPending = await request(app)
      .patch(`/api/kb/articles/${article.id}/approve`)
      .set('Authorization', `Bearer ${reviewer.token}`);
    expect(notPending.status).toBe(400);

    await request(app).patch(`/api/kb/articles/${article.id}/submit-for-review`).set('Authorization', `Bearer ${author.token}`);
    const approved = await request(app).patch(`/api/kb/articles/${article.id}/approve`).set('Authorization', `Bearer ${reviewer.token}`);
    expect(approved.status).toBe(200);
    expect(approved.body.isPublished).toBe(true);
  });
});

describe('listArticles draft visibility fix', () => {
  it('lets a space manager see their own unpublished drafts via includeUnpublished, but never leaks them to customers', async () => {
    const manager = await createStaff(app, 'kbp1-listfix-manager@example.com', { permissions: ['kb.manage_internal', 'kb.view_internal'] });
    const staffNoPerm = await createStaff(app, 'kbp1-listfix-staff-noperm@example.com', { permissions: ['kb.view_internal'] });
    const customer = await createCustomer(app, 'kbp1-listfix-customer@example.com');

    const draft = await createArticle(manager.token, {
      title: 'kbp1-listfix draft article',
      space: 'internal',
      isPublished: false,
    });

    const withoutFlag = await request(app)
      .get('/api/kb/articles')
      .query({ space: 'internal' })
      .set('Authorization', `Bearer ${manager.token}`);
    expect(withoutFlag.body.some((a: { id: string }) => a.id === draft.id)).toBe(false);

    const withFlag = await request(app)
      .get('/api/kb/articles')
      .query({ space: 'internal', includeUnpublished: 'true' })
      .set('Authorization', `Bearer ${manager.token}`);
    expect(withFlag.body.some((a: { id: string }) => a.id === draft.id)).toBe(true);

    // Holding kb.view_internal (read) but not kb.manage_internal (write) is not enough to see drafts.
    const staffFlag = await request(app)
      .get('/api/kb/articles')
      .query({ space: 'internal', includeUnpublished: 'true' })
      .set('Authorization', `Bearer ${staffNoPerm.token}`);
    expect(staffFlag.body.some((a: { id: string }) => a.id === draft.id)).toBe(false);

    const customerFlag = await request(app)
      .get('/api/kb/articles')
      .query({ space: 'external', includeUnpublished: 'true' })
      .set('Authorization', `Bearer ${customer.token}`);
    expect(customerFlag.status).toBe(200);
    expect(customerFlag.body.some((a: { id: string }) => a.id === draft.id)).toBe(false);
  });
});

describe('KB category delete-safety and editing', () => {
  it('blocks deleting a category that still has an article attached, and explains why', async () => {
    const manager = await createStaff(app, 'kbp1-catdelete-manager@example.com', {
      permissions: ['kb.manage_categories', 'kb.manage_internal'],
    });

    const category = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catdelete Hardware' });
    expect(category.status).toBe(201);

    await createArticle(manager.token, { categoryId: category.body.id });

    const blocked = await request(app).delete(`/api/kb/categories/${category.body.id}`).set('Authorization', `Bearer ${manager.token}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toContain('1 article');
  });

  it('blocks deleting a category that still has a child category, and explains why', async () => {
    const manager = await createStaff(app, 'kbp1-catdelete2-manager@example.com', { permissions: ['kb.manage_categories'] });

    const parent = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catdelete2 Parent' });
    await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catdelete2 Child', parentId: parent.body.id });

    const blocked = await request(app).delete(`/api/kb/categories/${parent.body.id}`).set('Authorization', `Bearer ${manager.token}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toContain('1 subcategory');
  });

  it('allows deleting a category once it has no articles or children, and supports renaming/reparenting', async () => {
    const manager = await createStaff(app, 'kbp1-catedit-manager@example.com', { permissions: ['kb.manage_categories'] });

    const empty = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catedit Empty' });
    const deleted = await request(app).delete(`/api/kb/categories/${empty.body.id}`).set('Authorization', `Bearer ${manager.token}`);
    expect(deleted.status).toBe(204);

    const renamed = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catedit Original Name' });
    const update = await request(app)
      .patch(`/api/kb/categories/${renamed.body.id}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catedit Renamed' });
    expect(update.status).toBe(200);
    expect(update.body.name).toBe('kbp1-catedit Renamed');
  });
});

describe('KB category filter includes descendant categories', () => {
  it('filtering by a parent category also returns articles filed under its subcategories', async () => {
    const manager = await createStaff(app, 'kbp1-catsearch-manager@example.com', {
      permissions: ['kb.manage_categories', 'kb.manage_internal', 'kb.view_internal'],
    });

    const parent = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catsearch Hardware' });
    const child = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catsearch Replacing GPU', parentId: parent.body.id });
    const grandchild = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catsearch GPU Drivers', parentId: child.body.id });
    const unrelated = await request(app)
      .post('/api/kb/categories')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'kbp1-catsearch Software' });

    const parentArticle = await createArticle(manager.token, { title: 'kbp1-catsearch parent article', categoryId: parent.body.id });
    const childArticle = await createArticle(manager.token, { title: 'kbp1-catsearch child article', categoryId: child.body.id });
    const grandchildArticle = await createArticle(manager.token, {
      title: 'kbp1-catsearch grandchild article',
      categoryId: grandchild.body.id,
    });
    const unrelatedArticle = await createArticle(manager.token, {
      title: 'kbp1-catsearch unrelated article',
      categoryId: unrelated.body.id,
    });

    const filtered = await request(app)
      .get('/api/kb/articles')
      .query({ categoryId: parent.body.id })
      .set('Authorization', `Bearer ${manager.token}`);
    expect(filtered.status).toBe(200);
    const ids = (filtered.body as Array<{ id: string }>).map((a) => a.id);
    expect(ids).toContain(parentArticle.id);
    expect(ids).toContain(childArticle.id);
    expect(ids).toContain(grandchildArticle.id);
    expect(ids).not.toContain(unrelatedArticle.id);
  });
});
