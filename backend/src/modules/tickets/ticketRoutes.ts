import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import * as ticketController from './ticketController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const ticketRouter = Router();
ticketRouter.use(authenticate);

ticketRouter.get(
  '/dashboard',
  requireRole('admin', 'technician'),
  requirePermission('tickets.view_dashboard'),
  asyncHandler(ticketController.dashboard)
);

ticketRouter.post('/', asyncHandler(ticketController.create));
ticketRouter.get('/', asyncHandler(ticketController.list));
ticketRouter.get('/:id', asyncHandler(ticketController.get));

ticketRouter.get('/:id/comments', asyncHandler(ticketController.listComments));
ticketRouter.post('/:id/comments', asyncHandler(ticketController.addComment));

ticketRouter.patch('/:id/status', requireRole('admin', 'technician'), asyncHandler(ticketController.changeStatus));
ticketRouter.patch('/:id/assign', requireRole('admin', 'technician'), asyncHandler(ticketController.assign));

ticketRouter.post('/:id/watchers', asyncHandler(ticketController.addWatcher));
ticketRouter.delete('/:id/watchers/:userId', asyncHandler(ticketController.removeWatcher));

ticketRouter.post('/:id/attachments', upload.single('file'), asyncHandler(ticketController.uploadAttachment));
ticketRouter.get('/:id/attachments/:attachmentId', asyncHandler(ticketController.downloadAttachment));

ticketRouter.post('/:id/assets', requireRole('admin', 'technician'), asyncHandler(ticketController.linkAsset));
ticketRouter.delete('/:id/assets/:assetId', requireRole('admin', 'technician'), asyncHandler(ticketController.unlinkAsset));
