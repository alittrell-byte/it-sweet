import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AlertEvent,
  AlertRule,
  LogDashboardSummary,
  LogEntry,
  LogSearchResult,
  LogSeverity,
  LogSource,
  LogSourceOption,
  LogSourceType,
} from '../../../core/models/log.model';

export interface SearchFilter {
  sourceId?: string;
  severity?: LogSeverity;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSourceInput {
  name: string;
  type: LogSourceType;
  retentionDays?: number | null;
}

export interface CreateAlertRuleInput {
  name: string;
  sourceId?: string | null;
  pattern: string;
  severityFilter?: LogSeverity | null;
  thresholdCount: number;
  thresholdWindowMinutes: number;
  notifyEmails?: string[];
  webhookUrl?: string | null;
  createTicket: boolean;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LogService {
  constructor(private readonly http: HttpClient) {}

  search(filter: SearchFilter): Promise<LogSearchResult> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== '') params[key] = String(value);
    }
    return firstValueFrom(this.http.get<LogSearchResult>('/api/logs', { params }));
  }

  dashboard(): Promise<LogDashboardSummary> {
    return firstValueFrom(this.http.get<LogDashboardSummary>('/api/logs/dashboard'));
  }

  tailUrl(filter: { sourceId?: string; severity?: LogSeverity }): string {
    const params = new URLSearchParams();
    if (filter.sourceId) params.set('sourceId', filter.sourceId);
    if (filter.severity) params.set('severity', filter.severity);
    const query = params.toString();
    return `/api/logs/tail${query ? `?${query}` : ''}`;
  }

  sourceOptions(): Promise<LogSourceOption[]> {
    return firstValueFrom(this.http.get<LogSourceOption[]>('/api/logs/sources/options'));
  }

  listSources(): Promise<LogSource[]> {
    return firstValueFrom(this.http.get<LogSource[]>('/api/logs/sources'));
  }

  createSource(input: CreateSourceInput): Promise<LogSource> {
    return firstValueFrom(this.http.post<LogSource>('/api/logs/sources', input));
  }

  updateSource(id: string, input: Partial<CreateSourceInput>): Promise<LogSource> {
    return firstValueFrom(this.http.patch<LogSource>(`/api/logs/sources/${id}`, input));
  }

  rotateSourceKey(id: string): Promise<LogSource> {
    return firstValueFrom(this.http.post<LogSource>(`/api/logs/sources/${id}/rotate-key`, {}));
  }

  deleteSource(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/logs/sources/${id}`));
  }

  getRetentionSettings(): Promise<{ defaultRetentionDays: number }> {
    return firstValueFrom(this.http.get<{ defaultRetentionDays: number }>('/api/logs/retention-settings'));
  }

  setRetentionSettings(defaultRetentionDays: number): Promise<{ defaultRetentionDays: number }> {
    return firstValueFrom(
      this.http.patch<{ defaultRetentionDays: number }>('/api/logs/retention-settings', { defaultRetentionDays })
    );
  }

  purgeNow(): Promise<{ deleted: number }> {
    return firstValueFrom(this.http.post<{ deleted: number }>('/api/logs/retention-settings/purge-now', {}));
  }

  listAlertRules(): Promise<AlertRule[]> {
    return firstValueFrom(this.http.get<AlertRule[]>('/api/logs/alert-rules'));
  }

  createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
    return firstValueFrom(this.http.post<AlertRule>('/api/logs/alert-rules', input));
  }

  updateAlertRule(id: string, input: Partial<CreateAlertRuleInput>): Promise<AlertRule> {
    return firstValueFrom(this.http.patch<AlertRule>(`/api/logs/alert-rules/${id}`, input));
  }

  deleteAlertRule(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/logs/alert-rules/${id}`));
  }

  listAlertEvents(ruleId: string): Promise<AlertEvent[]> {
    return firstValueFrom(this.http.get<AlertEvent[]>(`/api/logs/alert-rules/${ruleId}/events`));
  }
}

export type { LogEntry };
