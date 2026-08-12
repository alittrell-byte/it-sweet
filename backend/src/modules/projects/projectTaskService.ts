import { sequelize } from '../../db/sequelize';
import { NotFoundError, BadRequestError } from '../../common/errors';
import { AccessTokenPayload } from '../auth/authService';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Ticket } from '../tickets/ticket.model';
import * as ticketService from '../tickets/ticketService';
import { findProjectOrThrow } from './projectService';
import { ProjectTask, ProjectTaskStatus } from './projectTask.model';
import { ProjectTaskDependency } from './projectTaskDependency.model';
import { ProjectTicketLink } from './projectTicketLink.model';

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  status?: ProjectTaskStatus;
  dueDate?: string | null;
  percentComplete?: number;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

const TASK_INCLUDES = [{ model: User, as: 'assignee', attributes: [...PUBLIC_USER_ATTRIBUTES] }];

export async function listTasks(projectId: string): Promise<ProjectTask[]> {
  await findProjectOrThrow(projectId);
  return ProjectTask.findAll({
    where: { projectId },
    include: TASK_INCLUDES,
    order: [['status', 'ASC'], ['position', 'ASC']],
  });
}

export async function findTaskOrThrow(projectId: string, taskId: string): Promise<ProjectTask> {
  const task = await ProjectTask.findOne({ where: { id: taskId, projectId } });
  if (!task) throw new NotFoundError('Task not found');
  return task;
}

export async function createTask(projectId: string, input: CreateTaskInput): Promise<ProjectTask> {
  await findProjectOrThrow(projectId);
  if (input.assigneeId && !(await User.findByPk(input.assigneeId))) {
    throw new BadRequestError('Assignee not found');
  }
  const status = input.status ?? 'todo';
  const position = await ProjectTask.count({ where: { projectId, status } });
  const task = await ProjectTask.create({ ...input, projectId, status, position });
  await task.reload({ include: TASK_INCLUDES });
  return task;
}

// A task moving TO 'done' always lands at 100%, regardless of what the client sent - otherwise a
// "done" task can sit below 100 and drag the project rollup down in a way that looks like a bug.
// Moving a task OFF 'done' intentionally leaves percentComplete as-is (no reset to 0).
export function normalizePercentForStatus(
  status: ProjectTaskStatus | undefined,
  percentComplete: number | undefined,
  current: { status: ProjectTaskStatus; percentComplete: number }
): number {
  const nextStatus = status ?? current.status;
  if (nextStatus === 'done') return 100;
  return percentComplete ?? current.percentComplete;
}

export async function updateTask(projectId: string, taskId: string, input: UpdateTaskInput): Promise<ProjectTask> {
  const task = await findTaskOrThrow(projectId, taskId);
  if (input.assigneeId && !(await User.findByPk(input.assigneeId))) {
    throw new BadRequestError('Assignee not found');
  }
  if (input.status && input.status !== 'todo' && input.status !== task.status) {
    await assertDependenciesSatisfied(task.id);
  }
  const percentComplete = normalizePercentForStatus(input.status, input.percentComplete, task);
  await task.update({ ...input, percentComplete });
  await task.reload({ include: TASK_INCLUDES });
  return task;
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  const task = await findTaskOrThrow(projectId, taskId);
  await task.destroy();
}

// --- Dependencies ---

async function assertDependenciesSatisfied(taskId: string): Promise<void> {
  const deps = await ProjectTaskDependency.findAll({ where: { taskId } });
  if (deps.length === 0) return;
  const dependsOnTasks = await ProjectTask.findAll({ where: { id: deps.map((d) => d.dependsOnTaskId) } });
  const unfinished = dependsOnTasks.filter((t) => t.status !== 'done');
  if (unfinished.length > 0) {
    throw new BadRequestError(
      `Cannot start this task until its dependencies are complete: ${unfinished.map((t) => t.title).join(', ')}`
    );
  }
}

// Walks the dependency graph from dependsOnTaskId through ITS OWN dependencies - if taskId is
// reachable, adding taskId -> dependsOnTaskId would close a cycle. Cheap at the
// dozens-of-tasks-per-project scale this is built for (O(V+E)).
async function wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = await ProjectTaskDependency.findAll({ where: { taskId: current }, attributes: ['dependsOnTaskId'] });
    for (const dep of deps) stack.push(dep.dependsOnTaskId);
  }
  return false;
}

export async function addDependency(projectId: string, taskId: string, dependsOnTaskId: string): Promise<void> {
  if (taskId === dependsOnTaskId) throw new BadRequestError('A task cannot depend on itself');

  const task = await findTaskOrThrow(projectId, taskId);
  const dependsOnTask = await findTaskOrThrow(projectId, dependsOnTaskId);
  // findTaskOrThrow already scopes both lookups to projectId, so a cross-project dependency
  // fails as a 404 on the second lookup rather than needing a separate explicit check.
  void dependsOnTask;

  const existing = await ProjectTaskDependency.findOne({ where: { taskId, dependsOnTaskId } });
  if (existing) throw new BadRequestError('This dependency already exists');

  if (await wouldCreateCycle(taskId, dependsOnTaskId)) {
    throw new BadRequestError('This dependency would create a cycle');
  }

  await ProjectTaskDependency.create({ taskId: task.id, dependsOnTaskId });
}

export async function removeDependency(projectId: string, taskId: string, dependsOnTaskId: string): Promise<void> {
  await findTaskOrThrow(projectId, taskId);
  await ProjectTaskDependency.destroy({ where: { taskId, dependsOnTaskId } });
}

export async function listDependencies(projectId: string, taskId: string): Promise<ProjectTask[]> {
  const task = await findTaskOrThrow(projectId, taskId);
  const deps = await ProjectTaskDependency.findAll({ where: { taskId: task.id } });
  if (deps.length === 0) return [];
  return ProjectTask.findAll({ where: { id: deps.map((d) => d.dependsOnTaskId) } });
}

// --- Board ---

export interface MoveTaskInput {
  status: ProjectTaskStatus;
  /** Index within the target column, 0-based. */
  position: number;
}

// Renumbers every task in a column 0..n-1 to match `orderedIds` - plain sequential renumbering,
// not a fractional/gap scheme, which is adequate at the dozens-of-tasks-per-project scale this
// board is built for.
async function renumberColumn(projectId: string, status: ProjectTaskStatus, orderedIds: string[], transaction: import('sequelize').Transaction) {
  await Promise.all(
    orderedIds.map((id, index) => ProjectTask.update({ position: index }, { where: { id, projectId }, transaction }))
  );
}

export async function moveTask(projectId: string, taskId: string, input: MoveTaskInput): Promise<ProjectTask> {
  const task = await findTaskOrThrow(projectId, taskId);
  if (input.status !== 'todo' && input.status !== task.status) {
    await assertDependenciesSatisfied(task.id);
  }

  return sequelize.transaction(async (transaction) => {
    const sourceStatus = task.status;
    const percentComplete = normalizePercentForStatus(input.status, undefined, task);
    await task.update({ status: input.status, percentComplete }, { transaction });

    const targetColumn = await ProjectTask.findAll({
      where: { projectId, status: input.status },
      order: [['position', 'ASC']],
      transaction,
    });
    const targetIds = targetColumn.map((t) => t.id).filter((id) => id !== task.id);
    const clampedPosition = Math.max(0, Math.min(input.position, targetIds.length));
    targetIds.splice(clampedPosition, 0, task.id);
    await renumberColumn(projectId, input.status, targetIds, transaction);

    if (sourceStatus !== input.status) {
      const sourceColumn = await ProjectTask.findAll({
        where: { projectId, status: sourceStatus },
        order: [['position', 'ASC']],
        transaction,
      });
      await renumberColumn(
        projectId,
        sourceStatus,
        sourceColumn.map((t) => t.id),
        transaction
      );
    }

    await task.reload({ include: TASK_INCLUDES, transaction });
    return task;
  });
}

// --- Ticket spawn/link ---

export async function spawnTicketFromTask(projectId: string, taskId: string, actor: AccessTokenPayload): Promise<Ticket> {
  const project = await findProjectOrThrow(projectId);
  const task = await findTaskOrThrow(projectId, taskId);
  if (task.ticketId) throw new BadRequestError('This task already has a linked ticket');

  let ticket = await ticketService.createTicket(
    {
      subject: task.title,
      description: task.description ?? `Spawned from project task "${task.title}".`,
      priority: project.priority,
    },
    actor
  );

  // assignTicket updates its own freshly-fetched instance, not this one in memory - reassign to
  // its return value so the ticket handed back here (and to the caller) reflects the assignment.
  if (task.assigneeId) {
    ticket = await ticketService.assignTicket(ticket.id, task.assigneeId, actor);
  }

  await task.update({ ticketId: ticket.id });
  await ProjectTicketLink.findOrCreate({ where: { projectId, ticketId: ticket.id } });
  return ticket;
}

export async function linkExistingTicketToTask(projectId: string, taskId: string, ticketId: number): Promise<ProjectTask> {
  await findProjectOrThrow(projectId);
  const task = await findTaskOrThrow(projectId, taskId);
  if (task.ticketId) throw new BadRequestError('This task already has a linked ticket');
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) throw new BadRequestError('Ticket not found');

  await task.update({ ticketId });
  await ProjectTicketLink.findOrCreate({ where: { projectId, ticketId } });
  return task;
}

// Only clears this task's own link - the ticket may still be linked to the project overall
// (project_tickets is the separate, authoritative "does this project touch this ticket" record;
// see projectService.ts). Unlink at the project level separately if that's also intended.
export async function unlinkTicketFromTask(projectId: string, taskId: string): Promise<ProjectTask> {
  const task = await findTaskOrThrow(projectId, taskId);
  await task.update({ ticketId: null });
  return task;
}
