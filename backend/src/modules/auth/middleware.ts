import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ForbiddenError, UnauthorizedError } from '../../common/errors';
import { logger } from '../../common/logger';
import { AccessTokenPayload } from './authService';
import { User, UserRole } from './user.model';
import { UserPermission } from './userPermission.model';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

// GET of a single attachment: /api/<module>/<id>/attachments/<attachmentId>. Matched on the
// URL shape rather than per-route opt-in because every module router applies `authenticate`
// with router.use() before its routes are declared.
const ATTACHMENT_DOWNLOAD = /\/attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function allowsQueryToken(req: Request): boolean {
  if (req.headers.accept?.includes('text/event-stream')) return true;
  if (req.method !== 'GET') return false;
  const path = req.originalUrl.split('?')[0];
  return ATTACHMENT_DOWNLOAD.test(path);
}

// The access token only proves identity (its signature + expiry) - it is never trusted for
// authorization. role/rank/isSuperAdmin/permissions/isActive are re-read from the DB on every
// request, so revoking a permission, changing a role, deactivating, or deleting a user takes
// effect on that user's very next request instead of waiting up to JWT_ACCESS_TTL for their
// still-valid token to expire.
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  // Two browser primitives cannot set an Authorization header: the native EventSource API
  // (the log-tail SSE stream) and plain navigations/embeds (<a href> downloads, <img src>
  // inline KB images). For those, and only those, a ?token= query param is honoured as the
  // standard fallback. Access tokens are short-lived, which bounds the exposure from a token
  // landing in logs/history, and ordinary API calls still can't be made with a token in the URL.
  const token =
    (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined) ??
    (allowsQueryToken(req) && typeof req.query.token === 'string' ? req.query.token : undefined);
  if (!token) {
    next(new UnauthorizedError('Missing access token'));
    return;
  }

  let claims: { sub: string };
  try {
    claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
    return;
  }

  try {
    const user = await User.findByPk(claims.sub);
    if (!user || !user.isActive) {
      next(new UnauthorizedError('Invalid or expired access token'));
      return;
    }
    const grants = await UserPermission.findAll({ where: { userId: user.id } });
    req.user = {
      sub: user.id,
      email: user.email,
      role: user.role,
      rank: user.rank,
      isSuperAdmin: user.isSuperAdmin,
      permissions: grants.map((g) => g.permissionKey),
    };
    next();
  } catch (err) {
    logger.error('Failed to load live authorization state', { err });
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ForbiddenError('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

/** Grants access if the user holds ANY of the given permission keys, or is a super admin. */
export function requirePermission(...keys: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('You do not have permission to perform this action'));
      return;
    }
    if (req.user.isSuperAdmin || keys.some((key) => req.user!.permissions.includes(key))) {
      next();
      return;
    }
    next(new ForbiddenError('You do not have permission to perform this action'));
  };
}
