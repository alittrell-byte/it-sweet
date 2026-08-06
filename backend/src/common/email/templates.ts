import { Ticket } from '../../modules/tickets/ticket.model';

function wrap(title: string, body: string): string {
  return `<div style="font-family:sans-serif;max-width:600px">
    <h2>${title}</h2>
    ${body}
  </div>`;
}

export function ticketCreatedEmail(ticket: Ticket): { subject: string; html: string } {
  return {
    subject: `[Ticket #${ticket.id}] ${ticket.subject}`,
    html: wrap(
      `New ticket #${ticket.id}`,
      `<p><strong>${ticket.subject}</strong></p><p>${ticket.description}</p><p>Priority: ${ticket.priority}</p>`
    ),
  };
}

export function ticketAssignedEmail(ticket: Ticket): { subject: string; html: string } {
  return {
    subject: `[Ticket #${ticket.id}] Assigned to you`,
    html: wrap(`Ticket #${ticket.id} assigned`, `<p><strong>${ticket.subject}</strong> has been assigned to you.</p>`),
  };
}

export function ticketStatusChangedEmail(
  ticket: Ticket,
  fromStatus: string | null,
  toStatus: string
): { subject: string; html: string } {
  return {
    subject: `[Ticket #${ticket.id}] Status changed to ${toStatus}`,
    html: wrap(
      `Ticket #${ticket.id} status updated`,
      `<p><strong>${ticket.subject}</strong> moved from ${fromStatus ?? 'new'} to <strong>${toStatus}</strong>.</p>`
    ),
  };
}

export function ticketCommentEmail(ticket: Ticket, isInternal: boolean): { subject: string; html: string } {
  return {
    subject: `[Ticket #${ticket.id}] New ${isInternal ? 'internal note' : 'reply'}`,
    html: wrap(
      `Ticket #${ticket.id} updated`,
      `<p>A new ${isInternal ? 'internal note' : 'reply'} was added to <strong>${ticket.subject}</strong>.</p>`
    ),
  };
}
