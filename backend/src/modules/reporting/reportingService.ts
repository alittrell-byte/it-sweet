import { AccessTokenPayload } from '../auth/authService';
import { CsvColumn } from '../../common/csv';
import * as ticketService from '../tickets/ticketService';
import * as assetService from '../assets/assetService';
import * as depreciationService from '../assets/depreciationService';
import * as patchService from '../patches/patchService';
import * as logSearchService from '../logs/logSearchService';
import { getVisibleSourceIds } from '../logs/logAccessControl';
import { KnowledgeBaseArticle } from '../knowledge-base/article.model';
import { KbArticleFeedback } from '../knowledge-base/articleFeedback.model';
import { ScheduledReportType } from './scheduledReport.model';

export interface OverviewSummary {
  tickets?: ticketService.DashboardSummary;
  assets?: {
    licenseCompliance: assetService.LicenseComplianceRow[];
    avgLicenseUtilization: number;
    depreciation: depreciationService.DepreciationRow[];
    totalCurrentValue: number;
  };
  logs?: logSearchService.DashboardSummary;
  patches?: {
    complianceReport: patchService.ComplianceReportRow[];
    assetsBelowNinetyPercent: number;
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

// Aggregates from the five existing per-module report/dashboard functions rather than
// re-querying their underlying models - each section only appears if the actor holds that
// module's own view permission, so someone with reports.view but not e.g. assets.view gets the
// overview without an assets section, not a 403 for the whole page.
export async function getOverviewSummary(actor: AccessTokenPayload): Promise<OverviewSummary> {
  const summary: OverviewSummary = {};

  // isSuperAdmin bypasses every requirePermission(...) check at the route level (see
  // auth/middleware.ts) - a super admin has no need for explicit UserPermission grants, so
  // checking actor.permissions alone here would (and did, until this fix) leave a super admin
  // seeing zero sections despite passing the route's own reports.view gate.
  const has = (key: string): boolean => actor.isSuperAdmin || actor.permissions.includes(key);

  const tasks: Promise<void>[] = [];

  if (has('tickets.view_dashboard')) {
    tasks.push(
      ticketService.getDashboardSummary().then((tickets) => {
        summary.tickets = tickets;
      })
    );
  }

  if (has('assets.view')) {
    tasks.push(
      Promise.all([assetService.getLicenseCompliance(), depreciationService.getDepreciationReport()]).then(
        ([licenseCompliance, depreciation]) => {
          summary.assets = {
            licenseCompliance,
            avgLicenseUtilization: average(licenseCompliance.map((r) => r.utilizationPercent)),
            depreciation,
            totalCurrentValue: Math.round(depreciation.reduce((sum, r) => sum + r.currentValue, 0) * 100) / 100,
          };
        }
      )
    );
  }

  if (has('logs.view')) {
    tasks.push(
      getVisibleSourceIds(actor)
        .then((visibleSourceIds) => logSearchService.getDashboardSummary(visibleSourceIds))
        .then((logs) => {
          summary.logs = logs;
        })
    );
  }

  if (has('patches.view')) {
    tasks.push(
      patchService.getComplianceReport().then((complianceReport) => {
        summary.patches = {
          complianceReport,
          assetsBelowNinetyPercent: complianceReport.filter((r) => r.compliancePercent < 90).length,
        };
      })
    );
  }

  await Promise.all(tasks);
  return summary;
}

export interface KbFeedbackReportRow {
  articleId: string;
  title: string;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercent: number;
}

// No view-count field exists on articles today (would need new instrumentation, out of scope) -
// this reports what's actually derivable from existing feedback data, sorted worst-first since
// that's the actionable view: which articles need work.
export async function getKbFeedbackReport(): Promise<KbFeedbackReportRow[]> {
  const articles = await KnowledgeBaseArticle.findAll({
    include: [{ model: KbArticleFeedback, as: 'feedback', attributes: ['helpful'] }],
    attributes: ['id', 'title'],
  });

  const rows: KbFeedbackReportRow[] = [];
  for (const article of articles) {
    const feedback = (article as unknown as { feedback: KbArticleFeedback[] }).feedback;
    if (feedback.length === 0) continue;
    const helpfulCount = feedback.filter((f) => f.helpful).length;
    const notHelpfulCount = feedback.length - helpfulCount;
    rows.push({
      articleId: article.id,
      title: article.title,
      helpfulCount,
      notHelpfulCount,
      helpfulPercent: Math.round((helpfulCount / feedback.length) * 100),
    });
  }
  return rows.sort((a, b) => a.helpfulPercent - b.helpfulPercent);
}

export interface ReportData {
  rows: Record<string, unknown>[];
  columns: CsvColumn<Record<string, unknown>>[];
}

// Single source of truth for "what does this report type look like as a flat table" - reused for
// both CSV export and scheduled-report emails (design decision 5) rather than a bespoke renderer
// per report type. The two dashboard-shaped reports (ticket_dashboard, log_dashboard) are
// summary objects, not row arrays, so they're flattened to a single row here; the rest are
// already flat arrays from their existing report functions.
export async function getReportData(reportType: ScheduledReportType): Promise<ReportData> {
  switch (reportType) {
    case 'ticket_dashboard': {
      const summary = await ticketService.getDashboardSummary();
      const openTotal = Object.values(summary.openByStatus).reduce((sum, v) => sum + v, 0);
      return {
        rows: [
          {
            openTotal,
            agingCount: summary.agingTickets.length,
            breachedCount: summary.breachedCount,
            avgCsatRating: summary.avgCsatRating ?? 'N/A',
            csatResponseCount: summary.csatResponseCount,
          },
        ],
        columns: [
          { key: 'openTotal', header: 'Open Tickets' },
          { key: 'agingCount', header: 'Aging (3+ days)' },
          { key: 'breachedCount', header: 'SLA Breached' },
          { key: 'avgCsatRating', header: 'Avg CSAT' },
          { key: 'csatResponseCount', header: 'CSAT Responses' },
        ],
      };
    }
    case 'license_compliance': {
      const rows = await assetService.getLicenseCompliance();
      return {
        rows: rows as unknown as Record<string, unknown>[],
        columns: [
          { key: 'name', header: 'License' },
          { key: 'seatsPurchased', header: 'Purchased' },
          { key: 'seatsDeployed', header: 'Deployed' },
          { key: 'utilizationPercent', header: 'Utilization %' },
        ],
      };
    }
    case 'depreciation': {
      const rows = await depreciationService.getDepreciationReport();
      return {
        rows: rows as unknown as Record<string, unknown>[],
        columns: [
          { key: 'name', header: 'Asset' },
          { key: 'purchaseCost', header: 'Purchase Cost' },
          { key: 'currentValue', header: 'Current Value' },
          { key: 'accumulatedDepreciation', header: 'Accumulated Depreciation' },
        ],
      };
    }
    case 'patch_compliance': {
      const rows = await patchService.getComplianceReport();
      return {
        rows: rows as unknown as Record<string, unknown>[],
        columns: [
          { key: 'assetName', header: 'Asset' },
          { key: 'compliantCount', header: 'Compliant' },
          { key: 'missingCount', header: 'Missing' },
          { key: 'failedCount', header: 'Failed' },
          { key: 'compliancePercent', header: 'Compliance %' },
        ],
      };
    }
    case 'log_dashboard': {
      const summary = await logSearchService.getDashboardSummary('all');
      const totalEntries = Object.values(summary.severityBreakdown).reduce((sum, v) => sum + v, 0);
      const errorCount = summary.errorRateByHour.reduce((sum, r) => sum + r.count, 0);
      return {
        rows: [
          {
            totalEntries,
            errorCount,
            topSource: summary.topSources[0]?.name ?? 'N/A',
            topSourceCount: summary.topSources[0]?.count ?? 0,
          },
        ],
        columns: [
          { key: 'totalEntries', header: 'Entries (24h)' },
          { key: 'errorCount', header: 'Errors (24h)' },
          { key: 'topSource', header: 'Top Source' },
          { key: 'topSourceCount', header: 'Top Source Count' },
        ],
      };
    }
    case 'kb_feedback': {
      const rows = await getKbFeedbackReport();
      return {
        rows: rows as unknown as Record<string, unknown>[],
        columns: [
          { key: 'title', header: 'Article' },
          { key: 'helpfulCount', header: 'Helpful' },
          { key: 'notHelpfulCount', header: 'Not Helpful' },
          { key: 'helpfulPercent', header: 'Helpful %' },
        ],
      };
    }
  }
}
