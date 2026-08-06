import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { storageProvider } from '../../common/storage';
import { AccessTokenPayload } from '../auth/authService';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Asset } from '../assets/asset.model';
import { Ticket, TicketPriority, TicketStatus } from './ticket.model';
import { TicketComment } from './ticketComment.model';
import { TicketAttachment } from './ticketAttachment.model';
import { TicketStatusHistory } from './ticketStatusHistory.model';
import { TicketWatcher } from './ticketWatcher.model';
import { computeSlaDueDates, isBreached } from './sla';
import * as notify from './notify';

const VALID_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting', 'resolved', 'closed'];

function assertCanAccessTicket(ticket: Ticket, actor: AccessTokenPayload): void {
  if (actor.role === 'customer' && ticket.requesterId !== actor.sub) {
    throw new ForbiddenError('You do not have access to this ticket');
  }
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  category?: string;
}

export async function createTicket(input: CreateTicketInput, actor: AccessTokenPayload): Promise<Ticket> {
  const { responseDueAt, resolutionDueAt } = computeSlaDueDates(input.priority);
  const ticket = await Ticket.create({
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    category: input.category ?? null,
    requesterId: actor.sub,
    status: 'new',
    responseDueAt,
    resolutionDueAt,
  });
  await TicketStatusHistory.create({ ticketId: ticket.id, fromStatus: null, toStatus: 'new', changedById: actor.sub });
  await notify.notifyTicketCreated(ticket);
  return ticket;
}

export interface ListTicketsFilter {
  status?: TicketStatus;
  assigneeId?: string;
}

export async function listTickets(filter: ListTicketsFilter, actor: AccessTokenPayload): Promise<Ticket[]> {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.assigneeId) where.assigneeId = filter.assigneeId;
  if (actor.role === 'customer') where.requesterId = actor.sub;

  return Ticket.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: [
      { model: User, as: 'requester', attributes: [...PUBLIC_USER_ATTRIBUTES] },
      { model: User, as: 'assignee', attributes: [...PUBLIC_USER_ATTRIBUTES] },
    ],
  });
}

export async function getTicket(ticketId: number, actor: AccessTokenPayload): Promise<Ticket> {
  const ticket = await Ticket.findByPk(ticketId, {
    include: [
      { model: User, as: 'requester', attributes: [...PUBLIC_USER_ATTRIBUTES] },
      { model: User, as: 'assignee', attributes: [...PUBLIC_USER_ATTRIBUTES] },
      { model: Asset, as: 'linkedAssets' },
    ],
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  assertCanAccessTicket(ticket, actor);
  return ticket;
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

  const updates: Partial<Ticket> = { status: toStatus };
  if (toStatus === 'resolved' && !ticket.resolvedAt) updates.resolvedAt = new Date();
  if (toStatus === 'closed' && !ticket.closedAt) updates.closedAt = new Date();
  await ticket.update(updates);
  await TicketStatusHistory.create({ ticketId: ticket.id, fromStatus, toStatus, changedById: actor.sub });
  await notify.notifyStatusChanged(ticket, fromStatus, toStatus);
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

export async function addWatcher(ticketId: number, userId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
  await TicketWatcher.findOrCreate({ where: { ticketId: ticket.id, userId } });
}

export async function removeWatcher(ticketId: number, userId: string, actor: AccessTokenPayload): Promise<void> {
  const ticket = await getTicket(ticketId, actor);
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

export interface DashboardSummary {
  openByStatus: Record<TicketStatus, number>;
  workloadByTech: Array<{ assigneeId: string; displayName: string; openCount: number }>;
  agingTickets: Array<{ id: number; subject: string; ageInDays: number; priority: TicketPriority }>;
  breachedCount: number;
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

  return {
    openByStatus,
    workloadByTech: [...workloadMap.entries()].map(([assigneeId, v]) => ({ assigneeId, ...v })),
    agingTickets: agingTickets.sort((a, b) => b.ageInDays - a.ageInDays),
    breachedCount,
  };
}

export { isBreached };
