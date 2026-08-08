import { Router } from 'express';
import multer from 'multer';
import { Op, col, fn, where as sequelizeWhere } from 'sequelize';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate } from '../auth/middleware';
import { KnowledgeBaseArticle } from './article.model';
import * as articleService from './articleService';

export const kbRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Legacy quick-search, unchanged contract - used by the ticket-creation "suggested articles"
// widget (frontend/src/app/features/tickets/ticket-create/ticket-create.component.ts), which
// customers use too. Always external+published, regardless of who's asking or what permissions
// they hold - this must never surface internal-only content.
kbRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = (req.query.q as string | undefined)?.trim();
    const where: Record<string | symbol, unknown> = { isPublished: true, space: 'external' };
    if (query) {
      const pattern = `%${query.toLowerCase()}%`;
      where[Op.or] = [
        sequelizeWhere(fn('LOWER', col('title')), { [Op.like]: pattern }),
        sequelizeWhere(fn('LOWER', col('body')), { [Op.like]: pattern }),
        sequelizeWhere(fn('LOWER', col('tags')), { [Op.like]: pattern }),
      ];
    }
    res.json(await KnowledgeBaseArticle.findAll({ where, limit: 10, order: [['updatedAt', 'DESC']] }));
  })
);

const articleSchema = z.object({
  title: z.string().min(1).max(255),
  space: z.enum(['internal', 'external']),
  categoryId: z.string().uuid().nullable().optional(),
  body: z.string().min(1),
  tags: z.string().max(500).nullable().optional(),
  isPublished: z.boolean().default(true),
});

kbRouter.get(
  '/articles',
  authenticate,
  asyncHandler(async (req, res) => {
    const space = req.query.space as 'internal' | 'external' | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const q = req.query.q as string | undefined;
    const includeUnpublished = req.query.includeUnpublished === 'true';
    const reviewStatus = req.query.reviewStatus as articleService.ListArticlesFilter['reviewStatus'] | undefined;
    res.json(await articleService.listArticles({ space, categoryId, q, includeUnpublished, reviewStatus }, req.user!));
  })
);

kbRouter.post(
  '/articles',
  authenticate,
  asyncHandler(async (req, res) => {
    const input = articleSchema.parse(req.body);
    res.status(201).json(await articleService.createArticle(input, req.user!));
  })
);

kbRouter.get(
  '/articles/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await articleService.getArticle(req.params.id, req.user!));
  })
);

kbRouter.patch(
  '/articles/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const input = articleSchema.partial().parse(req.body);
    res.json(await articleService.updateArticle(req.params.id, input, req.user!));
  })
);

kbRouter.delete(
  '/articles/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    await articleService.deleteArticle(req.params.id, req.user!);
    res.status(204).send();
  })
);

kbRouter.get(
  '/articles/:id/tickets',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await articleService.getLinkedTickets(req.params.id, req.user!));
  })
);

kbRouter.get(
  '/articles/:id/revisions',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await articleService.listRevisions(req.params.id, req.user!));
  })
);

kbRouter.post(
  '/articles/:id/revisions/:revisionId/restore',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await articleService.restoreRevision(req.params.id, req.params.revisionId, req.user!));
  })
);

kbRouter.patch(
  '/articles/:id/submit-for-review',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await articleService.submitForReview(req.params.id, req.user!));
  })
);

kbRouter.patch(
  '/articles/:id/approve',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await articleService.approveArticle(req.params.id, req.user!));
  })
);

const requestChangesSchema = z.object({ note: z.string().max(1000).optional() });

kbRouter.patch(
  '/articles/:id/request-changes',
  authenticate,
  asyncHandler(async (req, res) => {
    const { note } = requestChangesSchema.parse(req.body);
    res.json(await articleService.requestChanges(req.params.id, note, req.user!));
  })
);

const feedbackSchema = z.object({ helpful: z.boolean(), comment: z.string().max(1000).optional() });

kbRouter.post(
  '/articles/:id/feedback',
  authenticate,
  asyncHandler(async (req, res) => {
    const input = feedbackSchema.parse(req.body);
    await articleService.submitFeedback(req.params.id, input, req.user!);
    res.status(204).send();
  })
);

kbRouter.get(
  '/articles/:id/feedback',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await articleService.getFeedbackSummary(req.params.id, req.user!));
  })
);

kbRouter.post(
  '/articles/:id/attachments',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const attachment = await articleService.addAttachment(
      req.params.id,
      { fileName: file.originalname, mimeType: file.mimetype, buffer: file.buffer },
      req.user!
    );
    res.status(201).json(attachment);
  })
);

kbRouter.get(
  '/articles/:id/attachments/:attachmentId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { attachment, buffer } = await articleService.getAttachmentForDownload(
      req.params.id,
      req.params.attachmentId,
      req.user!
    );
    res.setHeader('Content-Type', attachment.mimeType);
    res.send(buffer);
  })
);
