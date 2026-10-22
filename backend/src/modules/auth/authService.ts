import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { BadRequestError, UnauthorizedError } from '../../common/errors';
import { AuthProvider } from './AuthProvider';
import { LocalAuthProvider } from './LocalAuthProvider';
import { LdapAuthProvider } from './LdapAuthProvider';
import { User, UserRole } from './user.model';

const providers: Record<'local' | 'ldap', AuthProvider> = {
  local: new LocalAuthProvider(),
  ldap: new LdapAuthProvider(),
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Describes req.user as populated by the `authenticate` middleware. The JWT itself only
// carries `sub` (see issueTokens below) - authenticate re-derives all of this fresh from
// the DB on every request, so it is never stale.
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  rank: number;
  isSuperAdmin: boolean;
  permissions: string[];
}

export function resolveRoleFromGroups(groups: string[]): UserRole {
  let map: Record<string, UserRole> = {};
  try {
    map = JSON.parse(env.LDAP_GROUP_ROLE_MAP);
  } catch {
    map = {};
  }
  for (const group of groups) {
    if (map[group]) {
      return map[group];
    }
  }
  return env.LDAP_DEFAULT_ROLE;
}

// Deliberately minimal: the access token is just proof of identity (sub) plus an expiry.
// It never carries role/rank/permissions, so there is nothing stale for `authenticate` to
// accidentally trust - see the comment on AccessTokenPayload above.
function issueTokens(user: User): TokenPair {
  const accessToken = jwt.sign({ sub: user.id }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ sub: user.id, ver: user.tokenVersion }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

export async function registerLocalUser(email: string, password: string, displayName: string): Promise<User> {
  if (env.AUTH_PROVIDER !== 'local') {
    throw new BadRequestError('Self-registration is disabled when AUTH_PROVIDER=ldap; accounts come from the directory');
  }
  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new BadRequestError('An account with that email already exists');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({
    email: email.toLowerCase(),
    displayName,
    role: 'customer',
    passwordHash,
    authSource: 'local',
  });
}

export async function login(username: string, password: string): Promise<{ user: User; tokens: TokenPair }> {
  const provider = providers[env.AUTH_PROVIDER];
  const result = await provider.verifyCredentials(username, password);
  if (!result) {
    throw new UnauthorizedError('Invalid credentials');
  }

  let user =
    env.AUTH_PROVIDER === 'ldap'
      ? await User.findOne({ where: { externalId: result.externalId, authSource: 'ldap' } })
      : await User.findOne({ where: { id: result.externalId, authSource: 'local' } });

  if (!user && env.AUTH_PROVIDER === 'ldap') {
    // Just-in-time provisioning: first successful LDAP bind creates the local User row.
    user = await User.create({
      email: result.email.toLowerCase(),
      displayName: result.displayName,
      role: resolveRoleFromGroups(result.groups),
      authSource: 'ldap',
      externalId: result.externalId,
    });
  } else if (user && env.AUTH_PROVIDER === 'ldap') {
    // Keep profile/role in sync with the directory on every login.
    await user.update({
      email: result.email.toLowerCase(),
      displayName: result.displayName,
      role: resolveRoleFromGroups(result.groups),
    });
  }

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Account is not active');
  }

  return { user, tokens: issueTokens(user) };
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new UnauthorizedError('Account not found');
  }
  if (user.authSource !== 'local' || !user.passwordHash) {
    throw new BadRequestError('This account signs in via LDAP/AD - its password is managed there, not here');
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Signs out every other session too - if the old password leaked, so may have its tokens.
  await user.update({ passwordHash, tokenVersion: user.tokenVersion + 1 });
}

function verifyRefreshToken(refreshToken: string): { sub: string; ver?: number } {
  try {
    return jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string; ver?: number };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findByPk(decoded.sub);
  // A version mismatch means the token predates a logout or password change: it's revoked.
  if (!user || !user.isActive || decoded.ver !== user.tokenVersion) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  return issueTokens(user);
}

// Revokes all of the user's refresh tokens (every device), not just this browser's cookie.
// Stateless JWTs have no per-token record to delete, so the version bump is the revocation.
export async function revokeRefreshTokens(refreshToken: string): Promise<void> {
  let decoded: { sub: string; ver?: number };
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return; // already invalid - nothing to revoke
  }
  const user = await User.findByPk(decoded.sub);
  if (user && decoded.ver === user.tokenVersion) {
    await user.update({ tokenVersion: user.tokenVersion + 1 });
  }
}

