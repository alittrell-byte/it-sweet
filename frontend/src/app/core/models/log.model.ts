export type LogSeverity = 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug';
export type LogSourceType = 'syslog' | 'http' | 'internal';

export const LOG_SEVERITIES: LogSeverity[] = [
  'emergency',
  'alert',
  'critical',
  'error',
  'warning',
  'notice',
  'info',
  'debug',
];

export interface LogSourceOption {
  id: string;
  name: string;
  type: LogSourceType;
}

export interface LogSource extends LogSourceOption {
  apiKey: string;
  retentionDays: number | null;
  restrictedToTeamId: string | null;
  assetId: string | null;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  sourceId: string | null;
  source?: { id: string; name: string } | null;
  host: string | null;
  severity: LogSeverity;
  message: string;
  raw: string | null;
  receivedAt: string;
  metadata: Record<string, unknown>;
}

export interface LogSearchResult {
  rows: LogEntry[];
  total: number;
}

export interface LogDashboardSummary {
  severityBreakdown: Record<LogSeverity, number>;
  topSources: Array<{ sourceId: string | null; name: string; count: number }>;
  errorRateByHour: Array<{ hour: string; count: number }>;
}

export interface AlertRule {
  id: string;
  name: string;
  sourceId: string | null;
  pattern: string;
  severityFilter: LogSeverity | null;
  thresholdCount: number;
  thresholdWindowMinutes: number;
  notifyEmails: string | null;
  notifyGroupId: string | null;
  groupByMetadataField: string | null;
  webhookUrl: string | null;
  createTicket: boolean;
  isActive: boolean;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  triggeredAt: string;
  matchCount: number;
  sampleMessage: string;
  resolvedTicketId: number | null;
}

export interface SavedSearchFilters {
  sourceId?: string;
  severity?: LogSeverity;
  q?: string;
  from?: string;
  to?: string;
  metadataField?: string;
  metadataValue?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  createdAt: string;
}

export interface NotificationGroupOption {
  id: string;
  name: string;
}

export interface RetentionSettings {
  defaultRetentionDays: number;
  archiveBeforePurge: boolean;
}
