import { User } from './user.model';
import { Asset } from './asset.model';
import { KnowledgeBaseArticle } from './kb.model';

export type TicketStatus = 'new' | 'in_progress' | 'waiting' | 'pending_approval' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  tier: number;
  escalatesToTeamId: string | null;
  escalatesTo?: Team | null;
  members?: User[];
}

export interface TicketTemplate {
  id: string;
  name: string;
  subjectTemplate: string;
  descriptionTemplate: string;
  category: string | null;
  priority: TicketPriority;
  isActive: boolean;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  requesterId: string;
  assigneeId: string | null;
  teamId: string | null;
  sourceTemplateId: string | null;
  requiresApproval: boolean;
  approvalStatus: TicketApprovalStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  approvalReason: string | null;
  requester?: User;
  assignee?: User | null;
  team?: Team | null;
  sourceTemplate?: TicketTemplate | null;
  tags?: Tag[];
  linkedAssets?: Asset[];
  linkedArticles?: KnowledgeBaseArticle[];
  totalMinutesLogged?: number;
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

export interface TicketTimeEntry {
  id: string;
  ticketId: number;
  technicianId: string;
  technician?: User;
  minutes: number;
  note: string | null;
  workDate: string;
  createdAt: string;
}

export interface TicketSatisfactionSurvey {
  id: string;
  ticketId: number;
  rating: number | null;
  comment: string | null;
  submittedAt: string | null;
}

export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  type: RecurrenceType;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface RecurringTicketTemplate {
  id: string;
  name: string;
  subjectTemplate: string;
  descriptionTemplate: string;
  category: string | null;
  priority: TicketPriority;
  assigneeId: string | null;
  recurrenceRule: RecurrenceRule;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
}

export interface TicketSavedViewFilters {
  status?: string;
  assigneeId?: string;
  priority?: string;
  category?: string;
  teamId?: string;
  tag?: string;
}

export interface TicketSavedView {
  id: string;
  userId: string;
  name: string;
  filters: TicketSavedViewFilters;
}

export interface DashboardSummary {
  openByStatus: Record<TicketStatus, number>;
  workloadByTech: Array<{ assigneeId: string; displayName: string; openCount: number }>;
  agingTickets: Array<{ id: number; subject: string; ageInDays: number; priority: TicketPriority }>;
  breachedCount: number;
  avgCsatRating: number | null;
  csatResponseCount: number;
}

export const TICKET_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'];
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
