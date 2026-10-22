import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { rateLimit } from '../../common/middleware/rateLimit';
import * as authController from './authController';
import { authenticate } from './middleware';

export const authRouter = Router();

// Brute-force protection. Login counts only failed attempts, keyed by IP + username, so one
// attacker can't lock a user out from everywhere and a typo-prone user isn't punished for
// successful logins. Register is capped per IP to slow mass account creation.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}|${String(req.body?.username ?? '').toLowerCase()}`,
  countWhen: (res) => res.statusCode === 401,
});
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, key: (req) => req.ip ?? 'unknown' });

authRouter.post('/register', registerLimiter, asyncHandler(authController.register));
authRouter.post('/login', loginLimiter, asyncHandler(authController.login));
authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
authRouter.patch('/change-password', authenticate, asyncHandler(authController.changePassword));
