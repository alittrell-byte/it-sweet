import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Team } from '../../../core/models/ticket.model';
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
  LogSourceWithKey,
  NotificationGroupOption,
  RetentionSettings,
  SavedSearch,
  SavedSearchFilters,
} from '../../../core/models/log.model';

export interface SearchFilter {
  sourceId?: string;
  severity?: LogSeverity;
  q?: string;
  from?: string;
  to?: string;
  metadataField?: string;
  metadataValue?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSourceInput {
  name: string;
  type: LogSourceType;
  retentionDays?: number | null;
  restrictedToTeamId?: string | null;
  assetId?: string | null;
}

export interface CreateAlertRuleInput {
  name: string;
  sourceId?: string | null;
  pattern: string;
  severityFilter?: LogSeverity | null;
  thresholdCount: number;
  thresholdWindowMinutes: number;
  notifyEmails?: string[];
  notifyGroupId?: string | null;
  groupByMetadataField?: string | null;
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

  createSource(input: CreateSourceInput): Promise<LogSourceWithKey> {
    return firstValueFrom(this.http.post<LogSourceWithKey>('/api/logs/sources', input));
  }

  updateSource(id: string, input: Partial<CreateSourceInput>): Promise<LogSource> {
    return firstValueFrom(this.http.patch<LogSource>(`/api/logs/sources/${id}`, input));
  }

  rotateSourceKey(id: string): Promise<LogSourceWithKey> {
    return firstValueFrom(this.http.post<LogSourceWithKey>(`/api/logs/sources/${id}/rotate-key`, {}));
  }

  deleteSource(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/logs/sources/${id}`));
  }

  getRetentionSettings(): Promise<RetentionSettings> {
    return firstValueFrom(this.http.get<RetentionSettings>('/api/logs/retention-settings'));
  }

  updateRetentionSettings(input: Partial<RetentionSettings>): Promise<RetentionSettings> {
    return firstValueFrom(this.http.patch<RetentionSettings>('/api/logs/retention-settings', input));
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

  listTeams(): Promise<Team[]> {
    return firstValueFrom(this.http.get<Team[]>('/api/teams'));
  }

  listNotificationGroups(): Promise<NotificationGroupOption[]> {
    return firstValueFrom(this.http.get<NotificationGroupOption[]>('/api/notification-groups'));
  }

  listSavedSearches(): Promise<SavedSearch[]> {
    return firstValueFrom(this.http.get<SavedSearch[]>('/api/logs/saved-searches'));
  }

  createSavedSearch(name: string, filters: SavedSearchFilters): Promise<SavedSearch> {
    return firstValueFrom(this.http.post<SavedSearch>('/api/logs/saved-searches', { name, filters }));
  }

  deleteSavedSearch(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/logs/saved-searches/${id}`));
  }
}

export type { LogEntry };
