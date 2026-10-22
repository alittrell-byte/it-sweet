import { fn, col, Op } from 'sequelize';
import { NotFoundError, BadRequestError } from '../../common/errors';
import { storageProvider } from '../../common/storage';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Ticket } from '../tickets/ticket.model';
import { Asset } from '../assets/asset.model';
import { Project, ProjectPriority, ProjectStatus } from './project.model';
import { ProjectTask } from './projectTask.model';
import { ProjectMember, ProjectMemberRole } from './projectMember.model';
import { ProjectTicketLink } from './projectTicketLink.model';
import { ProjectAssetLink } from './projectAssetLink.model';
import { ProjectAttachment } from './projectAttachment.model';
import { ProjectMilestone } from './projectMilestone.model';
import { ProjectTemplate } from './projectTemplate.model';
import { ProjectTemplateTask } from './projectTemplateTask.model';

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  ownerId: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: string | null;
  targetEndDate?: string | null;
  actualEndDate?: string | null;
  parentProjectId?: string | null;
  /** Instantiates the project's tasks from this template - create-only, not an updatable field. */
  templateId?: string;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, 'templateId'>>;

// Walks up from proposedParentId through its own ancestors - if projectId is reached, setting
// projectId's parent to proposedParentId would close a cycle. No existing pattern to copy here:
// KnowledgeBaseCategory has the same self-referencing shape but no cycle-check at all.
async function wouldCreateProjectCycle(projectId: string, proposedParentId: string): Promise<boolean> {
  if (projectId === proposedParentId) return true;
  let current: string | null = proposedParentId;
  const visited = new Set<string>();
  while (current) {
    if (current === projectId) return true;
    if (visited.has(current)) break; // guards against pre-existing bad data looping forever
    visited.add(current);
    const parent: Project | null = await Project.findByPk(current, { attributes: ['parentProjectId'] });
    current = parent?.parentProjectId ?? null;
  }
  return false;
}

// Templates have no absolute dates - relativeDueDays counts from the new project's own start date.
function computeDueDateFromTemplate(startDate: string | null, relativeDueDays: number | null): string | null {
  if (!startDate || relativeDueDays === null || relativeDueDays === undefined) return null;
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + relativeDueDays);
  return date.toISOString().slice(0, 10);
}

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
  parentProjectId: string | null;
  parentProjectName: string | null;
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
    include: [
      { model: User, as: 'owner', attributes: [...PUBLIC_USER_ATTRIBUTES] },
      { model: Project, as: 'parentProject', attributes: ['id', 'name'] },
    ],
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
    const parentProject = (project as unknown as { parentProject: Project | null }).parentProject;

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
      parentProjectId: project.parentProjectId,
      parentProjectName: parentProject?.name ?? null,
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
  parentProjectId: string | null;
  parentProject: { id: string; name: string } | null;
  subProjects: Array<{ id: string; name: string; status: ProjectStatus; percentComplete: number }>;
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
      { model: Project, as: 'parentProject', attributes: ['id', 'name'] },
      {
        model: Project,
        as: 'subProjects',
        attributes: ['id', 'name', 'status'],
        include: [{ model: ProjectTask, as: 'tasks', attributes: ['percentComplete'] }],
      },
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
  const parentProject = (project as unknown as { parentProject: Project | null }).parentProject;
  const subProjects = (project as unknown as { subProjects: (Project & { tasks: ProjectTask[] })[] }).subProjects ?? [];

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
    parentProjectId: project.parentProjectId,
    parentProject: parentProject ? { id: parentProject.id, name: parentProject.name } : null,
    subProjects: subProjects.map((sp) => {
      const spTasks = sp.tasks ?? [];
      const spPercentTotal = spTasks.reduce((sum, t) => sum + t.percentComplete, 0);
      return { id: sp.id, name: sp.name, status: sp.status, percentComplete: averagePercent(spPercentTotal, spTasks.length) };
    }),
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
  if (input.parentProjectId && !(await Project.findByPk(input.parentProjectId))) {
    throw new BadRequestError('Parent project not found');
  }

  // Validated up front (before creating anything) so a bad templateId never leaves behind an
  // orphan project with no tasks.
  let templateTasks: ProjectTemplateTask[] = [];
  if (input.templateId) {
    const template = await ProjectTemplate.findByPk(input.templateId);
    if (!template) throw new BadRequestError('Project template not found');
    templateTasks = await ProjectTemplateTask.findAll({ where: { templateId: input.templateId }, order: [['position', 'ASC']] });
  }

  const { templateId, ...projectFields } = input;
  const project = await Project.create(projectFields);

  if (templateTasks.length > 0) {
    await ProjectTask.bulkCreate(
      templateTasks.map((templateTask, index) => ({
        projectId: project.id,
        title: templateTask.title,
        description: templateTask.description,
        dueDate: computeDueDateFromTemplate(project.startDate, templateTask.relativeDueDays),
        position: index,
      }))
    );
  }

  return project;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const project = await findProjectOrThrow(id);
  if (input.ownerId && !(await User.findByPk(input.ownerId))) {
    throw new BadRequestError('Owner not found');
  }
  if (input.parentProjectId) {
    if (!(await Project.findByPk(input.parentProjectId))) {
      throw new BadRequestError('Parent project not found');
    }
    if (await wouldCreateProjectCycle(id, input.parentProjectId)) {
      throw new BadRequestError('This would create a cycle in the project hierarchy');
    }
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

// --- Attachments ---

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface AddAttachmentInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export async function listAttachments(projectId: string): Promise<ProjectAttachment[]> {
  await findProjectOrThrow(projectId);
  return ProjectAttachment.findAll({
    where: { projectId },
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'uploadedBy', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
  });
}

export async function addAttachment(projectId: string, input: AddAttachmentInput, uploadedById: string): Promise<ProjectAttachment> {
  await findProjectOrThrow(projectId);
  if (input.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestError('Attachment exceeds the 25MB size limit');
  }
  const key = `projects/${projectId}/${Date.now()}-${input.fileName}`;
  await storageProvider.put({ key, body: input.buffer, contentType: input.mimeType });
  return ProjectAttachment.create({
    projectId,
    uploadedById,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    storageKey: key,
  });
}

export async function getAttachmentForDownload(
  projectId: string,
  attachmentId: string
): Promise<{ attachment: ProjectAttachment; buffer: Buffer }> {
  await findProjectOrThrow(projectId);
  const attachment = await ProjectAttachment.findOne({ where: { id: attachmentId, projectId } });
  if (!attachment) throw new NotFoundError('Attachment not found');
  const buffer = await storageProvider.get(attachment.storageKey);
  return { attachment, buffer };
}

export async function deleteAttachment(projectId: string, attachmentId: string): Promise<void> {
  const attachment = await ProjectAttachment.findOne({ where: { id: attachmentId, projectId } });
  if (!attachment) throw new NotFoundError('Attachment not found');
  await storageProvider.delete(attachment.storageKey);
  await attachment.destroy();
}

// --- Milestones ---

export interface CreateMilestoneInput {
  name: string;
  dueDate?: string | null;
}

export type UpdateMilestoneInput = Partial<CreateMilestoneInput> & { completed?: boolean };

export async function listMilestones(projectId: string): Promise<ProjectMilestone[]> {
  await findProjectOrThrow(projectId);
  return ProjectMilestone.findAll({ where: { projectId } });
}

export async function createMilestone(projectId: string, input: CreateMilestoneInput): Promise<ProjectMilestone> {
  await findProjectOrThrow(projectId);
  return ProjectMilestone.create({ projectId, name: input.name, dueDate: input.dueDate ?? null });
}

export async function updateMilestone(projectId: string, milestoneId: string, input: UpdateMilestoneInput): Promise<ProjectMilestone> {
  const milestone = await ProjectMilestone.findOne({ where: { id: milestoneId, projectId } });
  if (!milestone) throw new NotFoundError('Milestone not found');
  const { completed, ...fields } = input;
  const completedAt = completed === undefined ? undefined : completed ? new Date() : null;
  await milestone.update({ ...fields, ...(completedAt !== undefined ? { completedAt } : {}) });
  return milestone;
}

export async function deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
  const milestone = await ProjectMilestone.findOne({ where: { id: milestoneId, projectId } });
  if (!milestone) throw new NotFoundError('Milestone not found');
  await milestone.destroy();
}
