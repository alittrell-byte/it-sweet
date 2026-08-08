import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { storageProvider } from '../../common/storage';
import { AccessTokenPayload } from '../auth/authService';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Asset } from '../assets/asset.model';
import { KnowledgeBaseArticle } from '../knowledge-base/article.model';
import { Ticket, TicketPriority, TicketStatus } from './ticket.model';
import { TicketComment } from './ticketComment.model';
import { TicketAttachment } from './ticketAttachment.model';
import { TicketStatusHistory } from './ticketStatusHistory.model';
import { TicketWatcher } from './ticketWatcher.model';
import { TicketTemplate } from './ticketTemplate.model';
import { TicketTimeEntry } from './ticketTimeEntry.model';
import { TicketSatisfactionSurvey } from './ticketSatisfactionSurvey.model';
import { Team } from './team.model';
import { TicketEscalationHistory } from './ticketEscalationHistory.model';
import { Tag } from './tag.model';
import { computeSlaDueDates, isBreached } from './sla';
import * as notify from './notify';

const VALID_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'];

function assertCanAccessTicket(ticket: Ticket, actor: AccessTokenPayload): void {
  if (actor.role === 'customer' && ticket.requesterId !== actor.sub) {
    throw new ForbiddenError('You do not have access to this ticket');
  }
}

const TICKET_INCLUDES = [
  { model: User, as: 'requester', attributes: [...PUBLIC_USER_ATTRIBUTES] },
  { model: User, as: 'assignee', attributes: [...PUBLIC_USER_ATTRIBUTES] },
  { model: Team, as: 'team' },
  { model: TicketTemplate, as: 'sourceTemplate' },
  { model: Tag, as: 'tags' },
];

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  category?: string;
  teamId?: string;
  sourceTemplateId?: string;
  requiresApproval?: boolean;
}

export async function createTicket(input: CreateTicketInput, actor: AccessTokenPayload): Promise<Ticket> {
  if (input.teamId && !(await Team.findByPk(input.teamId))) {
    throw new BadRequestError('Team not found');
  }
  if (input.sourceTemplateId && !(await TicketTemplate.findByPk(input.sourceTemplateId))) {
    throw new BadRequestError('Ticket template not found');
  }

  const { responseDueAt, resolutionDueAt } = computeSlaDueDates(input.priority);
  const requiresApproval = input.requiresApproval ?? false;
  const status: TicketStatus = requiresApproval ? 'pending_approval' : 'new';

  const ticket = await Ticket.create({
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    category: input.category ?? null,
    teamId: input.teamId ?? null,
    sourceTemplateId: input.sourceTemplateId ?? null,
    requiresApproval,
    approvalStatus: requiresApproval ? 'pending' : 'none',
    requesterId: actor.sub,
    status,
    responseDueAt,
    resolutionDueAt,
  });
  await TicketStatusHistory.create({ ticketId: ticket.id, fromStatus: null, toStatus: status, changedById: actor.sub });
  await notify.notifyTicketCreated(ticket);
  return ticket;
}

export interface ListTicketsFilter {
  statuses?: TicketStatus[];
  priorities?: TicketPriority[];
  assigneeId?: string;
  teamId?: string;
  tag?: string;
  sortBy?: 'createdAt' | 'priority';
  sortDir?: 'ASC' | 'DESC';
}

export async function listTickets(filter: ListTicketsFilter, actor: AccessTokenPayload): Promise<Ticket[]> {
  const where: Record<string, unknown> = {};
  if (filter.statuses && filter.statuses.length > 0) where.status = filter.statuses;
  if (filter.priorities && filter.priorities.length > 0) where.priority = filter.priorities;
  if (filter.assigneeId) where.assigneeId = filter.assigneeId;
  if (filter.teamId) where.teamId = filter.teamId;
  if (actor.role === 'customer') where.requesterId = actor.sub;

  const includes = filter.tag
    ? TICKET_INCLUDES.map((inc) => (inc.as === 'tags' ? { ...inc, where: { name: filter.tag!.trim().toLowerCase() }, required: true } : inc))
    : TICKET_INCLUDES;

  // Postgres and MySQL both order ENUM values by declaration order (low, medium, high,
  // urgent), so a plain ORDER BY on the column already sorts by severity correctly on both
  // dialects - no CASE-WHEN mapping needed.
  const sortBy = filter.sortBy ?? 'createdAt';
  const sortDir = filter.sortDir ?? 'DESC';

  return Ticket.findAll({
    where,
    order: [[sortBy, sortDir]],
    include: includes,
  });
}

export async function getTicket(ticketId: number, actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await Ticket.findByPk(ticketId, {
    include: [...TICKET_INCLUDES, { model: Asset, as: 'linkedAssets' }, { model: KnowledgeBaseArticle, as: 'linkedArticles' }],
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  assertCanAccessTicket(ticket, actor);
  return ticket;
}

export async function sumTimeEntryMinutes(ticketId: number): Promise<number> {
  const total = await TicketTimeEntry.sum('minutes', { where: { ticketId } });
  return total ?? 0;
}

export async function linkAsset(ticketId: number, assetId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new NotFoundError('Asset not found');
  await (ticket as unknown as { addLinkedAsset: (a: Asset) => Promise<void> }).addLinkedAsset(asset);
}

export async function unlinkAsset(ticketId: number, assetId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new NotFoundError('Asset not found');
  await (ticket as unknown as { removeLinkedAsset: (a: Asset) => Promise<void> }).removeLinkedAsset(asset);
}

export async function linkArticle(ticketId: number, articleId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
  const article = await KnowledgeBaseArticle.findByPk(articleId);
  if (!article) throw new NotFoundError('Article not found');
  await (ticket as unknown as { addLinkedArticle: (a: KnowledgeBaseArticle) => Promise<void> }).addLinkedArticle(article);
}

export async function unlinkArticle(ticketId: number, articleId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
  const article = await KnowledgeBaseArticle.findByPk(articleId);
  if (!article) throw new NotFoundError('Article not found');
  await (
    ticket as unknown as { removeLinkedArticle: (a: KnowledgeBaseArticle) => Promise<void> }
  ).removeLinkedArticle(article);
}

export async function listComments(ticketId: number, actor: AccessTokenPayload): Promise<TicketComment[]> {
  const ticket = await getTicket(ticketId, actor);
  const where: Record<string, unknown> = { ticketId: ticket.id };
  // Server-side enforcement: customers can never fetch internal-only notes, full stop.
  if (actor.role === 'customer') where.isInternal = false;
  return TicketComment.findAll({
    where,
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'author', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
  });
}

export interface AddCommentInput {
  body: string;
  isInternal: boolean;
}

export async function addComment(ticketId: number, input: AddCommentInput, actor: AccessTokenPayload): Promise<TicketComment> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer' && input.isInternal) {
    throw new ForbiddenError('Customers cannot create internal notes');
  }

  const comment = await TicketComment.create({
    ticketId: ticket.id,
    authorId: actor.sub,
    body: input.body,
    isInternal: input.isInternal,
  });

  if (!input.isInternal && !ticket.firstRespondedAt && actor.role !== 'customer') {
    await ticket.update({ firstRespondedAt: new Date() });
  }

  await notify.notifyNewComment(ticket, input.isInternal, actor.sub);
  return comment;
}

async function ensurePendingSurvey(ticketId: number): Promise<void> {
  await TicketSatisfactionSurvey.findOrCreate({ where: { ticketId }, defaults: { ticketId } });
}

export async function changeStatus(ticketId: number, toStatus: TicketStatus, actor: AccessTokenPayload): Promise<Ticket> {
  if (!VALID_STATUSES.includes(toStatus)) {
    throw new BadRequestError(`Invalid status: ${toStatus}`);
  }
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer') {
    throw new ForbiddenError('Only technicians can change ticket status');
  }
  const fromStatus = ticket.status;
  if (fromStatus === toStatus) return ticket;
  if (fromStatus === 'pending_approval') {
    throw new BadRequestError('A ticket pending approval must be approved or rejected, not moved directly');
  }
  if (toStatus === 'pending_approval') {
    throw new BadRequestError('pending_approval can only be entered automatically at ticket creation');
  }

  const updates: Partial<Ticket> = { status: toStatus };
  if (toStatus === 'resolved' && !ticket.resolvedAt) updates.resolvedAt = new Date();
  if (toStatus === 'closed' && !ticket.closedAt) updates.closedAt = new Date();
  await ticket.update(updates);
  if (toStatus === 'closed') await ensurePendingSurvey(ticket.id);
  await TicketStatusHistory.create({ ticketId: ticket.id, fromStatus, toStatus, changedById: actor.sub });
  await notify.notifyStatusChanged(ticket, fromStatus, toStatus);
  return ticket;
}

export async function approveTicket(ticketId: number, actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await getTicket(ticketId, actor);
  if (ticket.status !== 'pending_approval') {
    throw new BadRequestError('This ticket is not pending approval');
  }
  await ticket.update({ status: 'new', approvalStatus: 'approved', approvedById: actor.sub, approvedAt: new Date() });
  await TicketStatusHistory.create({ ticketId: ticket.id, fromStatus: 'pending_approval', toStatus: 'new', changedById: actor.sub });
  await notify.notifyStatusChanged(ticket, 'pending_approval', 'new');
  return ticket;
}

export async function rejectTicket(ticketId: number, reason: string | undefined, actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await getTicket(ticketId, actor);
  if (ticket.status !== 'pending_approval') {
    throw new BadRequestError('This ticket is not pending approval');
  }
  await ticket.update({
    status: 'closed',
    approvalStatus: 'rejected',
    rejectedById: actor.sub,
    rejectedAt: new Date(),
    approvalReason: reason ?? null,
    closedAt: ticket.closedAt ?? new Date(),
  });
  await ensurePendingSurvey(ticket.id);
  await TicketStatusHistory.create({ ticketId: ticket.id, fromStatus: 'pending_approval', toStatus: 'closed', changedById: actor.sub });
  await notify.notifyStatusChanged(ticket, 'pending_approval', 'closed');
  return ticket;
}

export async function assignTicket(ticketId: number, assigneeId: string, actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer') {
    throw new ForbiddenError('Only technicians can assign tickets');
  }
  const assignee = await User.findByPk(assigneeId);
  if (!assignee || assignee.role === 'customer') {
    throw new BadRequestError('Assignee must be an active technician or admin');
  }
  await ticket.update({ assigneeId });
  await notify.notifyTicketAssigned(ticket);
  return ticket;
}

export async function setTeam(ticketId: number, teamId: string, actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer') {
    throw new ForbiddenError('Only technicians can move a ticket between teams');
  }
  const team = await Team.findByPk(teamId);
  if (!team) throw new BadRequestError('Team not found');
  await ticket.update({ teamId });
  return ticket;
}

export interface EscalateTicketInput {
  toTeamId?: string;
  reason?: string;
}

export async function escalateTicket(ticketId: number, input: EscalateTicketInput, actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer') {
    throw new ForbiddenError('Only technicians can escalate tickets');
  }
  const fromTeamId = ticket.teamId;
  let toTeamId = input.toTeamId;
  if (!toTeamId) {
    const currentTeam = fromTeamId ? await Team.findByPk(fromTeamId) : null;
    toTeamId = currentTeam?.escalatesToTeamId ?? undefined;
  }
  if (!toTeamId) {
    throw new BadRequestError('No target team specified and the current team has no default escalation target');
  }
  const targetTeam = await Team.findByPk(toTeamId);
  if (!targetTeam) throw new BadRequestError('Target team not found');

  await ticket.update({ teamId: toTeamId, assigneeId: null });
  await TicketEscalationHistory.create({
    ticketId: ticket.id,
    fromTeamId,
    toTeamId,
    escalatedById: actor.sub,
    reason: input.reason ?? null,
  });
  await notify.notifyTicketEscalated(ticket, fromTeamId, toTeamId);
  return ticket;
}

export async function addWatcher(ticketId: number, userId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer' && userId !== actor.sub) {
    throw new ForbiddenError('Customers may only add themselves as a watcher');
  }
  const user = await User.findByPk(userId);
  if (!user || !user.isActive) throw new BadRequestError('User not found or inactive');
  await TicketWatcher.findOrCreate({ where: { ticketId: ticket.id, userId } });
}

export async function removeWatcher(ticketId: number, userId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer' && userId !== actor.sub) {
    throw new ForbiddenError('Customers may only remove themselves as a watcher');
  }
  await TicketWatcher.destroy({ where: { ticketId: ticket.id, userId } });
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface AddAttachmentInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  commentId?: string;
}

export async function addAttachment(
  ticketId: number,
  input: AddAttachmentInput,
  actor: AccessTokenPayload
): Promise<TicketAttachment> {
  const ticket = await getTicket(ticketId, actor);
  if (input.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestError('Attachment exceeds the 25MB size limit');
  }
  const key = `tickets/${ticket.id}/${Date.now()}-${input.fileName}`;
  await storageProvider.put({ key, body: input.buffer, contentType: input.mimeType });
  return TicketAttachment.create({
    ticketId: ticket.id,
    commentId: input.commentId ?? null,
    uploadedById: actor.sub,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    storageKey: key,
  });
}

export async function getAttachmentForDownload(
  ticketId: number,
  attachmentId: string,
  actor: AccessTokenPayload
): Promise<{ attachment: TicketAttachment; buffer: Buffer }> {
  await getTicket(ticketId, actor);
  const attachment = await TicketAttachment.findOne({ where: { id: attachmentId, ticketId } });
  if (!attachment) throw new NotFoundError('Attachment not found');
  const buffer = await storageProvider.get(attachment.storageKey);
  return { attachment, buffer };
}

export async function listAttachments(ticketId: number, actor: AccessTokenPayload): Promise<TicketAttachment[]> {
  const ticket = await getTicket(ticketId, actor);
  return TicketAttachment.findAll({
    where: { ticketId: ticket.id },
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'uploadedBy', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
  });
}

// --- Time tracking ---

export interface LogTimeInput {
  minutes: number;
  note?: string;
  workDate?: string;
}

export async function logTime(ticketId: number, input: LogTimeInput, actor: AccessTokenPayload): Promise<TicketTimeEntry> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer') {
    throw new ForbiddenError('Only technicians can log time');
  }
  return TicketTimeEntry.create({
    ticketId: ticket.id,
    technicianId: actor.sub,
    minutes: input.minutes,
    note: input.note ?? null,
    ...(input.workDate ? { workDate: input.workDate } : {}),
  });
}

export async function listTimeEntries(ticketId: number, actor: AccessTokenPayload): Promise<TicketTimeEntry[]> {
  const ticket = await getTicket(ticketId, actor);
  return TicketTimeEntry.findAll({
    where: { ticketId: ticket.id },
    order: [['workDate', 'DESC']],
    include: [{ model: User, as: 'technician', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
  });
}

export async function deleteTimeEntry(ticketId: number, entryId: string, actor: AccessTokenPayload): Promise<void> {
  await getTicket(ticketId, actor);
  const entry = await TicketTimeEntry.findOne({ where: { id: entryId, ticketId } });
  if (!entry) throw new NotFoundError('Time entry not found');
  if (entry.technicianId !== actor.sub && actor.role !== 'admin') {
    throw new ForbiddenError('Only the logging technician or an admin can delete a time entry');
  }
  await entry.destroy();
}

// --- CSAT surveys ---

export interface SubmitSurveyInput {
  rating: number;
  comment?: string;
}

export async function submitSurvey(ticketId: number, input: SubmitSurveyInput, actor: AccessTokenPayload): Promise<TicketSatisfactionSurvey> {
  const ticket = await getTicket(ticketId, actor);
  if (ticket.requesterId !== actor.sub) {
    throw new ForbiddenError('Only the ticket requester can submit a satisfaction survey');
  }
  if (ticket.status !== 'closed') {
    throw new BadRequestError('The satisfaction survey is only available once a ticket is closed');
  }
  const [survey] = await TicketSatisfactionSurvey.findOrCreate({ where: { ticketId: ticket.id }, defaults: { ticketId: ticket.id } });
  if (survey.submittedAt) {
    throw new BadRequestError('A satisfaction survey has already been submitted for this ticket');
  }
  await survey.update({ rating: input.rating, comment: input.comment ?? null, submittedAt: new Date() });
  return survey;
}

export async function getSurvey(ticketId: number, actor: AccessTokenPayload): Promise<TicketSatisfactionSurvey | null> {
  await getTicket(ticketId, actor);
  return TicketSatisfactionSurvey.findOne({ where: { ticketId } });
}

// --- Tags ---

function normalizeTagNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0))];
}

export async function setTags(ticketId: number, tagNames: string[], actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await getTicket(ticketId, actor);
  if (actor.role === 'customer') {
    throw new ForbiddenError('Only technicians can tag tickets');
  }
  const normalized = normalizeTagNames(tagNames);
  const tags = await Promise.all(normalized.map((name) => Tag.findOrCreate({ where: { name } }).then(([tag]) => tag)));
  await (ticket as unknown as { setTags: (tags: Tag[]) => Promise<void> }).setTags(tags);
  return getTicket(ticketId, actor);
}

// --- Bulk actions ---

export interface BulkResult {
  ticketId: number;
  success: boolean;
  error?: string;
}

async function runBulk(ticketIds: number[], op: (id: number) => Promise<unknown>): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const ticketId of ticketIds) {
    try {
      await op(ticketId);
      results.push({ ticketId, success: true });
    } catch (err) {
      results.push({ ticketId, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return results;
}

export function bulkChangeStatus(ticketIds: number[], status: TicketStatus, actor: AccessTokenPayload): Promise<BulkResult[]> {
  return runBulk(ticketIds, (id) => changeStatus(id, status, actor));
}

export function bulkAssign(ticketIds: number[], assigneeId: string, actor: AccessTokenPayload): Promise<BulkResult[]> {
  return runBulk(ticketIds, (id) => assignTicket(id, assigneeId, actor));
}

export function bulkSetTags(ticketIds: number[], tagNames: string[], actor: AccessTokenPayload): Promise<BulkResult[]> {
  return runBulk(ticketIds, (id) => setTags(id, tagNames, actor));
}

export function bulkSetTeam(ticketIds: number[], teamId: string, actor: AccessTokenPayload): Promise<BulkResult[]> {
  return runBulk(ticketIds, (id) => setTeam(id, teamId, actor));
}

export interface DashboardSummary {
  openByStatus: Record<TicketStatus, number>;
  workloadByTech: Array<{ assigneeId: string; displayName: string; openCount: number }>;
  agingTickets: Array<{ id: number; subject: string; ageInDays: number; priority: TicketPriority }>;
  breachedCount: number;
  avgCsatRating: number | null;
  csatResponseCount: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const tickets = await Ticket.findAll({
    include: [{ model: User, as: 'assignee', attributes: [...PUBLIC_USER_ATTRIBUTES] }],
  });

  const openByStatus = VALID_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as Record<TicketStatus, number>);
  const workloadMap = new Map<string, { displayName: string; openCount: number }>();
  const now = Date.now();
  const agingTickets: DashboardSummary['agingTickets'] = [];
  let breachedCount = 0;

  for (const ticket of tickets) {
    openByStatus[ticket.status] += 1;

    const isOpen = ticket.status !== 'resolved' && ticket.status !== 'closed';
    if (isOpen) {
      const assignee = (ticket as unknown as { assignee: User | null }).assignee;
      if (assignee) {
        const entry = workloadMap.get(assignee.id) ?? { displayName: assignee.displayName, openCount: 0 };
        entry.openCount += 1;
        workloadMap.set(assignee.id, entry);
      }
      const ageInDays = Math.floor((now - ticket.createdAt.getTime()) / 86_400_000);
      if (ageInDays >= 3) {
        agingTickets.push({ id: ticket.id, subject: ticket.subject, ageInDays, priority: ticket.priority });
      }
      if (isBreached(ticket.responseDueAt, ticket.firstRespondedAt) || isBreached(ticket.resolutionDueAt, ticket.resolvedAt)) {
        breachedCount += 1;
      }
    }
  }

  const allSurveys = await TicketSatisfactionSurvey.findAll();
  const ratedSurveys = allSurveys.filter((s) => s.submittedAt !== null && s.rating !== null);
  const avgCsatRating =
    ratedSurveys.length > 0 ? ratedSurveys.reduce((sum, s) => sum + (s.rating ?? 0), 0) / ratedSurveys.length : null;

  return {
    openByStatus,
    workloadByTech: [...workloadMap.entries()].map(([assigneeId, v]) => ({ assigneeId, ...v })),
    agingTickets: agingTickets.sort((a, b) => b.ageInDays - a.ageInDays),
    breachedCount,
    avgCsatRating,
    csatResponseCount: ratedSurveys.length,
  };
}

export { isBreached };
