import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import * as authController from './authController';
import { authenticate } from './middleware';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(authController.register));
authRouter.post('/login', asyncHandler(authController.login));
authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
authRouter.patch('/change-password', authenticate, asyncHandler(authController.changePassword));
