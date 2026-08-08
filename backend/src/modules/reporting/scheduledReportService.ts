import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { emailService } from '../../common/email/EmailService';
import { reportEmailTable, scheduledReportEmail } from '../../common/email/templates';
import { NotFoundError } from '../../common/errors';
import { User } from '../auth/user.model';
import { NotificationGroup } from '../notifications/notificationGroup.model';
import { ScheduledReport, ScheduledReportCadence } from './scheduledReport.model';
import { getReportData } from './reportingService';

const CADENCE_MS: Record<ScheduledReportCadence, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

// Day-based, not calendar-aware (no "send every Monday at 9am") - consistent with the earlier
// call in the Ticketing pass that business-hours/calendar precision isn't needed at this stage.
export function isReportDue(cadence: ScheduledReportCadence, lastSentAt: Date | null, now: Date = new Date()): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= CADENCE_MS[cadence];
}

export interface CreateScheduledReportInput {
  name: string;
  reportType: ScheduledReport['reportType'];
  cadence: ScheduledReportCadence;
  notifyGroupId: string;
  isActive?: boolean;
}

export function listScheduledReports(): Promise<ScheduledReport[]> {
  return ScheduledReport.findAll({ order: [['name', 'ASC']] });
}

export function createScheduledReport(input: CreateScheduledReportInput, createdById: string): Promise<ScheduledReport> {
  return ScheduledReport.create({ ...input, createdById });
}

export async function updateScheduledReport(id: string, input: Partial<CreateScheduledReportInput>): Promise<ScheduledReport> {
  const report = await ScheduledReport.findByPk(id);
  if (!report) throw new NotFoundError('Scheduled report not found');
  await report.update(input);
  return report;
}

export async function deleteScheduledReport(id: string): Promise<void> {
  await ScheduledReport.destroy({ where: { id } });
}

async function sendReport(report: ScheduledReport): Promise<void> {
  const group = await NotificationGroup.findByPk(report.notifyGroupId, { include: [{ model: User, as: 'members' }] });
  const recipients = ((group as unknown as { members: User[] } | null)?.members ?? []).map((m) => m.email);
  if (recipients.length === 0) {
    logger.error('Scheduled report has no recipients - notification group is empty', { reportId: report.id });
    return;
  }
  const { rows, columns } = await getReportData(report.reportType);
  const { subject, html } = scheduledReportEmail(report.name, reportEmailTable(rows, columns));
  await emailService.send({ to: recipients, subject, html });
}

export async function evaluateScheduledReports(): Promise<void> {
  const reports = await ScheduledReport.findAll({ where: { isActive: true } });
  for (const report of reports) {
    try {
      if (!isReportDue(report.cadence, report.lastSentAt)) continue;
      await sendReport(report);
      // Stamped after a successful send - a failure below leaves lastSentAt alone so the next
      // sweep retries, same reasoning as the asset/patch compliance alerts.
      await report.update({ lastSentAt: new Date() });
    } catch (err) {
      logger.error('Failed to send scheduled report', { err, reportId: report.id });
    }
  }
}

export class ScheduledReportSweeper {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.timer = setInterval(() => {
      evaluateScheduledReports().catch((err) => logger.error('Scheduled report sweep failed', { err }));
    }, env.REPORT_SWEEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
