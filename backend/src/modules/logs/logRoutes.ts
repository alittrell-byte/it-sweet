import { Op } from 'sequelize';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { NotFoundError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import { LogSource } from './logSource.model';
import { generateApiKey } from './logIngestService';
import { logEventBus } from './logEvents';
import { LogEntry } from './logEntry.model';
import * as searchService from './logSearchService';
import * as retentionService from './retentionService';
import { getVisibleSourceIds, VisibleSources } from './logAccessControl';

export const logRouter = Router();
logRouter.use(authenticate, requireRole('admin', 'technician'), requirePermission('logs.view'));

const severityEnum = z.enum(['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug']);

const searchSchema = z.object({
  sourceId: z.string().uuid().optional(),
  severity: severityEnum.optional(),
  q: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  metadataField: z.string().optional(),
  metadataValue: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

logRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = searchSchema.parse(req.query);
    const visibleSourceIds = await getVisibleSourceIds(req.user!);
    const result = await searchService.searchLogs({
      sourceId: filter.sourceId,
      severity: filter.severity,
      query: filter.q,
      from: filter.from,
      to: filter.to,
      metadataField: filter.metadataField,
      metadataValue: filter.metadataValue,
      limit: filter.limit,
      offset: filter.offset,
      visibleSourceIds,
    });
    res.json(result);
  })
);

logRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const visibleSourceIds = await getVisibleSourceIds(req.user!);
    res.json(await searchService.getDashboardSummary(visibleSourceIds));
  })
);

const tailSchema = z.object({ sourceId: z.string().uuid().optional(), severity: severityEnum.optional() });

// Server-Sent Events: one-directional push of new entries as they're ingested, filtered
// to what this connection asked for. Chosen over WebSockets since it needs no new client
// library (native EventSource) and passes through the existing nginx reverse proxy as-is.
logRouter.get('/tail', (req, res) => {
  const filter = tailSchema.parse(req.query);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let visibleSourceIds: VisibleSources = 'all';
  // Computed once per connection (team memberships don't change mid-stream) rather than
  // per-entry, to keep the hot path cheap.
  getVisibleSourceIds(req.user!).then((ids) => {
    visibleSourceIds = ids;
  });

  const onEntry = (entry: LogEntry) => {
    if (filter.sourceId && entry.sourceId !== filter.sourceId) return;
    if (filter.severity && entry.severity !== filter.severity) return;
    if (visibleSourceIds !== 'all' && entry.sourceId && !visibleSourceIds.includes(entry.sourceId)) return;
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };
  logEventBus.on('entry', onEntry);

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    logEventBus.off('entry', onEntry);
  });
});

// --- Sources ---

// Lightweight list for filter dropdowns - no API keys, scoped to sources this actor is
// permitted to see so a restricted source's name doesn't leak into someone else's picker.
logRouter.get(
  '/sources/options',
  asyncHandler(async (req, res) => {
    const visibleSourceIds = await getVisibleSourceIds(req.user!);
    const where = visibleSourceIds === 'all' ? {} : { id: { [Op.in]: visibleSourceIds } };
    res.json(await LogSource.findAll({ where, attributes: ['id', 'name', 'type'], order: [['name', 'ASC']] }));
  })
);

const SOURCES = requirePermission('logs.manage_sources');

logRouter.get(
  '/sources',
  SOURCES,
  asyncHandler(async (_req, res) => {
    res.json(await LogSource.findAll({ order: [['name', 'ASC']] }));
  })
);

const createSourceSchema = z.object({
  name: z.string().min(1).max(150),
  type: z.enum(['syslog', 'http', 'internal']).default('http'),
  retentionDays: z.number().int().min(1).nullable().optional(),
  restrictedToTeamId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
});

logRouter.post(
  '/sources',
  SOURCES,
  asyncHandler(async (req, res) => {
    const input = createSourceSchema.parse(req.body);
    const source = await LogSource.create({ ...input, apiKey: generateApiKey() });
    res.status(201).json(source);
  })
);

const updateSourceSchema = createSourceSchema.partial();

logRouter.patch(
  '/sources/:id',
  SOURCES,
  asyncHandler(async (req, res) => {
    const input = updateSourceSchema.parse(req.body);
    const source = await LogSource.findByPk(req.params.id);
    if (!source) throw new NotFoundError('Log source not found');
    await source.update(input);
    res.json(source);
  })
);

logRouter.post(
  '/sources/:id/rotate-key',
  SOURCES,
  asyncHandler(async (req, res) => {
    const source = await LogSource.findByPk(req.params.id);
    if (!source) throw new NotFoundError('Log source not found');
    await source.update({ apiKey: generateApiKey() });
    res.json(source);
  })
);

logRouter.delete(
  '/sources/:id',
  SOURCES,
  asyncHandler(async (req, res) => {
    await LogSource.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// --- Retention ---

const RETENTION = requirePermission('logs.manage_retention');

logRouter.get(
  '/retention-settings',
  RETENTION,
  asyncHandler(async (_req, res) => {
    res.json(await retentionService.getRetentionSettings());
  })
);

const retentionSchema = z.object({
  defaultRetentionDays: z.number().int().min(1).max(3650).optional(),
  archiveBeforePurge: z.boolean().optional(),
});

logRouter.patch(
  '/retention-settings',
  RETENTION,
  asyncHandler(async (req, res) => {
    const input = retentionSchema.parse(req.body);
    res.json(await retentionService.updateRetentionSettings(input));
  })
);

logRouter.post(
  '/retention-settings/purge-now',
  RETENTION,
  asyncHandler(async (_req, res) => {
    res.json({ deleted: await retentionService.purgeExpiredEntries() });
  })
);
