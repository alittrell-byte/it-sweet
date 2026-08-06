import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { NotFoundError } from '../../common/errors';
import * as authService from './authService';
import { User } from './user.model';
import { UserPermission } from './userPermission.model';

const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
};

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    rank: user.rank,
    isSuperAdmin: user.isSuperAdmin,
  };
}

async function publicUserWithPermissions(user: User) {
  const grants = await UserPermission.findAll({ where: { userId: user.id } });
  return { ...publicUser(user), permissions: grants.map((g) => g.permissionKey) };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, displayName } = registerSchema.parse(req.body);
  const user = await authService.registerLocalUser(email, password, displayName);
  res.status(201).json(publicUser(user));
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = loginSchema.parse(req.body);
  const { user, tokens } = await authService.login(username, password);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  res.json({ accessToken: tokens.accessToken, user: await publicUserWithPermissions(user) });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE];
  const tokens = await authService.refreshAccessToken(token ?? '');
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  res.json({ accessToken: tokens.accessToken });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changeOwnPassword(req.user!.sub, currentPassword, newPassword);
  res.status(204).send();
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).send();
}

// Returns the caller's current profile fresh from the DB (not just the JWT claims),
// plus their live granted permission keys, so the frontend can rebuild its session
// state - including nav visibility - after a page reload.
export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findByPk(req.user!.sub);
  if (!user) throw new NotFoundError('User not found');
  res.json({ user: await publicUserWithPermissions(user) });
}
