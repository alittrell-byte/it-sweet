import { Request, Response } from 'express';
import { z } from 'zod';
import * as ticketService from './ticketService';

const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().max(100).optional(),
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

export async function create(req: Request, res: Response): Promise<void> {
  const input = createTicketSchema.parse(req.body);
  const ticket = await ticketService.createTicket(input, req.user!);
  res.status(201).json(ticket);
}

export async function list(req: Request, res: Response): Promise<void> {
  const status = req.query.status as ticketService.ListTicketsFilter['status'] | undefined;
  const assigneeId = req.query.assigneeId as string | undefined;
  const tickets = await ticketService.listTickets({ status, assigneeId }, req.user!);
  res.json(tickets);
}

export async function get(req: Request, res: Response): Promise<void> {
  const ticket = await ticketService.getTicket(Number(req.params.id), req.user!);
  res.json(ticket);
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

export async function assign(req: Request, res: Response): Promise<void> {
  const { assigneeId } = assignSchema.parse(req.body);
  const ticket = await ticketService.assignTicket(Number(req.params.id), assigneeId, req.user!);
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

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const attachment = await ticketService.addAttachment(
    Number(req.params.id),
    {
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      commentId: req.body.commentId,
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
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
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

export async function dashboard(_req: Request, res: Response): Promise<void> {
  const summary = await ticketService.getDashboardSummary();
  res.json(summary);
}
