import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import * as assetController from './assetController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const assetRouter = Router();
assetRouter.use(authenticate, requireRole('admin', 'technician'), requirePermission('assets.view'));

const ASSIGN = requirePermission('assets.assign');
const IMPORT_EXPORT = requirePermission('assets.import_export');
const CUSTOM_FIELDS = requirePermission('assets.manage_custom_fields');

assetRouter.get('/license-compliance', asyncHandler(assetController.licenseCompliance));
assetRouter.get('/export.csv', IMPORT_EXPORT, asyncHandler(assetController.exportCsv));
assetRouter.post('/import', IMPORT_EXPORT, upload.single('file'), asyncHandler(assetController.importCsv));

assetRouter.get('/custom-field-definitions', asyncHandler(assetController.listCustomFieldDefinitions));
assetRouter.post('/custom-field-definitions', CUSTOM_FIELDS, asyncHandler(assetController.createCustomFieldDefinition));
assetRouter.delete('/custom-field-definitions/:id', CUSTOM_FIELDS, asyncHandler(assetController.deleteCustomFieldDefinition));

assetRouter.get('/', asyncHandler(assetController.list));
assetRouter.post('/', requirePermission('assets.create'), asyncHandler(assetController.create));
assetRouter.get('/:id', asyncHandler(assetController.get));
assetRouter.patch('/:id', requirePermission('assets.edit'), asyncHandler(assetController.update));
assetRouter.delete('/:id', requirePermission('assets.delete'), asyncHandler(assetController.remove));

assetRouter.get('/:id/history', asyncHandler(assetController.history));
assetRouter.get('/:id/tickets', asyncHandler(assetController.linkedTickets));
assetRouter.post('/:id/assign', ASSIGN, asyncHandler(assetController.assign));
assetRouter.post('/:id/checkout', ASSIGN, asyncHandler(assetController.checkout));
assetRouter.post('/:id/checkin', ASSIGN, asyncHandler(assetController.checkin));
