import { Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { toCsv } from '../../common/csv';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import * as reportingService from './reportingService';
import * as scheduledReportService from './scheduledReportService';

export const reportingRouter = Router();
// Deliberately no router-level requirePermission('reports.view') here (unlike every other
// module's router) - CSV export routes below each require their SOURCE module's own existing
// permission, not a blanket reports permission, so granting reports.view alone can't leak data
// from a module the actor otherwise can't see (see the plan's design decision on this).
reportingRouter.use(authenticate, requireRole('admin', 'technician'));

const REPORTS_VIEW = requirePermission('reports.view');
const MANAGE_SCHEDULED = requirePermission('reports.manage_scheduled');

reportingRouter.get(
  '/overview',
  REPORTS_VIEW,
  asyncHandler(async (req, res) => {
    res.json(await reportingService.getOverviewSummary(req.user!));
  })
);

reportingRouter.get(
  '/kb-feedback',
  REPORTS_VIEW,
  asyncHandler(async (_req, res) => {
    res.json(await reportingService.getKbFeedbackReport());
  })
);

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

reportingRouter.get(
  '/kb-feedback.csv',
  REPORTS_VIEW,
  asyncHandler(async (_req, res) => {
    const { rows, columns } = await reportingService.getReportData('kb_feedback');
    sendCsv(res, 'kb-feedback.csv', toCsv(rows, columns));
  })
);

reportingRouter.get(
  '/tickets/aging.csv',
  requirePermission('tickets.view_dashboard'),
  asyncHandler(async (_req, res) => {
    const { rows, columns } = await reportingService.getReportData('ticket_dashboard');
    sendCsv(res, 'ticket-dashboard.csv', toCsv(rows, columns));
  })
);

reportingRouter.get(
  '/assets/license-compliance.csv',
  requirePermission('assets.view'),
  asyncHandler(async (_req, res) => {
    const { rows, columns } = await reportingService.getReportData('license_compliance');
    sendCsv(res, 'license-compliance.csv', toCsv(rows, columns));
  })
);

reportingRouter.get(
  '/assets/depreciation.csv',
  requirePermission('assets.view'),
  asyncHandler(async (_req, res) => {
    const { rows, columns } = await reportingService.getReportData('depreciation');
    sendCsv(res, 'depreciation.csv', toCsv(rows, columns));
  })
);

reportingRouter.get(
  '/patches/compliance.csv',
  requirePermission('patches.view'),
  asyncHandler(async (_req, res) => {
    const { rows, columns } = await reportingService.getReportData('patch_compliance');
    sendCsv(res, 'patch-compliance.csv', toCsv(rows, columns));
  })
);

reportingRouter.get(
  '/logs/dashboard.csv',
  requirePermission('logs.view'),
  asyncHandler(async (_req, res) => {
    const { rows, columns } = await reportingService.getReportData('log_dashboard');
    sendCsv(res, 'log-dashboard.csv', toCsv(rows, columns));
  })
);

// --- Scheduled reports ---

const scheduledReportSchema = z.object({
  name: z.string().min(1).max(150),
  reportType: z.enum(['ticket_dashboard', 'license_compliance', 'depreciation', 'patch_compliance', 'log_dashboard', 'kb_feedback']),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  notifyGroupId: z.string().uuid(),
  isActive: z.boolean().optional(),
});

reportingRouter.get(
  '/scheduled-reports',
  REPORTS_VIEW,
  asyncHandler(async (_req, res) => {
    res.json(await scheduledReportService.listScheduledReports());
  })
);

reportingRouter.post(
  '/scheduled-reports',
  MANAGE_SCHEDULED,
  asyncHandler(async (req, res) => {
    const input = scheduledReportSchema.parse(req.body);
    res.status(201).json(await scheduledReportService.createScheduledReport(input, req.user!.sub));
  })
);

reportingRouter.patch(
  '/scheduled-reports/:id',
  MANAGE_SCHEDULED,
  asyncHandler(async (req, res) => {
    const input = scheduledReportSchema.partial().parse(req.body);
    res.json(await scheduledReportService.updateScheduledReport(req.params.id, input));
  })
);

reportingRouter.delete(
  '/scheduled-reports/:id',
  MANAGE_SCHEDULED,
  asyncHandler(async (req, res) => {
    await scheduledReportService.deleteScheduledReport(req.params.id);
    res.status(204).send();
  })
);
