import { Router } from 'express';
import { Op, col, fn, where as sequelizeWhere } from 'sequelize';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { authenticate, requirePermission, requireRole } from '../auth/middleware';
import { KnowledgeBaseArticle } from './article.model';

export const kbRouter = Router();

const upsertSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  tags: z.string().max(500).optional(),
  isPublished: z.boolean().default(true),
});

// Anyone authenticated (including customers, for ticket-creation suggestions) can search/read.
kbRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = (req.query.q as string | undefined)?.trim();
    const where: Record<string | symbol, unknown> = { isPublished: true };
    if (query) {
      // LOWER(...) LIKE '%...%' works identically on Postgres and MySQL, unlike Op.iLike
      // (Postgres-only), keeping KB search portable across the swappable DB_DIALECT.
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

kbRouter.post(
  '/',
  authenticate,
  requireRole('admin', 'technician'),
  requirePermission('kb.manage'),
  asyncHandler(async (req, res) => {
    const input = upsertSchema.parse(req.body);
    const article = await KnowledgeBaseArticle.create({ ...input, createdById: req.user!.sub });
    res.status(201).json(article);
  })
);
