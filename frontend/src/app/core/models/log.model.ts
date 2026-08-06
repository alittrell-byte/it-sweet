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
