import { emailService } from '../../common/email/EmailService';
import * as templates from '../../common/email/templates';
import { NotificationGroup } from '../notifications/notificationGroup.model';
import { User } from '../auth/user.model';
import { Ticket, TicketStatus } from './ticket.model';
import { Team } from './team.model';

async function loadTicketWithPeople(ticket: Ticket): Promise<Ticket> {
  return (await Ticket.findByPk(ticket.id, {
    include: [
      { model: User, as: 'requester' },
      { model: User, as: 'assignee' },
      { model: User, as: 'watchers' },
    ],
  })) as Ticket;
}

function uniqueEmails(users: Array<{ email: string } | null | undefined>): string[] {
  return [...new Set(users.filter((u): u is { email: string } => !!u).map((u) => u.email))];
}

export async function notifyTicketCreated(ticket: Ticket): Promise<void> {
  const full = await loadTicketWithPeople(ticket);
  const requester = (full as unknown as { requester: User }).requester;

  const activeGroups = await NotificationGroup.findAll({
    where: { notifyOnNewTicket: true },
    include: [{ model: User, as: 'members' }],
  });
  const groupMembers = activeGroups.flatMap((g) => (g as unknown as { members: User[] }).members);

  const recipients = uniqueEmails([requester, ...groupMembers]);
  if (recipients.length === 0) return;
  const { subject, html } = templates.ticketCreatedEmail(full);
  await emailService.send({ to: recipients, subject, html });
}

export async function notifyTicketAssigned(ticket: Ticket): Promise<void> {
  const full = await loadTicketWithPeople(ticket);
  const assignee = (full as unknown as { assignee: User | null }).assignee;
  if (!assignee) return;
  const { subject, html } = templates.ticketAssignedEmail(full);
  await emailService.send({ to: assignee.email, subject, html });
}

export async function notifyStatusChanged(ticket: Ticket, fromStatus: TicketStatus | null, toStatus: TicketStatus): Promise<void> {
  const full = await loadTicketWithPeople(ticket);
  const requester = (full as unknown as { requester: User }).requester;
  const assignee = (full as unknown as { assignee: User | null }).assignee;
  const watchers = (full as unknown as { watchers: User[] }).watchers ?? [];

  const recipients = uniqueEmails([requester, assignee, ...watchers]);
  if (recipients.length === 0) return;
  const { subject, html } = templates.ticketStatusChangedEmail(full, fromStatus, toStatus);
  await emailService.send({ to: recipients, subject, html });
}

export async function notifyTicketEscalated(ticket: Ticket, _fromTeamId: string | null, toTeamId: string): Promise<void> {
  const team = await Team.findByPk(toTeamId, { include: [{ model: User, as: 'members' }] });
  if (!team) return;
  const members = (team as unknown as { members: User[] }).members ?? [];
  const recipients = uniqueEmails(members);
  if (recipients.length === 0) return;
  const { subject, html } = templates.ticketEscalatedEmail(ticket, team.name);
  await emailService.send({ to: recipients, subject, html });
}

export async function notifyNewComment(ticket: Ticket, isInternal: boolean, authorId: string): Promise<void> {
  const full = await loadTicketWithPeople(ticket);
  const requester = (full as unknown as { requester: User }).requester;
  const assignee = (full as unknown as { assignee: User | null }).assignee;
  const watchers = (full as unknown as { watchers: User[] }).watchers ?? [];

  // Internal notes never reach the requester's inbox, even if they happen to be a watcher.
  const pool = isInternal ? [assignee, ...watchers.filter((w) => w.role !== 'customer')] : [requester, assignee, ...watchers];
  const recipients = uniqueEmails(pool.filter((u) => u?.id !== authorId));
  if (recipients.length === 0) return;
  const { subject, html } = templates.ticketCommentEmail(full, isInternal);
  await emailService.send({ to: recipients, subject, html });
}
