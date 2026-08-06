import { Op, col, fn, where as sequelizeWhere } from 'sequelize';
import { LogEntry, LogSeverity } from './logEntry.model';
import { LogSource } from './logSource.model';

const ERROR_TIER: LogSeverity[] = ['emergency', 'alert', 'critical', 'error'];
const ALL_SEVERITIES: LogSeverity[] = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'];

export interface SearchFilter {
  sourceId?: string;
  severity?: LogSeverity;
  query?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  rows: LogEntry[];
  total: number;
}

export async function searchLogs(filter: SearchFilter): Promise<SearchResult> {
  const where: Record<string | symbol, unknown> = {};
  if (filter.sourceId) where.sourceId = filter.sourceId;
  if (filter.severity) where.severity = filter.severity;
  if (filter.from || filter.to) {
    where.receivedAt = {
      ...(filter.from ? { [Op.gte]: filter.from } : {}),
      ...(filter.to ? { [Op.lte]: filter.to } : {}),
    };
  }
  if (filter.query?.trim()) {
    // LOWER(...) LIKE works identically on Postgres and MySQL, unlike Op.iLike
    // (Postgres-only) - same portable-search pattern used by the knowledge base.
    where[Op.and as unknown as string] = sequelizeWhere(fn('LOWER', col('LogEntry.message')), {
      [Op.like]: `%${filter.query.trim().toLowerCase()}%`,
    });
  }

  const { rows, count } = await LogEntry.findAndCountAll({
    where,
    include: [{ model: LogSource, as: 'source', attributes: ['id', 'name'] }],
    order: [['receivedAt', 'DESC']],
    limit: filter.limit ?? 100,
    offset: filter.offset ?? 0,
  });
  return { rows, total: count };
}

export interface DashboardSummary {
  severityBreakdown: Record<LogSeverity, number>;
  topSources: Array<{ sourceId: string | null; name: string; count: number }>;
  errorRateByHour: Array<{ hour: string; count: number }>;
}

// Bucketing is done in JS rather than a dialect-specific DATE_TRUNC/date_format SQL
// function, to stay portable across Postgres and MySQL. Fine at the log volumes this
// DB-backed module targets; a dedicated log store would be needed well beyond that.
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const entries = await LogEntry.findAll({
    where: { receivedAt: { [Op.gte]: since } },
    include: [{ model: LogSource, as: 'source', attributes: ['id', 'name'] }],
    attributes: ['id', 'severity', 'receivedAt', 'sourceId'],
  });

  const severityBreakdown = ALL_SEVERITIES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<LogSeverity, number>
  );
  const sourceCounts = new Map<string, { name: string; count: number }>();
  const hourBuckets = new Map<string, number>();

  for (const entry of entries) {
    severityBreakdown[entry.severity] += 1;

    const source = (entry as unknown as { source: LogSource | null }).source;
    const sourceKey = entry.sourceId ?? 'none';
    const sourceEntry = sourceCounts.get(sourceKey) ?? { name: source?.name ?? 'Unknown', count: 0 };
    sourceEntry.count += 1;
    sourceCounts.set(sourceKey, sourceEntry);

    if (ERROR_TIER.includes(entry.severity)) {
      const hour = entry.receivedAt.toISOString().slice(0, 13);
      hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
    }
  }

  const topSources = [...sourceCounts.entries()]
    .map(([sourceId, v]) => ({ sourceId: sourceId === 'none' ? null : sourceId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const errorRateByHour = [...hourBuckets.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  return { severityBreakdown, topSources, errorRateByHour };
}
