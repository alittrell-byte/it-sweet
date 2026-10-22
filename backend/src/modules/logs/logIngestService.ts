import { generateApiKey, hashApiKey } from '../../common/apiKeys';
import { LogEntry, LogSeverity } from './logEntry.model';
import { LogSource, LogSourceType } from './logSource.model';
import { emitLogEntry } from './logEvents';
import { parseLogFields } from './logParsers';

export { generateApiKey };

export async function findSourceByApiKey(apiKey: string): Promise<LogSource | null> {
  return LogSource.findOne({ where: { apiKeyHash: hashApiKey(apiKey) } });
}

let unregisteredSourceId: string | null = null;

// Lazily creates (once) a catch-all source for senders that show up before anyone registers
// them - most commonly syslog devices, which just start sending UDP packets with no API key
// negotiation. Search/alerting still work against it; an admin can rename or split it later.
async function getUnregisteredSource(): Promise<LogSource> {
  if (unregisteredSourceId) {
    const existing = await LogSource.findByPk(unregisteredSourceId);
    if (existing) return existing;
  }
  const [source] = await LogSource.findOrCreate({
    where: { name: 'Unregistered' },
    defaults: { name: 'Unregistered', type: 'syslog' as LogSourceType, apiKeyHash: hashApiKey(generateApiKey()) },
  });
  unregisteredSourceId = source.id;
  return source;
}

export interface IngestInput {
  host?: string | null;
  severity?: LogSeverity;
  message: string;
  raw?: string | null;
  receivedAt?: Date;
  metadata?: Record<string, unknown>;
}

export async function ingestEntry(sourceId: string | null, input: IngestInput): Promise<LogEntry> {
  // Best-effort field extraction (source IP, Windows event ID, etc.) fills in only what the
  // caller didn't already provide explicitly - a smart agent's own structured metadata always
  // wins over a regex guess.
  const parsed = parseLogFields(input.message);
  const entry = await LogEntry.create({
    sourceId,
    host: input.host ?? null,
    severity: input.severity ?? 'info',
    message: input.message,
    raw: input.raw ?? null,
    receivedAt: input.receivedAt ?? new Date(),
    metadata: { ...parsed, ...(input.metadata ?? {}) },
  });
  emitLogEntry(entry);
  return entry;
}

export async function ingestUnregistered(input: IngestInput): Promise<LogEntry> {
  const source = await getUnregisteredSource();
  return ingestEntry(source.id, input);
}
