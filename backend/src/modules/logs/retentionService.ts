import { Op } from 'sequelize';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import { LogEntry } from './logEntry.model';
import { LogSource } from './logSource.model';
import { LogRetentionSetting } from './logRetentionSetting.model';

const SETTINGS_ROW_ID = 1;

export function computeCutoffDate(retentionDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export async function getDefaultRetentionDays(): Promise<number> {
  const [row] = await LogRetentionSetting.findOrCreate({
    where: { id: SETTINGS_ROW_ID },
    defaults: { id: SETTINGS_ROW_ID, defaultRetentionDays: 30 },
  });
  return row.defaultRetentionDays;
}

export async function setDefaultRetentionDays(days: number): Promise<number> {
  const [row] = await LogRetentionSetting.findOrCreate({
    where: { id: SETTINGS_ROW_ID },
    defaults: { id: SETTINGS_ROW_ID, defaultRetentionDays: days },
  });
  await row.update({ defaultRetentionDays: days });
  return row.defaultRetentionDays;
}

// Deletes log_entries past the effective retention (per-source override, else the global
// default) for every source, plus any entries with no source at all (global default only).
// Returns the number of rows removed, mainly so the manual "Purge Now" action and the
// scheduled sweep can both report something meaningful.
export async function purgeExpiredEntries(): Promise<number> {
  const defaultDays = await getDefaultRetentionDays();
  const sources = await LogSource.findAll();
  let deleted = 0;

  for (const source of sources) {
    const days = source.retentionDays ?? defaultDays;
    const cutoff = computeCutoffDate(days);
    deleted += await LogEntry.destroy({ where: { sourceId: source.id, receivedAt: { [Op.lt]: cutoff } } });
  }

  const defaultCutoff = computeCutoffDate(defaultDays);
  deleted += await LogEntry.destroy({ where: { sourceId: null, receivedAt: { [Op.lt]: defaultCutoff } } });

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
