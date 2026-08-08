import { Op } from 'sequelize';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { emailService } from '../../common/email/EmailService';
import * as templates from '../../common/email/templates';
import { User } from '../auth/user.model';
import { NotificationGroup } from '../notifications/notificationGroup.model';
import { Asset } from './asset.model';
import { Contract } from './contract.model';
import { Vendor } from './vendor.model';
import { getLicenseCompliance } from './assetService';

const CONTRACT_RENEWAL_WINDOW_DAYS = 30;

function uniqueEmails(users: Array<{ email: string } | null | undefined>): string[] {
  return [...new Set(users.filter((u): u is { email: string } => !!u).map((u) => u.email))];
}

async function notifyGroups(flag: 'notifyOnLicenseOverage' | 'notifyOnContractRenewal', subject: string, html: string): Promise<void> {
  const groups = await NotificationGroup.findAll({ where: { [flag]: true }, include: [{ model: User, as: 'members' }] });
  const recipients = uniqueEmails(groups.flatMap((g) => (g as unknown as { members: User[] }).members));
  if (recipients.length === 0) return;
  await emailService.send({ to: recipients, subject, html });
}

// Edge-triggered on Asset.licenseOverageAlertedAt: fires once when a license first crosses
// over 100% utilization, then stays quiet until it drops back to compliant (clearing the flag)
// so a future re-breach can alert again - avoids paging the same overage every sweep forever.
export async function evaluateLicenseOverage(): Promise<void> {
  const rows = await getLicenseCompliance();
  for (const row of rows) {
    const asset = await Asset.findByPk(row.assetId);
    if (!asset) continue;
    if (row.utilizationPercent > 100) {
      if (!asset.licenseOverageAlertedAt) {
        try {
          const { subject, html } = templates.licenseOverageEmail(row.name, row.seatsPurchased, row.seatsDeployed);
          await notifyGroups('notifyOnLicenseOverage', subject, html);
          // Only stamped on a successful send - if it throws, leave the flag null so the next
          // sweep retries instead of silently giving up on a transient SMTP failure.
          await asset.update({ licenseOverageAlertedAt: new Date() });
        } catch (err) {
          logger.error('Failed to send license overage alert', { err, assetId: row.assetId });
        }
      }
    } else if (asset.licenseOverageAlertedAt) {
      await asset.update({ licenseOverageAlertedAt: null });
    }
  }
}

// Same edge-triggered shape as the license overage check, keyed on Contract.renewalAlertedAt.
export async function evaluateContractRenewals(): Promise<void> {
  const windowEnd = new Date(Date.now() + CONTRACT_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // A NULL end_date never satisfies "<=" in SQL, so open-ended contracts are naturally excluded
  // without needing a separate IS NOT NULL check.
  const dueSoon = await Contract.findAll({
    where: { endDate: { [Op.lte]: windowEnd.toISOString().slice(0, 10) }, renewalAlertedAt: null },
    include: [{ model: Vendor, as: 'vendor' }],
  });
  for (const contract of dueSoon) {
    if (!contract.endDate) continue;
    const vendor = (contract as unknown as { vendor: Vendor | null }).vendor;
    try {
      const { subject, html } = templates.contractRenewalEmail(vendor?.name ?? 'Unknown vendor', contract.type, contract.endDate);
      await notifyGroups('notifyOnContractRenewal', subject, html);
      // Only stamped on a successful send - same retry-on-failure reasoning as the license
      // overage check above.
      await contract.update({ renewalAlertedAt: new Date() });
    } catch (err) {
      logger.error('Failed to send contract renewal alert', { err, contractId: contract.id });
    }
  }
}

export async function evaluateComplianceOnce(): Promise<void> {
  await evaluateLicenseOverage();
  await evaluateContractRenewals();
}

export class AssetComplianceEvaluator {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.timer = setInterval(() => {
      evaluateComplianceOnce().catch((err) => logger.error('Asset compliance sweep failed', { err }));
    }, env.ASSET_COMPLIANCE_SWEEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
