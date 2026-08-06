import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission, requireRole } from './middleware';
import { PERMISSION_CATALOG } from './permissionCatalog';
import { User } from './user.model';
import * as userManagementService from './userManagementService';

export const usersRouter = Router();
usersRouter.use(authenticate, requireRole('admin', 'technician'));

// Never let a User model instance's password hash (or LDAP externalId) leak into a response.
function sanitizeUser(user: User) {
  const { id, email, displayName, role, isActive, rank, isSuperAdmin, authSource, createdAt, updatedAt } = user.toJSON();
  return { id, email, displayName, role, isActive, rank, isSuperAdmin, authSource, createdAt, updatedAt };
}

usersRouter.get(
  '/permission-catalog',
  asyncHandler(async (_req, res) => {
    res.json(PERMISSION_CATALOG);
  })
);

// Lightweight directory (id/email/displayName/role/isActive only) used by things like the
// ticket-assignment dropdown - any staff member can browse it, no fine-grained permission
// needed since it exposes nothing sensitive.
usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const role = req.query.role as string | undefined;
    const where = role ? { role } : {};
    const users = await User.findAll({
      where,
      attributes: ['id', 'email', 'displayName', 'role', 'isActive', 'rank', 'isSuperAdmin'],
      order: [['displayName', 'ASC']],
    });
    res.json(users);
  })
);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
  role: z.enum(['admin', 'technician', 'customer']),
});

usersRouter.post(
  '/',
  requirePermission('users.create'),
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const user = await userManagementService.createUser(input);
    res.status(201).json(sanitizeUser(user));
  })
);

usersRouter.get(
  '/:id',
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const { user, permissions } = await userManagementService.getUserWithPermissions(req.params.id);
    res.json({ ...sanitizeUser(user), permissions });
  })
);

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(['admin', 'technician', 'customer']).optional(),
  isActive: z.boolean().optional(),
});

usersRouter.patch(
  '/:id',
  requirePermission('users.edit'),
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const user = await userManagementService.updateUser(req.params.id, input, req.user!);
    res.json(sanitizeUser(user));
  })
);

usersRouter.delete(
  '/:id',
  requirePermission('users.delete'),
  asyncHandler(async (req, res) => {
    await userManagementService.deleteUser(req.params.id, req.user!);
    res.status(204).send();
  })
);

const permissionsSchema = z.object({ permissionKeys: z.array(z.string()) });

usersRouter.put(
  '/:id/permissions',
  requirePermission('users.manage_permissions'),
  asyncHandler(async (req, res) => {
    const { permissionKeys } = permissionsSchema.parse(req.body);
    await userManagementService.setUserPermissions(req.params.id, permissionKeys, req.user!);
    res.status(204).send();
  })
);

const resetPasswordSchema = z.object({ newPassword: z.string().min(8) });

usersRouter.patch(
  '/:id/password',
  requirePermission('users.edit'),
  asyncHandler(async (req, res) => {
    const { newPassword } = resetPasswordSchema.parse(req.body);
    await userManagementService.resetUserPassword(req.params.id, newPassword, req.user!);
    res.status(204).send();
  })
);

const rankSchema = z.object({ rank: z.number().int().min(0).optional(), isSuperAdmin: z.boolean().optional() });

usersRouter.patch(
  '/:id/rank',
  asyncHandler(async (req, res) => {
    const input = rankSchema.parse(req.body);
    const user = await userManagementService.setUserRank(req.params.id, input, req.user!);
    res.json(sanitizeUser(user));
  })
);
