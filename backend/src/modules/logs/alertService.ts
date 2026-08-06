import { Op, col, fn, where as sequelizeWhere } from 'sequelize';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { emailService } from '../../common/email/EmailService';
import { NotFoundError } from '../../common/errors';
import { AccessTokenPayload } from '../auth/authService';
import { User } from '../auth/user.model';
import * as ticketService from '../tickets/ticketService';
import { AlertRule, AlertRuleAttributes } from './alertRule.model';
import { AlertEvent } from './alertEvent.model';
import { LogEntry } from './logEntry.model';

export type CreateAlertRuleInput = Pick<
  AlertRuleAttributes,
  'name' | 'pattern' | 'thresholdCount' | 'thresholdWindowMinutes' | 'createTicket'
> &
  Partial<Pick<AlertRuleAttributes, 'sourceId' | 'severityFilter' | 'notifyEmails' | 'webhookUrl' | 'isActive'>>;

export async function listAlertRules(): Promise<AlertRule[]> {
  return AlertRule.findAll({ order: [['name', 'ASC']] });
}

export async function createAlertRule(input: CreateAlertRuleInput, actor: AccessTokenPayload): Promise<AlertRule> {
  return AlertRule.create({ ...input, createdById: actor.sub });
}

export async function updateAlertRule(id: string, input: Partial<CreateAlertRuleInput>): Promise<AlertRule> {
  const rule = await AlertRule.findByPk(id);
  if (!rule) throw new NotFoundError('Alert rule not found');
  await rule.update(input);
  return rule;
}

export async function deleteAlertRule(id: string): Promise<void> {
  await AlertRule.destroy({ where: { id } });
}

export async function listAlertEvents(ruleId?: string): Promise<AlertEvent[]> {
  return AlertEvent.findAll({ where: ruleId ? { ruleId } : {}, order: [['triggeredAt', 'DESC']], limit: 100 });
}

const MONITORING_SYSTEM_EMAIL = 'monitoring-system@internal.local';

// The seed data normally provisions this account (backend/src/db/seeders/20240101000001-default-data.js),
// but find-or-create here too so alerting is self-healing rather than hard-depending on the
// seeder having run - e.g. deployments that reset their schema without re-seeding.
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

async function countMatches(rule: AlertRule): Promise<{ count: number; sample: string | null }> {
  const since = new Date(Date.now() - rule.thresholdWindowMinutes * 60_000);
  const where: Record<string | symbol, unknown> = { receivedAt: { [Op.gte]: since } };
  if (rule.sourceId) where.sourceId = rule.sourceId;
  if (rule.severityFilter) where.severity = rule.severityFilter;
  where[Op.and as unknown as string] = sequelizeWhere(fn('LOWER', col('message')), {
    [Op.like]: `%${rule.pattern.toLowerCase()}%`,
  });

  const matches = await LogEntry.findAll({ where, order: [['receivedAt', 'DESC']], limit: 1000 });
  return { count: matches.length, sample: matches[0]?.message ?? null };
}

async function alreadyFiredWithinWindow(rule: AlertRule): Promise<boolean> {
  const since = new Date(Date.now() - rule.thresholdWindowMinutes * 60_000);
  const recent = await AlertEvent.findOne({ where: { ruleId: rule.id, triggeredAt: { [Op.gte]: since } } });
  return !!recent;
}

async function fireAlert(rule: AlertRule, matchCount: number, sample: string): Promise<void> {
  let resolvedTicketId: number | null = null;

  if (rule.notifyEmails) {
    try {
      const recipients: string[] = JSON.parse(rule.notifyEmails);
      if (recipients.length > 0) {
        await emailService.send({
          to: recipients,
          subject: `[Alert] ${rule.name} - ${matchCount} matches in ${rule.thresholdWindowMinutes}m`,
          html: `<p><strong>${rule.name}</strong> matched ${matchCount} log entries in the last ${rule.thresholdWindowMinutes} minutes.</p><p>Sample: ${sample}</p>`,
        });
      }
    } catch (err) {
      logger.error('Failed to send alert email', { err, ruleId: rule.id });
    }
  }

  if (rule.webhookUrl) {
    try {
      await fetch(rule.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: rule.name, matchCount, windowMinutes: rule.thresholdWindowMinutes, sample }),
      });
    } catch (err) {
      logger.error('Failed to call alert webhook', { err, ruleId: rule.id });
    }
  }

  if (rule.createTicket) {
    try {
      const actor = await getMonitoringSystemActor();
      const ticket = await ticketService.createTicket(
        {
          subject: `[Alert] ${rule.name}`,
          description: `Alert rule "${rule.name}" matched ${matchCount} log entries within ${rule.thresholdWindowMinutes} minutes.\n\nSample: ${sample}`,
          priority: 'high',
          category: 'monitoring',
        },
        actor
      );
      resolvedTicketId = ticket.id;
    } catch (err) {
      logger.error('Failed to auto-create ticket for alert', { err, ruleId: rule.id });
    }
  }

  await AlertEvent.create({ ruleId: rule.id, matchCount, sampleMessage: sample, resolvedTicketId });
}

export async function evaluateRulesOnce(): Promise<void> {
  const rules = await AlertRule.findAll({ where: { isActive: true } });
  for (const rule of rules) {
    try {
      if (await alreadyFiredWithinWindow(rule)) continue;
      const { count, sample } = await countMatches(rule);
      if (count >= rule.thresholdCount && sample) {
        await fireAlert(rule, count, sample);
      }
    } catch (err) {
      logger.error('Alert rule evaluation failed', { err, ruleId: rule.id });
    }
  }
}

export class AlertEvaluator {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.timer = setInterval(() => {
      evaluateRulesOnce().catch((err) => logger.error('Alert evaluation cycle failed', { err }));
    }, env.ALERT_EVALUATION_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
