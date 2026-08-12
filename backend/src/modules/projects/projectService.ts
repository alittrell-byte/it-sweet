import { fn, col, Op } from 'sequelize';
import { NotFoundError, BadRequestError } from '../../common/errors';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Ticket } from '../tickets/ticket.model';
import { Asset } from '../assets/asset.model';
import { Project, ProjectPriority, ProjectStatus } from './project.model';
import { ProjectTask } from './projectTask.model';
import { ProjectMember, ProjectMemberRole } from './projectMember.model';
import { ProjectTicketLink } from './projectTicketLink.model';
import { ProjectAssetLink } from './projectAssetLink.model';

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  ownerId: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: string | null;
  targetEndDate?: string | null;
  actualEndDate?: string | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface ProjectListFilter {
  status?: ProjectStatus;
  priority?: ProjectPriority;
  /** Only projects this user owns, or has at least one task assigned to them in. */
  involvesUserId?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: { id: string; displayName: string; email: string } | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  percentComplete: number;
  taskCount: number;
  ticketCount: number;
  openTicketCount: number;
  assetCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Average of every task's percentComplete in the project, 0 tasks -> 0%. Simple average is the
// right amount of rigor for a P0 "basic" rollup - weighting by effort/estimate is P1 backlog.
export function averagePercent(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

const OPEN_TICKET_STATUSES = new Set(['new', 'in_progress', 'waiting']);

// Runs a fixed 4 queries regardless of project count, instead of N+1 per-project lookups -
// mirrors the aggregate-query style already used by logSearchService/articleService.
export async function listProjects(filter: ProjectListFilter = {}): Promise<ProjectSummary[]> {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.priority) where.priority = filter.priority;

  if (filter.involvesUserId) {
    // Two cheap id-only lookups + a Set union in JS, rather than a cross-table OR subquery -
    // keeps this portable across the Postgres/MySQL dialect split the rest of the app maintains.
    const [ownedProjects, assignedTasks] = await Promise.all([
      Project.findAll({ where: { ownerId: filter.involvesUserId }, attributes: ['id'] }),
      ProjectTask.findAll({ where: { assigneeId: filter.involvesUserId }, attributes: ['projectId'] }),
    ]);
    const involvedIds = new Set<string>([...ownedProjects.map((p) => p.id), ...assignedTasks.map((t) => t.projectId)]);
    where.id = { [Op.in]: Array.from(involvedIds) };
  }

  const projects = await Project.findAll({
    where,
    include: [{ model: User, as: 'owner', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
    order: [['createdAt', 'DESC']],
  });

  const taskStats = (await ProjectTask.findAll({
    attributes: ['projectId', [fn('AVG', col('percent_complete')), 'avgPercent'], [fn('COUNT', col('id')), 'taskCount']],
    group: ['project_id'],
    raw: true,
  })) as unknown as Array<{ projectId: string; avgPercent: string | null; taskCount: string }>;
  const taskStatsByProject = new Map(taskStats.map((row) => [row.projectId, row]));

  const assetCounts = (await ProjectAssetLink.findAll({
    attributes: ['projectId', [fn('COUNT', col('asset_id')), 'assetCount']],
    group: ['project_id'],
    raw: true,
  })) as unknown as Array<{ projectId: string; assetCount: string }>;
  const assetCountByProject = new Map(assetCounts.map((row) => [row.projectId, Number(row.assetCount)]));

  const ticketLinks = await ProjectTicketLink.findAll({
    include: [{ model: Ticket, as: 'ticket', attributes: ['id', 'status'] }],
  });
  const ticketStatsByProject = new Map<string, { ticketCount: number; openTicketCount: number }>();
  for (const link of ticketLinks) {
    const ticket = (link as unknown as { ticket: Ticket }).ticket;
    if (!ticket) continue;
    const entry = ticketStatsByProject.get(link.projectId) ?? { ticketCount: 0, openTicketCount: 0 };
    entry.ticketCount += 1;
    if (OPEN_TICKET_STATUSES.has(ticket.status)) entry.openTicketCount += 1;
    ticketStatsByProject.set(link.projectId, entry);
  }

  return projects.map((project) => {
    const stats = taskStatsByProject.get(project.id);
    const taskCount = stats ? Number(stats.taskCount) : 0;
    const avgPercent = stats?.avgPercent ? Number(stats.avgPercent) : 0;
    const ticketStats = ticketStatsByProject.get(project.id) ?? { ticketCount: 0, openTicketCount: 0 };
    const owner = (project as unknown as { owner: User | null }).owner;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      owner: owner ? { id: owner.id, displayName: owner.displayName, email: owner.email } : null,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      targetEndDate: project.targetEndDate,
      actualEndDate: project.actualEndDate,
      percentComplete: averagePercent(avgPercent * taskCount, taskCount),
      taskCount,
      ticketCount: ticketStats.ticketCount,
      openTicketCount: ticketStats.openTicketCount,
      assetCount: assetCountByProject.get(project.id) ?? 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  });
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: { id: string; displayName: string; email: string } | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  percentComplete: number;
  taskCounts: { todo: number; inProgress: number; done: number };
  members: Array<{ id: string; role: ProjectMemberRole; user: { id: string; displayName: string; email: string } }>;
  linkedTickets: Array<{ id: number; subject: string; status: string; priority: string }>;
  linkedAssets: Array<{ id: string; name: string; type: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export async function findProjectOrThrow(id: string): Promise<Project> {
  const project = await Project.findByPk(id);
  if (!project) throw new NotFoundError('Project not found');
  return project;
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const project = await Project.findByPk(id, {
    include: [
      { model: User, as: 'owner', attributes: [...PUBLIC_USER_ATTRIBUTES] },
      { model: ProjectTask, as: 'tasks', attributes: ['id', 'status', 'percentComplete'] },
      { model: ProjectMember, as: 'members', include: [{ model: User, as: 'user', attributes: [...PUBLIC_USER_ATTRIBUTES] }] },
      { model: Ticket, as: 'linkedTickets', attributes: ['id', 'subject', 'status', 'priority'], through: { attributes: [] } },
      { model: Asset, as: 'linkedAssets', attributes: ['id', 'name', 'type'], through: { attributes: [] } },
    ],
  });
  if (!project) throw new NotFoundError('Project not found');

  const tasks = (project as unknown as { tasks: ProjectTask[] }).tasks ?? [];
  const taskCounts = { todo: 0, inProgress: 0, done: 0 };
  let percentTotal = 0;
  for (const task of tasks) {
    if (task.status === 'todo') taskCounts.todo += 1;
    else if (task.status === 'in_progress') taskCounts.inProgress += 1;
    else taskCounts.done += 1;
    percentTotal += task.percentComplete;
  }

  const owner = (project as unknown as { owner: User | null }).owner;
  const members = (project as unknown as { members: (ProjectMember & { user: User })[] }).members ?? [];
  const linkedTickets = (project as unknown as { linkedTickets: Ticket[] }).linkedTickets ?? [];
  const linkedAssets = (project as unknown as { linkedAssets: Asset[] }).linkedAssets ?? [];

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    ownerId: project.ownerId,
    owner: owner ? { id: owner.id, displayName: owner.displayName, email: owner.email } : null,
    status: project.status,
    priority: project.priority,
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    actualEndDate: project.actualEndDate,
    percentComplete: averagePercent(percentTotal, tasks.length),
    taskCounts,
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      user: { id: m.user.id, displayName: m.user.displayName, email: m.user.email },
    })),
    linkedTickets: linkedTickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, priority: t.priority })),
    linkedAssets: linkedAssets.map((a) => ({ id: a.id, name: a.name, type: a.type })),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const owner = await User.findByPk(input.ownerId);
  if (!owner) throw new BadRequestError('Owner not found');
  return Project.create(input);
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const project = await findProjectOrThrow(id);
  if (input.ownerId && !(await User.findByPk(input.ownerId))) {
    throw new BadRequestError('Owner not found');
  }
  await project.update(input);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const project = await findProjectOrThrow(id);
  await project.destroy();
}

// --- Membership ---

export interface AddMemberInput {
  userId: string;
  role?: ProjectMemberRole;
}

export async function addMember(projectId: string, input: AddMemberInput): Promise<ProjectMember> {
  await findProjectOrThrow(projectId);
  const user = await User.findByPk(input.userId);
  if (!user) throw new BadRequestError('User not found');

  const existing = await ProjectMember.findOne({ where: { projectId, userId: input.userId } });
  if (existing) throw new BadRequestError('This user is already a member of the project');

  return ProjectMember.create({ projectId, userId: input.userId, role: input.role ?? 'contributor' });
}

export async function updateMemberRole(projectId: string, memberId: string, role: ProjectMemberRole): Promise<ProjectMember> {
  const member = await ProjectMember.findOne({ where: { id: memberId, projectId } });
  if (!member) throw new NotFoundError('Project member not found');
  await member.update({ role });
  return member;
}

export async function removeMember(projectId: string, memberId: string): Promise<void> {
  const member = await ProjectMember.findOne({ where: { id: memberId, projectId } });
  if (!member) throw new NotFoundError('Project member not found');
  await member.destroy();
}

// --- Ticket linking ---

export async function linkTicket(projectId: string, ticketId: number): Promise<void> {
  await findProjectOrThrow(projectId);
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) throw new BadRequestError('Ticket not found');
  await ProjectTicketLink.findOrCreate({ where: { projectId, ticketId } });
}

export async function unlinkTicket(projectId: string, ticketId: number): Promise<void> {
  await ProjectTicketLink.destroy({ where: { projectId, ticketId } });
}

// --- Asset linking ---

export async function linkAsset(projectId: string, assetId: string): Promise<void> {
  await findProjectOrThrow(projectId);
  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new BadRequestError('Asset not found');
  await ProjectAssetLink.findOrCreate({ where: { projectId, assetId } });
}

export async function unlinkAsset(projectId: string, assetId: string): Promise<void> {
  await ProjectAssetLink.destroy({ where: { projectId, assetId } });
}
