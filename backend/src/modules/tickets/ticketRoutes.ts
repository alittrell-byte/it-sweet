import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import * as ticketController from './ticketController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const STAFF = requireRole('admin', 'technician');

export const ticketRouter = Router();
ticketRouter.use(authenticate);

ticketRouter.get('/dashboard', STAFF, requirePermission('tickets.view_dashboard'), asyncHandler(ticketController.dashboard));

// Bulk routes must be registered before '/:id/...' routes below - '/bulk/status' and
// '/:id/status' are the same shape, and Express resolves whichever route was registered first.
ticketRouter.patch('/bulk/status', STAFF, asyncHandler(ticketController.bulkStatus));
ticketRouter.patch('/bulk/assign', STAFF, asyncHandler(ticketController.bulkAssign));
ticketRouter.patch('/bulk/tags', STAFF, asyncHandler(ticketController.bulkTags));
ticketRouter.patch('/bulk/team', STAFF, asyncHandler(ticketController.bulkTeam));

ticketRouter.post('/', asyncHandler(ticketController.create));
ticketRouter.get('/', asyncHandler(ticketController.list));
ticketRouter.get('/:id', asyncHandler(ticketController.get));

ticketRouter.get('/:id/comments', asyncHandler(ticketController.listComments));
ticketRouter.post('/:id/comments', asyncHandler(ticketController.addComment));

ticketRouter.patch('/:id/status', STAFF, asyncHandler(ticketController.changeStatus));
ticketRouter.patch('/:id/assign', STAFF, asyncHandler(ticketController.assign));
ticketRouter.patch('/:id/team', STAFF, asyncHandler(ticketController.setTeam));
ticketRouter.patch('/:id/tags', STAFF, asyncHandler(ticketController.setTags));

ticketRouter.patch('/:id/approve', STAFF, requirePermission('tickets.approve'), asyncHandler(ticketController.approve));
ticketRouter.patch('/:id/reject', STAFF, requirePermission('tickets.approve'), asyncHandler(ticketController.reject));

ticketRouter.post('/:id/escalate', STAFF, asyncHandler(ticketController.escalate));

ticketRouter.post('/:id/watchers', asyncHandler(ticketController.addWatcher));
ticketRouter.delete('/:id/watchers/:userId', asyncHandler(ticketController.removeWatcher));

ticketRouter.get('/:id/attachments', asyncHandler(ticketController.listAttachments));
ticketRouter.post('/:id/attachments', upload.single('file'), asyncHandler(ticketController.uploadAttachment));
ticketRouter.get('/:id/attachments/:attachmentId', asyncHandler(ticketController.downloadAttachment));

ticketRouter.post('/:id/assets', STAFF, asyncHandler(ticketController.linkAsset));
ticketRouter.delete('/:id/assets/:assetId', STAFF, asyncHandler(ticketController.unlinkAsset));

ticketRouter.post('/:id/kb-articles', STAFF, asyncHandler(ticketController.linkArticle));
ticketRouter.delete('/:id/kb-articles/:articleId', STAFF, asyncHandler(ticketController.unlinkArticle));

ticketRouter.get('/:id/time-entries', STAFF, asyncHandler(ticketController.listTimeEntries));
ticketRouter.post('/:id/time-entries', STAFF, asyncHandler(ticketController.logTime));
ticketRouter.delete('/:id/time-entries/:entryId', STAFF, asyncHandler(ticketController.deleteTimeEntry));

ticketRouter.post('/:id/survey', asyncHandler(ticketController.submitSurvey));
ticketRouter.get('/:id/survey', asyncHandler(ticketController.getSurvey));
