import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { NotFoundError } from '../../common/errors';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { NotificationGroup } from './notificationGroup.model';

export const notificationGroupRouter = Router();
notificationGroupRouter.use(authenticate, requireRole('admin', 'technician'));

const MANAGE = requirePermission('notifications.manage_groups');

const createSchema = z.object({
  name: z.string().min(1).max(150),
  notifyOnNewTicket: z.boolean().default(true),
  notifyOnLicenseOverage: z.boolean().default(false),
  notifyOnContractRenewal: z.boolean().default(false),
});
const toggleSchema = z.object({
  notifyOnNewTicket: z.boolean().optional(),
  notifyOnLicenseOverage: z.boolean().optional(),
  notifyOnContractRenewal: z.boolean().optional(),
});
const memberSchema = z.object({ userId: z.string().uuid() });

// Any staff user can see the list of groups (needed for pickers elsewhere, e.g. the log
// alert-rules "notify group" field) - only creating/editing groups and managing membership
// requires notifications.manage_groups (same "read open, write gated" shape as Teams/Vendors).
notificationGroupRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(
      await NotificationGroup.findAll({
        include: [{ model: User, as: 'members', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
        order: [['name', 'ASC']],
      })
    );
  })
);

notificationGroupRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    res.status(201).json(await NotificationGroup.create(input));
  })
);

notificationGroupRouter.patch(
  '/:id/toggle',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = toggleSchema.parse(req.body);
    const group = await NotificationGroup.findByPk(req.params.id);
    if (!group) throw new NotFoundError('Notification group not found');
    await group.update(input);
    res.json(group);
  })
);

notificationGroupRouter.post(
  '/:id/members',
  MANAGE,
  asyncHandler(async (req, res) => {
    const { userId } = memberSchema.parse(req.body);
    const group = await NotificationGroup.findByPk(req.params.id);
    if (!group) throw new NotFoundError('Notification group not found');
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    await (group as unknown as { addMember: (u: User) => Promise<void> }).addMember(user);
    res.status(204).send();
  })
);

notificationGroupRouter.delete(
  '/:id/members/:userId',
  MANAGE,
  asyncHandler(async (req, res) => {
    const group = await NotificationGroup.findByPk(req.params.id);
    if (!group) throw new NotFoundError('Notification group not found');
    const user = await User.findByPk(req.params.userId);
    if (!user) throw new NotFoundError('User not found');
    await (group as unknown as { removeMember: (u: User) => Promise<void> }).removeMember(user);
    res.status(204).send();
  })
);
