import { User } from './user.model';
import { Asset } from './asset.model';

export type TicketStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  requesterId: string;
  assigneeId: string | null;
  requester?: User;
  assignee?: User | null;
  linkedAssets?: Asset[];
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  id: string;
  ticketId: number;
  authorId: string;
  author?: User;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: number;
  commentId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DashboardSummary {
  openByStatus: Record<TicketStatus, number>;
  workloadByTech: Array<{ assigneeId: string; displayName: string; openCount: number }>;
  agingTickets: Array<{ id: number; subject: string; ageInDays: number; priority: TicketPriority }>;
  breachedCount: number;
}

export const TICKET_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting', 'resolved', 'closed'];
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
