import { gzipSync } from 'zlib';
import { Op } from 'sequelize';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { storageProvider } from '../../common/storage';
import { LogEntry } from './logEntry.model';
import { LogSource } from './logSource.model';
import { LogRetentionSetting, LogRetentionSettingAttributes } from './logRetentionSetting.model';

const SETTINGS_ROW_ID = 1;

export function computeCutoffDate(retentionDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

async function getSettingsRow(): Promise<LogRetentionSetting> {
  const [row] = await LogRetentionSetting.findOrCreate({
    where: { id: SETTINGS_ROW_ID },
    defaults: { id: SETTINGS_ROW_ID, defaultRetentionDays: 30, archiveBeforePurge: false },
  });
  return row;
}

export async function getRetentionSettings(): Promise<Pick<LogRetentionSettingAttributes, 'defaultRetentionDays' | 'archiveBeforePurge'>> {
  const row = await getSettingsRow();
  return { defaultRetentionDays: row.defaultRetentionDays, archiveBeforePurge: row.archiveBeforePurge };
}

export async function updateRetentionSettings(
  input: Partial<Pick<LogRetentionSettingAttributes, 'defaultRetentionDays' | 'archiveBeforePurge'>>
): Promise<Pick<LogRetentionSettingAttributes, 'defaultRetentionDays' | 'archiveBeforePurge'>> {
  const row = await getSettingsRow();
  await row.update(input);
  return { defaultRetentionDays: row.defaultRetentionDays, archiveBeforePurge: row.archiveBeforePurge };
}

// Archives a batch of expiring entries as gzipped NDJSON to the configured StorageProvider
// (MinIO/S3 in production, local disk in dev) before they're deleted. Reuses the same put()
// interface already used for ticket/KB attachments - this module had never touched storage
// before. Best-effort: an archive failure logs and still lets the purge proceed, since losing an
// archive copy is preferable to logs piling up forever because cold storage is unreachable.
async function archiveBatch(sourceLabel: string, entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const ndjson = entries.map((e) => JSON.stringify(e.toJSON())).join('\n');
  const body = gzipSync(Buffer.from(ndjson, 'utf-8'));
  const key = `log-archives/${sourceLabel}/${new Date().toISOString().replace(/[:.]/g, '-')}.ndjson.gz`;
  try {
    await storageProvider.put({ key, body, contentType: 'application/gzip' });
  } catch (err) {
    logger.error('Failed to archive log entries before purge - proceeding with purge anyway', { err, key });
  }
}

// Deletes log_entries past the effective retention (per-source override, else the global
// default) for every source, plus any entries with no source at all (global default only).
// Returns the number of rows removed, mainly so the manual "Purge Now" action and the
// scheduled sweep can both report something meaningful.
export async function purgeExpiredEntries(): Promise<number> {
  const settings = await getRetentionSettings();
  const sources = await LogSource.findAll();
  let deleted = 0;

  for (const source of sources) {
    const days = source.retentionDays ?? settings.defaultRetentionDays;
    const cutoff = computeCutoffDate(days);
    const where = { sourceId: source.id, receivedAt: { [Op.lt]: cutoff } };
    if (settings.archiveBeforePurge) {
      const expiring = await LogEntry.findAll({ where });
      await archiveBatch(source.id, expiring);
    }
    deleted += await LogEntry.destroy({ where });
  }

  const defaultCutoff = computeCutoffDate(settings.defaultRetentionDays);
  const unsourcedWhere = { sourceId: null, receivedAt: { [Op.lt]: defaultCutoff } };
  if (settings.archiveBeforePurge) {
    const expiring = await LogEntry.findAll({ where: unsourcedWhere });
    await archiveBatch('unsourced', expiring);
  }
  deleted += await LogEntry.destroy({ where: unsourcedWhere });

  return deleted;
}

export class RetentionSweeper {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.timer = setInterval(() => {
      purgeExpiredEntries()
        .then((count) => {
          if (count > 0) logger.info(`Log retention sweep purged ${count} expired entries`);
        })
        .catch((err) => logger.error('Log retention sweep failed', { err }));
    }, env.LOG_RETENTION_SWEEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
