import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { authenticate, requirePermission } from '../auth/middleware';
import { KnowledgeBaseArticle } from './article.model';
import { KnowledgeBaseCategory } from './category.model';

export const kbCategoryRouter = Router();
kbCategoryRouter.use(authenticate);

const MANAGE = requirePermission('kb.manage_categories');

// Any authenticated user (including customers) can list categories, to filter/browse by -
// only creating/editing/deleting them is permission-gated.
kbCategoryRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await KnowledgeBaseCategory.findAll({ order: [['name', 'ASC']] }));
  })
);

const categorySchema = z.object({ name: z.string().min(1).max(150), parentId: z.string().uuid().nullable().optional() });

kbCategoryRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = categorySchema.parse(req.body);
    res.status(201).json(await KnowledgeBaseCategory.create(input));
  })
);

kbCategoryRouter.patch(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = categorySchema.partial().parse(req.body);
    const category = await KnowledgeBaseCategory.findByPk(req.params.id);
    if (!category) throw new NotFoundError('Category not found');
    await category.update(input);
    res.json(category);
  })
);

kbCategoryRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const category = await KnowledgeBaseCategory.findByPk(req.params.id);
    if (!category) throw new NotFoundError('Category not found');

    // Deleting a category out from under its articles/children would either orphan them
    // silently or (if a DB-level cascade were added later) destroy far more than the admin
    // intended - block instead, and say exactly what's still attached so it can be resolved.
    const [articleCount, childCount] = await Promise.all([
      KnowledgeBaseArticle.count({ where: { categoryId: category.id } }),
      KnowledgeBaseCategory.count({ where: { parentId: category.id } }),
    ]);
    if (articleCount > 0 || childCount > 0) {
      const parts: string[] = [];
      if (articleCount > 0) parts.push(`${articleCount} article${articleCount === 1 ? '' : 's'}`);
      if (childCount > 0) parts.push(`${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}`);
      throw new BadRequestError(
        `Cannot delete "${category.name}": it still has ${parts.join(' and ')} attached. Reassign or remove them first.`
      );
    }

    await category.destroy();
    res.status(204).send();
  })
);
