import { NextFunction, Request, RequestHandler, Response } from 'express';

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Bucket key for a request, e.g. client IP, or IP + submitted username. */
  key: (req: Request) => string;
  /** Count only responses this returns true for (e.g. failed logins). Defaults to counting every request. */
  countWhen?: (res: Response) => boolean;
}

// Fixed-window limiter kept in process memory. Deliberately dependency-free: it's enough for
// a single backend container, but each replica keeps its own counts - move to Redis (or
// express-rate-limit with a shared store) before running more than one instance.
export function rateLimit({ windowMs, max, key, countWhen }: RateLimitOptions): RequestHandler {
  const windows = new Map<string, Window>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }, windowMs);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const k = key(req);
    const now = Date.now();
    let w = windows.get(k);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(k, w);
    }

    if (w.count >= max) {
      res.setHeader('Retry-After', Math.ceil((w.resetAt - now) / 1000));
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    if (countWhen) {
      const current = w;
      res.on('finish', () => {
        if (countWhen(res)) current.count++;
      });
    } else {
      w.count++;
    }
    next();
  };
}
