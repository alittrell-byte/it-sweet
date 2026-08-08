import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DashboardSummary,
  RecurringTicketTemplate,
  Tag,
  Team,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketPriority,
  TicketSatisfactionSurvey,
  TicketSavedView,
  TicketSavedViewFilters,
  TicketStatus,
  TicketTemplate,
  TicketTimeEntry,
} from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  category?: string;
  teamId?: string;
  sourceTemplateId?: string;
  requiresApproval?: boolean;
}

export interface KbArticle {
  id: string;
  title: string;
  body: string;
  tags: string | null;
}

export interface CannedResponse {
  id: string;
  title: string;
  body: string;
}

export interface BulkResult {
  ticketId: number;
  success: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  constructor(private readonly http: HttpClient) {}

  listTickets(
    filter: {
      statuses?: TicketStatus[];
      priorities?: TicketPriority[];
      assigneeId?: string;
      teamId?: string;
      tag?: string;
      sortBy?: 'createdAt' | 'priority';
      sortDir?: 'ASC' | 'DESC';
    } = {}
  ): Promise<Ticket[]> {
    const params: Record<string, string> = {};
    if (filter.statuses && filter.statuses.length > 0) params['status'] = filter.statuses.join(',');
    if (filter.priorities && filter.priorities.length > 0) params['priority'] = filter.priorities.join(',');
    if (filter.assigneeId) params['assigneeId'] = filter.assigneeId;
    if (filter.teamId) params['teamId'] = filter.teamId;
    if (filter.tag) params['tag'] = filter.tag;
    if (filter.sortBy) params['sortBy'] = filter.sortBy;
    if (filter.sortDir) params['sortDir'] = filter.sortDir;
    return firstValueFrom(this.http.get<Ticket[]>('/api/tickets', { params }));
  }

  listAttachments(ticketId: number): Promise<TicketAttachment[]> {
    return firstValueFrom(this.http.get<TicketAttachment[]>(`/api/tickets/${ticketId}/attachments`));
  }

  getTicket(id: number): Promise<Ticket> {
    return firstValueFrom(this.http.get<Ticket>(`/api/tickets/${id}`));
  }

  createTicket(input: CreateTicketInput): Promise<Ticket> {
    return firstValueFrom(this.http.post<Ticket>('/api/tickets', input));
  }

  listComments(ticketId: number): Promise<TicketComment[]> {
    return firstValueFrom(this.http.get<TicketComment[]>(`/api/tickets/${ticketId}/comments`));
  }

  addComment(ticketId: number, body: string, isInternal: boolean): Promise<TicketComment> {
    return firstValueFrom(this.http.post<TicketComment>(`/api/tickets/${ticketId}/comments`, { body, isInternal }));
  }

  changeStatus(ticketId: number, status: TicketStatus): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`/api/tickets/${ticketId}/status`, { status }));
  }

  approve(ticketId: number): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`/api/tickets/${ticketId}/approve`, {}));
  }

  reject(ticketId: number, reason?: string): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`/api/tickets/${ticketId}/reject`, { reason }));
  }

  assign(ticketId: number, assigneeId: string): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`/api/tickets/${ticketId}/assign`, { assigneeId }));
  }

  setTeam(ticketId: number, teamId: string): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`/api/tickets/${ticketId}/team`, { teamId }));
  }

  escalate(ticketId: number, toTeamId?: string, reason?: string): Promise<Ticket> {
    return firstValueFrom(this.http.post<Ticket>(`/api/tickets/${ticketId}/escalate`, { toTeamId, reason }));
  }

  setTags(ticketId: number, tags: string[]): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`/api/tickets/${ticketId}/tags`, { tags }));
  }

  addWatcher(ticketId: number, userId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/tickets/${ticketId}/watchers`, { userId }));
  }

  uploadAttachment(ticketId: number, file: File, commentId?: string): Promise<TicketAttachment> {
    const form = new FormData();
    form.append('file', file);
    if (commentId) form.append('commentId', commentId);
    return firstValueFrom(this.http.post<TicketAttachment>(`/api/tickets/${ticketId}/attachments`, form));
  }

  attachmentDownloadUrl(ticketId: number, attachmentId: string): string {
    return `/api/tickets/${ticketId}/attachments/${attachmentId}`;
  }

  getDashboard(): Promise<DashboardSummary> {
    return firstValueFrom(this.http.get<DashboardSummary>('/api/tickets/dashboard'));
  }

  listTechnicians(): Promise<User[]> {
    return firstValueFrom(this.http.get<User[]>('/api/users', { params: { role: 'technician' } }));
  }

  searchKb(query: string): Promise<KbArticle[]> {
    return firstValueFrom(this.http.get<KbArticle[]>('/api/kb', { params: query ? { q: query } : {} }));
  }

  listCannedResponses(): Promise<CannedResponse[]> {
    return firstValueFrom(this.http.get<CannedResponse[]>('/api/canned-responses'));
  }

  linkAsset(ticketId: number, assetId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/tickets/${ticketId}/assets`, { assetId }));
  }

  unlinkAsset(ticketId: number, assetId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/tickets/${ticketId}/assets/${assetId}`));
  }

  linkArticle(ticketId: number, articleId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/tickets/${ticketId}/kb-articles`, { articleId }));
  }

  unlinkArticle(ticketId: number, articleId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/tickets/${ticketId}/kb-articles/${articleId}`));
  }

  // --- Time tracking ---

  listTimeEntries(ticketId: number): Promise<TicketTimeEntry[]> {
    return firstValueFrom(this.http.get<TicketTimeEntry[]>(`/api/tickets/${ticketId}/time-entries`));
  }

  logTime(ticketId: number, minutes: number, note?: string): Promise<TicketTimeEntry> {
    return firstValueFrom(this.http.post<TicketTimeEntry>(`/api/tickets/${ticketId}/time-entries`, { minutes, note }));
  }

  deleteTimeEntry(ticketId: number, entryId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/tickets/${ticketId}/time-entries/${entryId}`));
  }

  // --- CSAT ---

  getSurvey(ticketId: number): Promise<TicketSatisfactionSurvey | null> {
    return firstValueFrom(this.http.get<TicketSatisfactionSurvey | null>(`/api/tickets/${ticketId}/survey`));
  }

  submitSurvey(ticketId: number, rating: number, comment?: string): Promise<TicketSatisfactionSurvey> {
    return firstValueFrom(this.http.post<TicketSatisfactionSurvey>(`/api/tickets/${ticketId}/survey`, { rating, comment }));
  }

  // --- Bulk actions ---

  bulkChangeStatus(ticketIds: number[], status: TicketStatus): Promise<BulkResult[]> {
    return firstValueFrom(this.http.patch<BulkResult[]>('/api/tickets/bulk/status', { ticketIds, status }));
  }

  bulkAssign(ticketIds: number[], assigneeId: string): Promise<BulkResult[]> {
    return firstValueFrom(this.http.patch<BulkResult[]>('/api/tickets/bulk/assign', { ticketIds, assigneeId }));
  }

  bulkSetTags(ticketIds: number[], tags: string[]): Promise<BulkResult[]> {
    return firstValueFrom(this.http.patch<BulkResult[]>('/api/tickets/bulk/tags', { ticketIds, tags }));
  }

  bulkSetTeam(ticketIds: number[], teamId: string): Promise<BulkResult[]> {
    return firstValueFrom(this.http.patch<BulkResult[]>('/api/tickets/bulk/team', { ticketIds, teamId }));
  }

  // --- Tags (autocomplete) ---

  listTags(): Promise<Tag[]> {
    return firstValueFrom(this.http.get<Tag[]>('/api/tags'));
  }

  // --- Teams ---

  listTeams(): Promise<Team[]> {
    return firstValueFrom(this.http.get<Team[]>('/api/teams'));
  }

  createTeam(input: { name: string; description?: string; tier?: number; escalatesToTeamId?: string | null }): Promise<Team> {
    return firstValueFrom(this.http.post<Team>('/api/teams', input));
  }

  updateTeam(
    id: string,
    input: Partial<{ name: string; description?: string; tier?: number; escalatesToTeamId?: string | null }>
  ): Promise<Team> {
    return firstValueFrom(this.http.patch<Team>(`/api/teams/${id}`, input));
  }

  deleteTeam(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/teams/${id}`));
  }

  addTeamMember(teamId: string, userId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/teams/${teamId}/members`, { userId }));
  }

  removeTeamMember(teamId: string, userId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/teams/${teamId}/members/${userId}`));
  }

  // --- Ticket templates ---

  listTicketTemplates(): Promise<TicketTemplate[]> {
    return firstValueFrom(this.http.get<TicketTemplate[]>('/api/ticket-templates'));
  }

  listAllTicketTemplates(): Promise<TicketTemplate[]> {
    return firstValueFrom(this.http.get<TicketTemplate[]>('/api/ticket-templates/manage'));
  }

  createTicketTemplate(input: Omit<TicketTemplate, 'id'>): Promise<TicketTemplate> {
    return firstValueFrom(this.http.post<TicketTemplate>('/api/ticket-templates', input));
  }

  updateTicketTemplate(id: string, input: Partial<Omit<TicketTemplate, 'id'>>): Promise<TicketTemplate> {
    return firstValueFrom(this.http.patch<TicketTemplate>(`/api/ticket-templates/${id}`, input));
  }

  deleteTicketTemplate(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/ticket-templates/${id}`));
  }

  // --- Saved views ---

  listSavedViews(): Promise<TicketSavedView[]> {
    return firstValueFrom(this.http.get<TicketSavedView[]>('/api/ticket-saved-views'));
  }

  createSavedView(name: string, filters: TicketSavedViewFilters): Promise<TicketSavedView> {
    return firstValueFrom(this.http.post<TicketSavedView>('/api/ticket-saved-views', { name, filters }));
  }

  deleteSavedView(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/ticket-saved-views/${id}`));
  }

  // --- Recurring ticket templates ---

  listRecurringTemplates(): Promise<RecurringTicketTemplate[]> {
    return firstValueFrom(this.http.get<RecurringTicketTemplate[]>('/api/recurring-ticket-templates'));
  }

  createRecurringTemplate(input: Omit<RecurringTicketTemplate, 'id' | 'lastRunAt'>): Promise<RecurringTicketTemplate> {
    return firstValueFrom(this.http.post<RecurringTicketTemplate>('/api/recurring-ticket-templates', input));
  }

  updateRecurringTemplate(
    id: string,
    input: Partial<Omit<RecurringTicketTemplate, 'id' | 'lastRunAt'>>
  ): Promise<RecurringTicketTemplate> {
    return firstValueFrom(this.http.patch<RecurringTicketTemplate>(`/api/recurring-ticket-templates/${id}`, input));
  }

  deleteRecurringTemplate(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/recurring-ticket-templates/${id}`));
  }
}
