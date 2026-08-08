import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler';
import { NotFoundError } from '../../common/errors';
import { authenticate, requirePermission } from '../auth/middleware';
import { KbArticleTemplate } from './articleTemplate.model';

export const kbArticleTemplateRouter = Router();
kbArticleTemplateRouter.use(authenticate);

const MANAGE = requirePermission('kb.manage_templates');

const templateSchema = z.object({
  name: z.string().min(1).max(150),
  titleTemplate: z.string().min(1).max(255),
  bodyTemplate: z.string().min(1),
  suggestedSpace: z.enum(['internal', 'external']).nullable().optional(),
  suggestedCategoryId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});

// Any authenticated user can read the active template list (used by the article-create
// picker) - only kb.manage_templates can create/edit/delete the library itself.
kbArticleTemplateRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await KbArticleTemplate.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }));
  })
);

kbArticleTemplateRouter.get(
  '/manage',
  MANAGE,
  asyncHandler(async (_req, res) => {
    res.json(await KbArticleTemplate.findAll({ order: [['name', 'ASC']] }));
  })
);

kbArticleTemplateRouter.post(
  '/',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = templateSchema.parse(req.body);
    const template = await KbArticleTemplate.create({
      ...input,
      suggestedSpace: input.suggestedSpace ?? null,
      suggestedCategoryId: input.suggestedCategoryId ?? null,
      createdById: req.user!.sub,
    });
    res.status(201).json(template);
  })
);

kbArticleTemplateRouter.patch(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    const input = templateSchema.partial().parse(req.body);
    const template = await KbArticleTemplate.findByPk(req.params.id);
    if (!template) throw new NotFoundError('Article template not found');
    await template.update(input);
    res.json(template);
  })
);

kbArticleTemplateRouter.delete(
  '/:id',
  MANAGE,
  asyncHandler(async (req, res) => {
    await KbArticleTemplate.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
