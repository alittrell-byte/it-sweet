import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import * as projectService from './projectService';
import * as projectTaskService from './projectTaskService';

export const projectRouter = Router();
projectRouter.use(authenticate, requireRole('admin', 'technician'), requirePermission('projects.view'));

const CREATE = requirePermission('projects.create');
const MANAGE = requirePermission('projects.manage');
const MANAGE_TASKS = requirePermission('projects.manage_tasks');
const DELETE_TASKS = requirePermission('projects.delete_tasks');

const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const;
const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
const MEMBER_ROLES = ['lead', 'contributor', 'reviewer'] as const;

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  ownerId: z.string().uuid(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  startDate: z.string().nullable().optional(),
  targetEndDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
});
const updateProjectSchema = createProjectSchema.partial();

const listFilterSchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  // "My Projects" (owner or has an assigned task) / admin "view as" - not restricted to the
  // caller's own id server-side, since anyone with projects.view can already see every project's
  // owner/assignees unfiltered; the admin-only picker is purely a frontend affordance.
  involvesUserId: z.string().uuid().optional(),
});

projectRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = listFilterSchema.parse(req.query);
    res.json(await projectService.listProjects(filter));
  })
);

projectRouter.post(
  '/',
  CREATE,
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    res.status(201).json(await projectService.createProject(input));
  })
);

projectRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await projectService.getProject(req.params.id));
  })
);

projectRouter.patch(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = updateProjectSchema.parse(req.body);
    res.json(await projectService.updateProject(req.params.id, input));
  })
);

projectRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    await projectService.deleteProject(req.params.id);
    res.status(204).send();
  })
);

// --- Members ---

const addMemberSchema = z.object({ userId: z.string().uuid(), role: z.enum(MEMBER_ROLES).optional() });
const updateMemberSchema = z.object({ role: z.enum(MEMBER_ROLES) });

projectRouter.post(
  '/:id/members',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = addMemberSchema.parse(req.body);
    res.status(201).json(await projectService.addMember(req.params.id, input));
  })
);

projectRouter.patch(
  '/:id/members/:memberId',
  MANAGE,
  asyncHandler(async (req, res) => {
    const { role } = updateMemberSchema.parse(req.body);
    res.json(await projectService.updateMemberRole(req.params.id, req.params.memberId, role));
  })
);

projectRouter.delete(
  '/:id/members/:memberId',
  MANAGE,
  asyncHandler(async (req, res) => {
    await projectService.removeMember(req.params.id, req.params.memberId);
    res.status(204).send();
  })
);

// --- Project-level ticket/asset linking ---

projectRouter.post(
  '/:id/tickets',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    const { ticketId } = z.object({ ticketId: z.number().int() }).parse(req.body);
    await projectService.linkTicket(req.params.id, ticketId);
    res.status(204).send();
  })
);

projectRouter.delete(
  '/:id/tickets/:ticketId',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    await projectService.unlinkTicket(req.params.id, Number(req.params.ticketId));
    res.status(204).send();
  })
);

projectRouter.post(
  '/:id/assets',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    const { assetId } = z.object({ assetId: z.string().uuid() }).parse(req.body);
    await projectService.linkAsset(req.params.id, assetId);
    res.status(204).send();
  })
);

projectRouter.delete(
  '/:id/assets/:assetId',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    await projectService.unlinkAsset(req.params.id, req.params.assetId);
    res.status(204).send();
  })
);

// --- Tasks ---

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: z.string().nullable().optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
});
const updateTaskSchema = createTaskSchema.partial();
const moveTaskSchema = z.object({ status: z.enum(TASK_STATUSES), position: z.number().int().min(0) });
const dependencySchema = z.object({ dependsOnTaskId: z.string().uuid() });
const linkTicketToTaskSchema = z.object({ ticketId: z.number().int() });

projectRouter.get(
  '/:id/tasks',
  asyncHandler(async (req, res) => {
    res.json(await projectTaskService.listTasks(req.params.id));
  })
);

projectRouter.post(
  '/:id/tasks',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    const input = createTaskSchema.parse(req.body);
    res.status(201).json(await projectTaskService.createTask(req.params.id, input));
  })
);

projectRouter.patch(
  '/:id/tasks/:taskId',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    const input = updateTaskSchema.parse(req.body);
    res.json(await projectTaskService.updateTask(req.params.id, req.params.taskId, input));
  })
);

projectRouter.delete(
  '/:id/tasks/:taskId',
  DELETE_TASKS,
  asyncHandler(async (req, res) => {
    await projectTaskService.deleteTask(req.params.id, req.params.taskId);
    res.status(204).send();
  })
);

projectRouter.post(
  '/:id/tasks/:taskId/move',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    const input = moveTaskSchema.parse(req.body);
    res.json(await projectTaskService.moveTask(req.params.id, req.params.taskId, input));
  })
);

projectRouter.get(
  '/:id/tasks/:taskId/dependencies',
  asyncHandler(async (req, res) => {
    res.json(await projectTaskService.listDependencies(req.params.id, req.params.taskId));
  })
);

projectRouter.post(
  '/:id/tasks/:taskId/dependencies',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    const { dependsOnTaskId } = dependencySchema.parse(req.body);
    await projectTaskService.addDependency(req.params.id, req.params.taskId, dependsOnTaskId);
    res.status(204).send();
  })
);

projectRouter.delete(
  '/:id/tasks/:taskId/dependencies/:dependsOnTaskId',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    await projectTaskService.removeDependency(req.params.id, req.params.taskId, req.params.dependsOnTaskId);
    res.status(204).send();
  })
);

projectRouter.post(
  '/:id/tasks/:taskId/spawn-ticket',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    res.status(201).json(await projectTaskService.spawnTicketFromTask(req.params.id, req.params.taskId, req.user!));
  })
);

projectRouter.post(
  '/:id/tasks/:taskId/link-ticket',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    const { ticketId } = linkTicketToTaskSchema.parse(req.body);
    res.json(await projectTaskService.linkExistingTicketToTask(req.params.id, req.params.taskId, ticketId));
  })
);

projectRouter.delete(
  '/:id/tasks/:taskId/link-ticket',
  MANAGE_TASKS,
  asyncHandler(async (req, res) => {
    res.json(await projectTaskService.unlinkTicketFromTask(req.params.id, req.params.taskId));
  })
);
