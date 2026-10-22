import { Request, Response } from 'express';
import { z } from 'zod';
import * as ticketService from './ticketService';

const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().max(100).optional(),
  teamId: z.string().uuid().optional(),
  sourceTemplateId: z.string().uuid().optional(),
  requiresApproval: z.boolean().default(false),
});

const commentSchema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().default(false),
});

const statusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'waiting', 'resolved', 'closed']),
});

const assignSchema = z.object({
  assigneeId: z.string().uuid(),
});

const watcherSchema = z.object({
  userId: z.string().uuid(),
});

const linkAssetSchema = z.object({
  assetId: z.string().uuid(),
});

const linkArticleSchema = z.object({
  articleId: z.string().uuid(),
});

const rejectSchema = z.object({
  reason: z.string().max(1000).optional(),
});

const teamSchema = z.object({
  teamId: z.string().uuid(),
});

const escalateSchema = z.object({
  toTeamId: z.string().uuid().optional(),
  reason: z.string().max(1000).optional(),
});

const logTimeSchema = z.object({
  minutes: z.number().int().min(1).max(24 * 60),
  note: z.string().max(1000).optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const surveySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const tagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50)).max(20),
});

const ticketIdsSchema = z.array(z.number().int()).min(1).max(500);

const bulkStatusSchema = z.object({ ticketIds: ticketIdsSchema, status: z.enum(['new', 'in_progress', 'waiting', 'resolved', 'closed']) });
const bulkAssignSchema = z.object({ ticketIds: ticketIdsSchema, assigneeId: z.string().uuid() });
const bulkTagsSchema = z.object({ ticketIds: ticketIdsSchema, tags: z.array(z.string().min(1).max(50)).max(20) });
const bulkTeamSchema = z.object({ ticketIds: ticketIdsSchema, teamId: z.string().uuid() });

export async function create(req: Request, res: Response): Promise<void> {
  const input = createTicketSchema.parse(req.body);
  const ticket = await ticketService.createTicket(input, req.user!);
  res.status(201).json(ticket);
}

// Accepts either repeated query keys (?status=a&status=b, which Express parses as an array)
// or a single comma-separated value (?status=a,b, easier to persist in a URL/bookmark) - the
// frontend uses the latter, but both are supported since either is a reasonable client choice.
function parseListParam(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.length > 0) return value.split(',');
  return [];
}

export async function list(req: Request, res: Response): Promise<void> {
  const statuses = parseListParam(req.query.status) as ticketService.ListTicketsFilter['statuses'];
  const priorities = parseListParam(req.query.priority) as ticketService.ListTicketsFilter['priorities'];
  const assigneeId = req.query.assigneeId as string | undefined;
  const teamId = req.query.teamId as string | undefined;
  const tag = req.query.tag as string | undefined;
  const sortBy = req.query.sortBy as ticketService.ListTicketsFilter['sortBy'] | undefined;
  const sortDir = req.query.sortDir as ticketService.ListTicketsFilter['sortDir'] | undefined;
  const tickets = await ticketService.listTickets({ statuses, priorities, assigneeId, teamId, tag, sortBy, sortDir }, req.user!);
  res.json(tickets);
}

export async function listAttachments(req: Request, res: Response): Promise<void> {
  const attachments = await ticketService.listAttachments(Number(req.params.id), req.user!);
  res.json(attachments);
}

export async function get(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.getTicket(Number(req.params.id), req.user!);
  const totalMinutesLogged = await ticketService.sumTimeEntryMinutes(ticket.id);
  res.json({ ...ticket.toJSON(), totalMinutesLogged });
}

export async function listComments(req: Request, res: Response): Promise<void> {
  const comments = await ticketService.listComments(Number(req.params.id), req.user!);
  res.json(comments);
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const input = commentSchema.parse(req.body);
  const comment = await ticketService.addComment(Number(req.params.id), input, req.user!);
  res.status(201).json(comment);
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  const { status } = statusSchema.parse(req.body);
  const ticket = await ticketService.changeStatus(Number(req.params.id), status, req.user!);
  res.json(ticket);
}

export async function approve(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.approveTicket(Number(req.params.id), req.user!);
  res.json(ticket);
}

export async function reject(req: Request, res: Response): Promise<void> {
  const { reason } = rejectSchema.parse(req.body);
  const ticket = await ticketService.rejectTicket(Number(req.params.id), reason, req.user!);
  res.json(ticket);
}

export async function assign(req: Request, res: Response): Promise<void> {
  const { assigneeId } = assignSchema.parse(req.body);
  const ticket = await ticketService.assignTicket(Number(req.params.id), assigneeId, req.user!);
  res.json(ticket);
}

export async function setTeam(req: Request, res: Response): Promise<void> {
  const { teamId } = teamSchema.parse(req.body);
  const ticket = await ticketService.setTeam(Number(req.params.id), teamId, req.user!);
  res.json(ticket);
}

export async function escalate(req: Request, res: Response): Promise<void> {
  const input = escalateSchema.parse(req.body);
  const ticket = await ticketService.escalateTicket(Number(req.params.id), input, req.user!);
  res.json(ticket);
}

export async function setTags(req: Request, res: Response): Promise<void> {
  const { tags } = tagsSchema.parse(req.body);
  const ticket = await ticketService.setTags(Number(req.params.id), tags, req.user!);
  res.json(ticket);
}

export async function addWatcher(req: Request, res: Response): Promise<void> {
  const { userId } = watcherSchema.parse(req.body);
  await ticketService.addWatcher(Number(req.params.id), userId, req.user!);
  res.status(204).send();
}

export async function removeWatcher(req: Request, res: Response): Promise<void> {
  await ticketService.removeWatcher(Number(req.params.id), req.params.userId, req.user!);
  res.status(204).send();
}

const uploadAttachmentSchema = z.object({ commentId: z.string().uuid().optional() });

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  // Multipart fields arrive as strings; validate the optional comment link like any other body.
  const { commentId } = uploadAttachmentSchema.parse(req.body);
  const attachment = await ticketService.addAttachment(
    Number(req.params.id),
    {
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      commentId,
    },
    req.user!
  );
  res.status(201).json(attachment);
}

export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  const { attachment, buffer } = await ticketService.getAttachmentForDownload(
    Number(req.params.id),
    req.params.attachmentId,
    req.user!
  );
  // res.attachment() quotes and RFC 5987-encodes the uploader-supplied name; interpolating it
  // raw breaks the header on a `"` and garbles non-ASCII names. It also guesses Content-Type
  // from the extension, so set the stored type after it.
  res.attachment(attachment.fileName);
  res.setHeader('Content-Type', attachment.mimeType);
  res.send(buffer);
}

export async function linkAsset(req: Request, res: Response): Promise<void> {
  const { assetId } = linkAssetSchema.parse(req.body);
  await ticketService.linkAsset(Number(req.params.id), assetId, req.user!);
  res.status(204).send();
}

export async function unlinkAsset(req: Request, res: Response): Promise<void> {
  await ticketService.unlinkAsset(Number(req.params.id), req.params.assetId, req.user!);
  res.status(204).send();
}

export async function linkArticle(req: Request, res: Response): Promise<void> {
  const { articleId } = linkArticleSchema.parse(req.body);
  await ticketService.linkArticle(Number(req.params.id), articleId, req.user!);
  res.status(204).send();
}

export async function unlinkArticle(req: Request, res: Response): Promise<void> {
  await ticketService.unlinkArticle(Number(req.params.id), req.params.articleId, req.user!);
  res.status(204).send();
}

export async function logTime(req: Request, res: Response): Promise<void> {
  const input = logTimeSchema.parse(req.body);
  const entry = await ticketService.logTime(Number(req.params.id), input, req.user!);
  res.status(201).json(entry);
}

export async function listTimeEntries(req: Request, res: Response): Promise<void> {
  const entries = await ticketService.listTimeEntries(Number(req.params.id), req.user!);
  res.json(entries);
}

export async function deleteTimeEntry(req: Request, res: Response): Promise<void> {
  await ticketService.deleteTimeEntry(Number(req.params.id), req.params.entryId, req.user!);
  res.status(204).send();
}

export async function submitSurvey(req: Request, res: Response): Promise<void> {
  const input = surveySchema.parse(req.body);
  const survey = await ticketService.submitSurvey(Number(req.params.id), input, req.user!);
  res.json(survey);
}

export async function getSurvey(req: Request, res: Response): Promise<void> {
  const survey = await ticketService.getSurvey(Number(req.params.id), req.user!);
  res.json(survey);
}

export async function bulkStatus(req: Request, res: Response): Promise<void> {
  const { ticketIds, status } = bulkStatusSchema.parse(req.body);
  const results = await ticketService.bulkChangeStatus(ticketIds, status, req.user!);
  res.json(results);
}

export async function bulkAssign(req: Request, res: Response): Promise<void> {
  const { ticketIds, assigneeId } = bulkAssignSchema.parse(req.body);
  const results = await ticketService.bulkAssign(ticketIds, assigneeId, req.user!);
  res.json(results);
}

export async function bulkTags(req: Request, res: Response): Promise<void> {
  const { ticketIds, tags } = bulkTagsSchema.parse(req.body);
  const results = await ticketService.bulkSetTags(ticketIds, tags, req.user!);
  res.json(results);
}

export async function bulkTeam(req: Request, res: Response): Promise<void> {
  const { ticketIds, teamId } = bulkTeamSchema.parse(req.body);
  const results = await ticketService.bulkSetTeam(ticketIds, teamId, req.user!);
  res.json(results);
}

export async function dashboard(_req: Request, res: Response): Promise<void> {
  const summary = await ticketService.getDashboardSummary();
  res.json(summary);
}
