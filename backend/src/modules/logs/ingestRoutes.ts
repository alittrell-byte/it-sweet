import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { UnauthorizedError } from '../../common/errors';
import { LogSource } from './logSource.model';
import { findSourceByApiKey, ingestEntry } from './logIngestService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      logSource?: LogSource;
    }
  }
}

async function requireSourceApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.header('x-api-key');
  if (!apiKey) {
    next(new UnauthorizedError('Missing X-Api-Key header'));
    return;
  }
  const source = await findSourceByApiKey(apiKey);
  if (!source) {
    next(new UnauthorizedError('Invalid API key'));
    return;
  }
  req.logSource = source;
  next();
}

const severityEnum = z.enum(['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug']);

const entrySchema = z.object({
  host: z.string().max(255).optional(),
  severity: severityEnum.optional(),
  message: z.string().min(1),
  timestamp: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ingestSchema = z.union([entrySchema, z.object({ entries: z.array(entrySchema).min(1).max(1000) })]);

export const ingestRouter = Router();

// Agents authenticate with a per-source API key, not a user session - this is the
// "lightweight agent" integration point (Fluent Bit/Filebeat HTTP output, a cron+curl
// script, etc.), separate from the UDP syslog receiver for zero-agent devices.
ingestRouter.post(
  '/',
  requireSourceApiKey,
  asyncHandler(async (req, res) => {
    const input = ingestSchema.parse(req.body);
    const entries = 'entries' in input ? input.entries : [input];
    const created = await Promise.all(
      entries.map((e) =>
        ingestEntry(req.logSource!.id, {
          host: e.host,
          severity: e.severity,
          message: e.message,
          raw: JSON.stringify(e),
          receivedAt: e.timestamp,
          metadata: e.metadata,
        })
      )
    );
    res.status(201).json({ ingested: created.length });
  })
);
