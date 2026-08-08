import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/db/sequelize';
import { createStaff } from '../helpers/testUsers';
import { evaluateScheduledReports } from '../../src/modules/reporting/scheduledReportService';
import { ScheduledReport } from '../../src/modules/reporting/scheduledReport.model';

const app = createApp();

afterAll(async () => {
  await sequelize.close();
});

describe('Overview dashboard permission filtering', () => {
  it('only includes sections for modules the actor holds view permission on', async () => {
    const logsOnly = await createStaff(app, 'r-overview-logsonly@example.com', {
      permissions: ['reports.view', 'logs.view'],
    });
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${logsOnly.token}`);
    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
    expect(res.body.tickets).toBeUndefined();
    expect(res.body.assets).toBeUndefined();
    expect(res.body.patches).toBeUndefined();
  });

  it('includes every section for an actor with all view permissions', async () => {
    const fullView = await createStaff(app, 'r-overview-full@example.com', {
      permissions: ['reports.view', 'logs.view', 'tickets.view_dashboard', 'assets.view', 'patches.view'],
    });
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${fullView.token}`);
    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
    expect(res.body.tickets).toBeDefined();
    expect(res.body.assets).toBeDefined();
    expect(res.body.patches).toBeDefined();
  });

  it('includes every section for a super admin even with no explicit permission grants - the isSuperAdmin bypass', async () => {
    const superAdmin = await createStaff(app, 'r-overview-superadmin@example.com', { isSuperAdmin: true, permissions: [] });
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${superAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
    expect(res.body.tickets).toBeDefined();
    expect(res.body.assets).toBeDefined();
    expect(res.body.patches).toBeDefined();
  });

  it('requires reports.view even to reach the overview endpoint at all', async () => {
    const noReportsPerm = await createStaff(app, 'r-overview-noperm@example.com', { permissions: ['assets.view'] });
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${noReportsPerm.token}`);
    expect(res.status).toBe(403);
  });
});

describe('CSV export RBAC - the regression this module was explicitly designed to avoid', () => {
  it('requires assets.view for the license-compliance CSV, not reports.view alone', async () => {
    const reportsViewOnly = await createStaff(app, 'r-csv-reportsonly@example.com', { permissions: ['reports.view'] });
    const denied = await request(app)
      .get('/api/reports/assets/license-compliance.csv')
      .set('Authorization', `Bearer ${reportsViewOnly.token}`);
    expect(denied.status).toBe(403);

    const assetsViewer = await createStaff(app, 'r-csv-assetsviewer@example.com', { permissions: ['assets.view'] });
    const allowed = await request(app)
      .get('/api/reports/assets/license-compliance.csv')
      .set('Authorization', `Bearer ${assetsViewer.token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.text).toMatch(/^License,Purchased,Deployed,Utilization %/);
  });

  it('gates the patch compliance CSV behind patches.view, not assets.view', async () => {
    const assetsViewer = await createStaff(app, 'r-csv-patch-assetsonly@example.com', { permissions: ['assets.view'] });
    const denied = await request(app)
      .get('/api/reports/patches/compliance.csv')
      .set('Authorization', `Bearer ${assetsViewer.token}`);
    expect(denied.status).toBe(403);

    const patchViewer = await createStaff(app, 'r-csv-patch-patchonly@example.com', { permissions: ['patches.view'] });
    const allowed = await request(app)
      .get('/api/reports/patches/compliance.csv')
      .set('Authorization', `Bearer ${patchViewer.token}`);
    expect(allowed.status).toBe(200);
  });
});

describe('KB feedback report', () => {
  it('computes helpful/not-helpful counts and percent correctly', async () => {
    const writer = await createStaff(app, 'r-kb-writer@example.com', { permissions: ['kb.manage_external', 'reports.view'] });
    const voterA = await createStaff(app, 'r-kb-voter-a@example.com', { permissions: [] });
    const voterB = await createStaff(app, 'r-kb-voter-b@example.com', { permissions: [] });

    const articleRes = await request(app)
      .post('/api/kb/articles')
      .set('Authorization', `Bearer ${writer.token}`)
      .send({ title: 'Reporting Feedback Test Article', space: 'external', body: '<p>content</p>' });
    const articleId = articleRes.body.id;

    await request(app)
      .post(`/api/kb/articles/${articleId}/feedback`)
      .set('Authorization', `Bearer ${voterA.token}`)
      .send({ helpful: true });
    await request(app)
      .post(`/api/kb/articles/${articleId}/feedback`)
      .set('Authorization', `Bearer ${voterB.token}`)
      .send({ helpful: false });

    const reportRes = await request(app).get('/api/reports/kb-feedback').set('Authorization', `Bearer ${writer.token}`);
    expect(reportRes.status).toBe(200);
    const row = reportRes.body.find((r: { articleId: string }) => r.articleId === articleId);
    expect(row).toMatchObject({ helpfulCount: 1, notHelpfulCount: 1, helpfulPercent: 50 });
  });
});

describe('Scheduled reports', () => {
  it('gates CRUD behind reports.manage_scheduled but leaves reads open to reports.view', async () => {
    const viewer = await createStaff(app, 'r-sched-viewer@example.com', { permissions: ['reports.view'] });
    const manager = await createStaff(app, 'r-sched-manager@example.com', {
      permissions: ['reports.view', 'reports.manage_scheduled', 'notifications.manage_groups'],
    });

    const groupRes = await request(app)
      .post('/api/notification-groups')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Scheduled Report Test Group', notifyOnNewTicket: false });
    const groupId = groupRes.body.id;
    await request(app)
      .post(`/api/notification-groups/${groupId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: manager.userId });

    const denied = await request(app)
      .post('/api/reports/scheduled-reports')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ name: 'Should be blocked', reportType: 'kb_feedback', cadence: 'daily', notifyGroupId: groupId });
    expect(denied.status).toBe(403);

    const created = await request(app)
      .post('/api/reports/scheduled-reports')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Weekly KB Feedback', reportType: 'kb_feedback', cadence: 'daily', notifyGroupId: groupId });
    expect(created.status).toBe(201);

    const listRes = await request(app).get('/api/reports/scheduled-reports').set('Authorization', `Bearer ${viewer.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((r: { id: string }) => r.id === created.body.id)).toBe(true);

    const deleteDenied = await request(app)
      .delete(`/api/reports/scheduled-reports/${created.body.id}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(deleteDenied.status).toBe(403);
  });

  it('sends once when due, stamps lastSentAt, and stays quiet on the next sweep before the cadence elapses', async () => {
    const manager = await createStaff(app, 'r-sched-sweep-manager@example.com', {
      permissions: ['reports.view', 'reports.manage_scheduled', 'notifications.manage_groups'],
    });
    const groupRes = await request(app)
      .post('/api/notification-groups')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sweep Test Group', notifyOnNewTicket: false });
    const groupId = groupRes.body.id;
    await request(app)
      .post(`/api/notification-groups/${groupId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: manager.userId });

    const created = await request(app)
      .post('/api/reports/scheduled-reports')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sweep Test Report', reportType: 'kb_feedback', cadence: 'daily', notifyGroupId: groupId });
    const reportId = created.body.id;
    expect(created.body.lastSentAt).toBeNull();

    await evaluateScheduledReports();
    let refreshed = await ScheduledReport.findByPk(reportId);
    expect(refreshed!.lastSentAt).not.toBeNull();
    const firstSentAt = refreshed!.lastSentAt;

    await evaluateScheduledReports();
    refreshed = await ScheduledReport.findByPk(reportId);
    expect(refreshed!.lastSentAt!.getTime()).toBe(firstSentAt!.getTime());
  });

  it('does not send an inactive schedule', async () => {
    const manager = await createStaff(app, 'r-sched-inactive-manager@example.com', {
      permissions: ['reports.view', 'reports.manage_scheduled', 'notifications.manage_groups'],
    });
    const groupRes = await request(app)
      .post('/api/notification-groups')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Inactive Schedule Group', notifyOnNewTicket: false });
    const created = await request(app)
      .post('/api/reports/scheduled-reports')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Inactive Report',
        reportType: 'kb_feedback',
        cadence: 'daily',
        notifyGroupId: groupRes.body.id,
        isActive: false,
      });

    await evaluateScheduledReports();
    const refreshed = await ScheduledReport.findByPk(created.body.id);
    expect(refreshed!.lastSentAt).toBeNull();
  });
});
