import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DashboardSummary,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketPriority,
  TicketStatus,
} from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  category?: string;
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

@Injectable({ providedIn: 'root' })
export class TicketService {
  constructor(private readonly http: HttpClient) {}

  listTickets(filter: { status?: TicketStatus; assigneeId?: string } = {}): Promise<Ticket[]> {
    const params: Record<string, string> = {};
    if (filter.status) params['status'] = filter.status;
    if (filter.assigneeId) params['assigneeId'] = filter.assigneeId;
    return firstValueFrom(this.http.get<Ticket[]>('/api/tickets', { params }));
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

  assign(ticketId: number, assigneeId: string): Promise<Ticket> {
    return firstValueFrom(this.http.patch<Ticket>(`/api/tickets/${ticketId}/assign`, { assigneeId }));
  }

  addWatcher(ticketId: number, userId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/tickets/${ticketId}/watchers`, { userId }));
  }

  uploadAttachment(ticketId: number, file: File): Promise<TicketAttachment> {
    const form = new FormData();
    form.append('file', file);
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
}
