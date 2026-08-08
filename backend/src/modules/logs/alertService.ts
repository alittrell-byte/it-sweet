import { Op, col, fn, where as sequelizeWhere } from 'sequelize';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { emailService } from '../../common/email/EmailService';
import { NotFoundError } from '../../common/errors';
import { AccessTokenPayload } from '../auth/authService';
import { User } from '../auth/user.model';
import { NotificationGroup } from '../notifications/notificationGroup.model';
import * as ticketService from '../tickets/ticketService';
import { AlertRule, AlertRuleAttributes } from './alertRule.model';
import { AlertEvent } from './alertEvent.model';
import { LogEntry } from './logEntry.model';

export type CreateAlertRuleInput = Pick<
  AlertRuleAttributes,
  'name' | 'pattern' | 'thresholdCount' | 'thresholdWindowMinutes' | 'createTicket'
> &
  Partial<
    Pick<
      AlertRuleAttributes,
      'sourceId' | 'severityFilter' | 'notifyEmails' | 'notifyGroupId' | 'groupByMetadataField' | 'webhookUrl' | 'isActive'
    >
  >;

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

interface MatchResult {
  count: number;
  sample: string | null;
  /** The matched value of rule.groupByMetadataField, when grouping produced the hit. */
  groupValue?: string;
}

// Rows materialized to group in JS when groupByMetadataField is set - same accepted in-JS-
// aggregation tradeoff already used by logSearchService.getDashboardSummary, bounded since this
// module targets moderate log volumes rather than a dedicated log store.
const GROUPED_MATCH_CAP = 2000;

async function countMatches(rule: AlertRule): Promise<MatchResult> {
  const since = new Date(Date.now() - rule.thresholdWindowMinutes * 60_000);
  const where: Record<string | symbol, unknown> = { receivedAt: { [Op.gte]: since } };
  if (rule.sourceId) where.sourceId = rule.sourceId;
  if (rule.severityFilter) where.severity = rule.severityFilter;
  where[Op.and as unknown as string] = sequelizeWhere(fn('LOWER', col('message')), {
    [Op.like]: `%${rule.pattern.toLowerCase()}%`,
  });

  if (rule.groupByMetadataField) {
    const field = rule.groupByMetadataField;
    const matches = await LogEntry.findAll({ where, order: [['receivedAt', 'DESC']], limit: GROUPED_MATCH_CAP });
    const groups = new Map<string, LogEntry[]>();
    for (const entry of matches) {
      const value = entry.metadata?.[field];
      if (value == null) continue;
      const key = String(value);
      const bucket = groups.get(key);
      if (bucket) bucket.push(entry);
      else groups.set(key, [entry]);
    }
    let best: { key: string; entries: LogEntry[] } | null = null;
    for (const [key, entries] of groups) {
      if (!best || entries.length > best.entries.length) best = { key, entries };
    }
    if (!best) return { count: 0, sample: null };
    return { count: best.entries.length, sample: best.entries[0]?.message ?? null, groupValue: best.key };
  }

  // Real count rather than a capped findAll().length - a rule watching a high-volume pattern
  // should not silently plateau at an arbitrary row limit.
  const count = await LogEntry.count({ where });
  if (count === 0) return { count: 0, sample: null };
  const latest = await LogEntry.findOne({ where, order: [['receivedAt', 'DESC']] });
  return { count, sample: latest?.message ?? null };
}

async function alreadyFiredWithinWindow(rule: AlertRule): Promise<boolean> {
  const since = new Date(Date.now() - rule.thresholdWindowMinutes * 60_000);
  const recent = await AlertEvent.findOne({ where: { ruleId: rule.id, triggeredAt: { [Op.gte]: since } } });
  return !!recent;
}

async function resolveRecipients(rule: AlertRule): Promise<string[]> {
  const recipients = new Set<string>();
  if (rule.notifyEmails) {
    try {
      const emails: string[] = JSON.parse(rule.notifyEmails);
      emails.forEach((e) => recipients.add(e));
    } catch (err) {
      logger.error('Failed to parse alert rule notifyEmails', { err, ruleId: rule.id });
    }
  }
  if (rule.notifyGroupId) {
    try {
      const group = await NotificationGroup.findByPk(rule.notifyGroupId, { include: [{ model: User, as: 'members' }] });
      const members = (group as unknown as { members: User[] } | null)?.members ?? [];
      members.forEach((m) => recipients.add(m.email));
    } catch (err) {
      logger.error('Failed to resolve alert rule notification group', { err, ruleId: rule.id });
    }
  }
  return [...recipients];
}

async function fireAlert(rule: AlertRule, matchCount: number, sample: string, groupValue?: string): Promise<void> {
  let resolvedTicketId: number | null = null;
  const groupContext = groupValue ? ` from ${rule.groupByMetadataField}=${groupValue}` : '';

  const recipients = await resolveRecipients(rule);
  if (recipients.length > 0) {
    try {
      await emailService.send({
        to: recipients,
        subject: `[Alert] ${rule.name} - ${matchCount} matches in ${rule.thresholdWindowMinutes}m${groupValue ? ` (${groupValue})` : ''}`,
        html: `<p><strong>${rule.name}</strong> matched ${matchCount} log entries in the last ${rule.thresholdWindowMinutes} minutes${groupContext}.</p><p>Sample: ${sample}</p>`,
      });
    } catch (err) {
      logger.error('Failed to send alert email', { err, ruleId: rule.id });
    }
  }

  if (rule.webhookUrl) {
    try {
      await fetch(rule.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule: rule.name,
          matchCount,
          windowMinutes: rule.thresholdWindowMinutes,
          sample,
          groupByField: rule.groupByMetadataField,
          groupValue: groupValue ?? null,
        }),
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
          subject: `[Alert] ${rule.name}${groupValue ? ` (${groupValue})` : ''}`,
          description: `Alert rule "${rule.name}" matched ${matchCount} log entries within ${rule.thresholdWindowMinutes} minutes${groupContext}.\n\nSample: ${sample}`,
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
      const { count, sample, groupValue } = await countMatches(rule);
      if (count >= rule.thresholdCount && sample) {
        await fireAlert(rule, count, sample, groupValue);
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
