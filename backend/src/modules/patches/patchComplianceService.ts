import { Op } from 'sequelize';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { emailService } from '../../common/email/EmailService';
import * as templates from '../../common/email/templates';
import { AccessTokenPayload } from '../auth/authService';
import { User } from '../auth/user.model';
import { NotificationGroup } from '../notifications/notificationGroup.model';
import { Asset } from '../assets/asset.model';
import * as ticketService from '../tickets/ticketService';
import { Patch } from './patch.model';
import { AssetPatchStatus } from './assetPatchStatus.model';

const MONITORING_SYSTEM_EMAIL = 'monitoring-system@internal.local';

// Same self-healing find-or-create as alertService.getMonitoringSystemActor - the seeder
// normally provisions this account, but a fresh/reset schema shouldn't hard-block alerting.
async function getMonitoringSystemActor(): Promise<AccessTokenPayload> {
  const [user] = await User.findOrCreate({
    where: { email: MONITORING_SYSTEM_EMAIL },
    defaults: {
      email: MONITORING_SYSTEM_EMAIL,
      displayName: 'Monitoring System',
      role: 'technician',
      passwordHash: null,
      authSource: 'local',
    },
  });
  return { sub: user.id, email: user.email, role: user.role, rank: user.rank, isSuperAdmin: user.isSuperAdmin, permissions: [] };
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

async function notifyGroups(subject: string, html: string): Promise<void> {
  const groups = await NotificationGroup.findAll({ where: { notifyOnPatchOverdue: true }, include: [{ model: User, as: 'members' }] });
  const recipients = [
    ...new Set(groups.flatMap((g) => (g as unknown as { members: User[] }).members).map((m) => m.email)),
  ];
  if (recipients.length === 0) return;
  await emailService.send({ to: recipients, subject, html });
}

// Edge-triggered on AssetPatchStatus.overdueAlertedAt, same shape as
// complianceAlertService.evaluateLicenseOverage: fires once when a critical, approved patch has
// been missing (per missingSinceAt, not lastCheckedAt - see assetPatchStatus.model.ts) past the
// SLA, then stays quiet until it clears (installed, or the patch gets declined) so a future
// re-breach can alert again.
export async function evaluatePatchOverdue(): Promise<void> {
  const cutoff = new Date(Date.now() - env.PATCH_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
  const overdue = await AssetPatchStatus.findAll({
    where: { status: 'missing', overdueAlertedAt: null, missingSinceAt: { [Op.ne]: null, [Op.lte]: cutoff } },
    include: [
      { model: Patch, as: 'patch', where: { severity: 'critical', approvalStatus: 'approved' } },
      { model: Asset, as: 'asset' },
    ],
  });

  for (const status of overdue) {
    const patch = (status as unknown as { patch: Patch }).patch;
    const asset = (status as unknown as { asset: Asset }).asset;
    const daysMissing = daysSince(status.missingSinceAt!);
    try {
      const { subject, html } = templates.patchOverdueEmail(asset.name, patch.title, daysMissing);
      await notifyGroups(subject, html);
      try {
        const actor = await getMonitoringSystemActor();
        await ticketService.createTicket(
          {
            subject: `[Patch Overdue] ${asset.name} missing ${patch.title}`,
            description: `${asset.name} has been missing the critical patch "${patch.title}" for ${daysMissing} days, past the ${env.PATCH_OVERDUE_DAYS}-day SLA.`,
            priority: 'high',
            category: 'patch_management',
          },
          actor
        );
      } catch (err) {
        logger.error('Failed to auto-create ticket for overdue patch', { err, assetPatchStatusId: status.id });
      }
      // Only stamped on a successful notify path reaching this point - if it throws above, leave
      // the flag null so the next sweep retries instead of silently giving up.
      await status.update({ overdueAlertedAt: new Date() });
    } catch (err) {
      logger.error('Failed to send patch overdue alert', { err, assetPatchStatusId: status.id });
    }
  }
}

export class PatchComplianceEvaluator {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.timer = setInterval(() => {
      evaluatePatchOverdue().catch((err) => logger.error('Patch compliance sweep failed', { err }));
    }, env.PATCH_COMPLIANCE_SWEEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
