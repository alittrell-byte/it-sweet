import { DashboardSummary as TicketDashboardSummary } from './ticket.model';
import { LogDashboardSummary } from './log.model';
import { LicenseComplianceRow, DepreciationRow } from './asset.model';
import { ComplianceReportRow } from './patch.model';

export interface OverviewSummary {
  tickets?: TicketDashboardSummary;
  assets?: {
    licenseCompliance: LicenseComplianceRow[];
    avgLicenseUtilization: number;
    depreciation: DepreciationRow[];
    totalCurrentValue: number;
  };
  logs?: LogDashboardSummary;
  patches?: {
    complianceReport: ComplianceReportRow[];
    assetsBelowNinetyPercent: number;
  };
}

export interface KbFeedbackReportRow {
  articleId: string;
  title: string;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercent: number;
}

export type ScheduledReportType =
  | 'ticket_dashboard'
  | 'license_compliance'
  | 'depreciation'
  | 'patch_compliance'
  | 'log_dashboard'
  | 'kb_feedback';

export type ScheduledReportCadence = 'daily' | 'weekly' | 'monthly';

export const SCHEDULED_REPORT_TYPES: Array<{ value: ScheduledReportType; label: string }> = [
  { value: 'ticket_dashboard', label: 'Ticket Dashboard' },
  { value: 'license_compliance', label: 'License Compliance' },
  { value: 'depreciation', label: 'Depreciation' },
  { value: 'patch_compliance', label: 'Patch Compliance' },
  { value: 'log_dashboard', label: 'Log Dashboard' },
  { value: 'kb_feedback', label: 'KB Feedback' },
];

export interface ScheduledReport {
  id: string;
  name: string;
  reportType: ScheduledReportType;
  cadence: ScheduledReportCadence;
  notifyGroupId: string;
  lastSentAt: string | null;
  isActive: boolean;
}
