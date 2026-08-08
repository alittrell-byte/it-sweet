import { Ticket } from '../../modules/tickets/ticket.model';
import { CsvColumn } from '../csv';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Reused for every scheduled-report email regardless of report type - each curated report is
// either a flat array of flat objects, or (for the dashboard-shaped reports) a single summary
// object the caller flattens to one row first. Same column spec shape as common/csv.ts's toCsv,
// so a report's column list can be defined once and used for both CSV export and this.
export function reportEmailTable<T extends Record<string, unknown>>(rows: T[], columns: CsvColumn<T>[]): string {
  if (rows.length === 0) return '<p>No data for this report.</p>';
  const headerRow = columns.map((col) => `<th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc">${escapeHtml(col.header)}</th>`).join('');
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${columns.map((col) => `<td style="padding:4px 8px;border-bottom:1px solid #eee">${escapeHtml(row[col.key])}</td>`).join('')}</tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;font-size:14px"><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

export function scheduledReportEmail(name: string, tableHtml: string): { subject: string; html: string } {
  return {
    subject: `[Report] ${name}`,
    html: wrap(name, tableHtml),
  };
}

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

export function ticketEscalatedEmail(ticket: Ticket, teamName: string): { subject: string; html: string } {
  return {
    subject: `[Ticket #${ticket.id}] Escalated to ${teamName}`,
    html: wrap(
      `Ticket #${ticket.id} escalated`,
      `<p><strong>${ticket.subject}</strong> has been escalated to your team, <strong>${teamName}</strong>.</p>`
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

export function licenseOverageEmail(assetName: string, seatsPurchased: number, seatsDeployed: number): { subject: string; html: string } {
  return {
    subject: `[License Alert] ${assetName} is over-allocated`,
    html: wrap(
      `${assetName} is over-allocated`,
      `<p><strong>${assetName}</strong> has <strong>${seatsDeployed}</strong> active assignments but only
       <strong>${seatsPurchased}</strong> seat${seatsPurchased === 1 ? '' : 's'} purchased.</p>
       <p>Purchase additional seats or check in some assignments to bring this back into compliance.</p>`
    ),
  };
}

export function contractRenewalEmail(vendorName: string, contractType: string, endDate: string): { subject: string; html: string } {
  return {
    subject: `[Contract Renewal] ${vendorName} ${contractType} contract expires ${endDate}`,
    html: wrap(
      `Contract renewal coming up`,
      `<p>The <strong>${contractType}</strong> contract with <strong>${vendorName}</strong> expires on
       <strong>${endDate}</strong>.</p>`
    ),
  };
}

export function patchOverdueEmail(assetName: string, patchTitle: string, daysMissing: number): { subject: string; html: string } {
  return {
    subject: `[Patch Overdue] ${assetName} is missing a critical patch`,
    html: wrap(
      `${assetName} is overdue on a critical patch`,
      `<p><strong>${assetName}</strong> has been missing <strong>${patchTitle}</strong> for
       <strong>${daysMissing}</strong> day${daysMissing === 1 ? '' : 's'}, past the approved SLA.</p>`
    ),
  };
}
