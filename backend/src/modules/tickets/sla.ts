import { TicketPriority } from './ticket.model';

export interface SlaTarget {
  responseMinutes: number;
  resolutionMinutes: number;
}

// Response/resolution targets by priority. Kept as a simple in-code map for Module 1;
// an admin-editable SLA policy table is a natural follow-up once reporting (Module 10)
// needs to compare targets over time.
export const SLA_TARGETS: Record<TicketPriority, SlaTarget> = {
  urgent: { responseMinutes: 30, resolutionMinutes: 4 * 60 },
  high: { responseMinutes: 60, resolutionMinutes: 8 * 60 },
  medium: { responseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
  low: { responseMinutes: 8 * 60, resolutionMinutes: 72 * 60 },
};

export function computeSlaDueDates(priority: TicketPriority, from: Date = new Date()) {
  const target = SLA_TARGETS[priority];
  return {
    responseDueAt: new Date(from.getTime() + target.responseMinutes * 60_000),
    resolutionDueAt: new Date(from.getTime() + target.resolutionMinutes * 60_000),
  };
}

export function isBreached(dueAt: Date | null, achievedAt: Date | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const comparedAgainst = achievedAt ?? now;
  return comparedAgainst.getTime() > dueAt.getTime();
}
