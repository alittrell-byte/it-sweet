import { Op } from 'sequelize';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { AccessTokenPayload } from '../auth/authService';
import { User } from '../auth/user.model';
import { RecurringTicketTemplate, RecurrenceRule } from './recurringTicketTemplate.model';
import * as ticketService from './ticketService';

export function listRecurringTemplates(): Promise<RecurringTicketTemplate[]> {
  return RecurringTicketTemplate.findAll({ order: [['name', 'ASC']] });
}

export interface RecurringTemplateInput {
  name: string;
  subjectTemplate: string;
  descriptionTemplate: string;
  category?: string;
  priority?: RecurringTicketTemplate['priority'];
  assigneeId?: string;
  recurrenceRule: RecurrenceRule;
  isActive?: boolean;
  nextRunAt: Date;
}

export async function createRecurringTemplate(input: RecurringTemplateInput, actor: AccessTokenPayload): Promise<RecurringTicketTemplate> {
  return RecurringTicketTemplate.create({
    name: input.name,
    subjectTemplate: input.subjectTemplate,
    descriptionTemplate: input.descriptionTemplate,
    category: input.category ?? null,
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId ?? null,
    recurrenceRule: input.recurrenceRule,
    isActive: input.isActive ?? true,
    nextRunAt: input.nextRunAt,
    createdById: actor.sub,
  });
}

export async function updateRecurringTemplate(id: string, input: Partial<RecurringTemplateInput>): Promise<RecurringTicketTemplate> {
  const template = await RecurringTicketTemplate.findByPk(id);
  if (!template) throw new NotFoundError('Recurring ticket template not found');
  await template.update(input);
  return template;
}

export async function deleteRecurringTemplate(id: string): Promise<void> {
  await RecurringTicketTemplate.destroy({ where: { id } });
}

// UTC-based throughout (not local getDate/setDate) so this is deterministic regardless of the
// host server's timezone - important for a self-hosted app that may run anywhere.
export function computeNextRunAt(rule: RecurrenceRule, from: Date): Date {
  const next = new Date(from);
  if (rule.type === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (rule.type === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (rule.type === 'monthly') {
    const targetDay = rule.dayOfMonth ?? next.getUTCDate();
    // Jump to day 1 before advancing the month - otherwise e.g. Jan 31 + 1 month overflows
    // past February entirely (JS rolls Feb 31 forward into March) instead of landing in Feb.
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDayOfMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(targetDay, lastDayOfMonth));
  } else {
    throw new BadRequestError(`Unknown recurrence type: ${(rule as RecurrenceRule).type}`);
  }
  return next;
}

async function actorForUser(userId: string): Promise<AccessTokenPayload | null> {
  const user = await User.findByPk(userId);
  if (!user || !user.isActive) return null;
  return { sub: user.id, email: user.email, role: user.role, rank: user.rank, isSuperAdmin: user.isSuperAdmin, permissions: [] };
}

/** Creates a ticket for every recurring template whose nextRunAt has passed, then advances it. */
export async function runDueRecurringTickets(now: Date = new Date()): Promise<number> {
  const due = await RecurringTicketTemplate.findAll({ where: { isActive: true, nextRunAt: { [Op.lte]: now } } });
  let created = 0;

  for (const template of due) {
    try {
      const actor = await actorForUser(template.createdById);
      if (!actor) {
        logger.error('Recurring ticket template creator is missing or inactive, skipping', { templateId: template.id });
        continue;
      }
      const ticket = await ticketService.createTicket(
        {
          subject: template.subjectTemplate,
          description: template.descriptionTemplate,
          priority: template.priority,
          category: template.category ?? undefined,
        },
        actor
      );
      if (template.assigneeId) {
        await ticketService.assignTicket(ticket.id, template.assigneeId, actor).catch((err) => {
          logger.error('Failed to auto-assign recurring ticket', { err, templateId: template.id, ticketId: ticket.id });
        });
      }
      await template.update({ lastRunAt: now, nextRunAt: computeNextRunAt(template.recurrenceRule, template.nextRunAt) });
      created += 1;
    } catch (err) {
      logger.error('Failed to create ticket from recurring template', { err, templateId: template.id });
    }
  }

  return created;
}

export class RecurringTicketScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.timer = setInterval(() => {
      runDueRecurringTickets().catch((err) => logger.error('Recurring ticket sweep failed', { err }));
    }, env.RECURRING_TICKET_SWEEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
