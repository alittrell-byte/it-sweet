import { Op, col, fn, where as sequelizeWhere } from 'sequelize';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { storageProvider } from '../../common/storage';
import { AccessTokenPayload } from '../auth/authService';
import { KnowledgeBaseArticle, KnowledgeBaseReviewStatus, KnowledgeBaseSpace } from './article.model';
import { KnowledgeBaseArticleRevision } from './articleRevision.model';
import { KnowledgeBaseArticleAttachment } from './articleAttachment.model';
import { KnowledgeBaseCategory } from './category.model';
import { KbArticleFeedback } from './articleFeedback.model';
import { sanitizeArticleHtml } from './sanitizeArticleHtml';
import { Ticket } from '../tickets/ticket.model';

function canManageSpace(actor: AccessTokenPayload, space: KnowledgeBaseSpace): boolean {
  if (actor.isSuperAdmin) return true;
  const key = space === 'internal' ? 'kb.manage_internal' : 'kb.manage_external';
  return actor.permissions.includes(key);
}

function assertCanManageSpace(actor: AccessTokenPayload, space: KnowledgeBaseSpace): void {
  if (!canManageSpace(actor, space)) {
    throw new ForbiddenError(`You do not have permission to manage ${space} articles`);
  }
}

function canReviewSpace(actor: AccessTokenPayload, space: KnowledgeBaseSpace): boolean {
  if (actor.isSuperAdmin) return true;
  const key = space === 'internal' ? 'kb.review_internal' : 'kb.review_external';
  return actor.permissions.includes(key);
}

function assertCanReviewSpace(actor: AccessTokenPayload, space: KnowledgeBaseSpace): void {
  if (!canReviewSpace(actor, space)) {
    throw new ForbiddenError(`You do not have permission to review ${space} articles`);
  }
}

function canViewInternal(actor: AccessTokenPayload): boolean {
  return actor.isSuperAdmin || actor.permissions.includes('kb.view_internal');
}

// External+published is open to everyone (including customers); internal requires
// kb.view_internal; unpublished drafts are only visible to whoever could manage that space.
// Enforced here (not just hidden in the UI), same principle as ticket internal notes.
function assertCanViewArticle(actor: AccessTokenPayload, article: KnowledgeBaseArticle): void {
  if (article.space === 'internal' && !canViewInternal(actor)) {
    throw new ForbiddenError('You do not have permission to view internal knowledge base articles');
  }
  if (!article.isPublished && !canManageSpace(actor, article.space)) {
    throw new ForbiddenError('This article is not published');
  }
}

export interface CreateArticleInput {
  title: string;
  space: KnowledgeBaseSpace;
  categoryId?: string | null;
  body: string;
  tags?: string | null;
  isPublished?: boolean;
}

export async function createArticle(input: CreateArticleInput, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle> {
  assertCanManageSpace(actor, input.space);
  const article = await KnowledgeBaseArticle.create({
    ...input,
    body: sanitizeArticleHtml(input.body),
    createdById: actor.sub,
    updatedById: actor.sub,
  });
  await KnowledgeBaseArticleRevision.create({
    articleId: article.id,
    title: article.title,
    body: article.body,
    space: article.space,
    categoryId: article.categoryId,
    editedById: actor.sub,
  });
  return article;
}

export interface ListArticlesFilter {
  space?: KnowledgeBaseSpace;
  categoryId?: string;
  q?: string;
  /**
   * Includes unpublished/pending-review articles alongside published ones - only honored when
   * `space` is also given and the actor can manage that space (a "my drafts / pending review"
   * view, not a general drafts leak). Silently ignored otherwise, same as an unset filter.
   */
  includeUnpublished?: boolean;
  reviewStatus?: KnowledgeBaseReviewStatus;
}

// Filtering by a parent category is expected to surface articles filed under any of its
// subcategories too (e.g. a search on "Hardware" should include articles under "Hardware >
// Replacing GPU"), not just articles tagged with that exact category id.
async function categoryIdWithDescendants(categoryId: string): Promise<string[]> {
  const all = await KnowledgeBaseCategory.findAll({ attributes: ['id', 'parentId'] });
  const childrenByParent = new Map<string, string[]>();
  for (const c of all) {
    const key = c.parentId ?? '';
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(c.id);
    childrenByParent.set(key, siblings);
  }

  const ids = [categoryId];
  const queue = [categoryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      ids.push(childId);
      queue.push(childId);
    }
  }
  return ids;
}

export async function listArticles(filter: ListArticlesFilter, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle[]> {
  if (filter.space === 'internal' && !canViewInternal(actor)) {
    throw new ForbiddenError('You do not have permission to view internal knowledge base articles');
  }
  const allowedSpaces: KnowledgeBaseSpace[] = filter.space
    ? [filter.space]
    : canViewInternal(actor)
      ? ['internal', 'external']
      : ['external'];

  const where: Record<string | symbol, unknown> = {
    space: { [Op.in]: allowedSpaces },
  };
  const canSeeUnpublished = filter.includeUnpublished && filter.space && canManageSpace(actor, filter.space);
  if (!canSeeUnpublished) where.isPublished = true;
  if (filter.reviewStatus && canSeeUnpublished) where.reviewStatus = filter.reviewStatus;
  if (filter.categoryId) where.categoryId = { [Op.in]: await categoryIdWithDescendants(filter.categoryId) };
  if (filter.q?.trim()) {
    const pattern = `%${filter.q.trim().toLowerCase()}%`;
    where[Op.and as unknown as string] = {
      [Op.or]: [
        sequelizeWhere(fn('LOWER', col('title')), { [Op.like]: pattern }),
        sequelizeWhere(fn('LOWER', col('body')), { [Op.like]: pattern }),
        sequelizeWhere(fn('LOWER', col('tags')), { [Op.like]: pattern }),
      ],
    };
  }

  return KnowledgeBaseArticle.findAll({ where, order: [['updatedAt', 'DESC']], limit: 50 });
}

export async function getArticle(id: string, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle> {
  const article = await KnowledgeBaseArticle.findByPk(id);
  if (!article) throw new NotFoundError('Article not found');
  assertCanViewArticle(actor, article);
  return article;
}

export interface UpdateArticleInput {
  title?: string;
  space?: KnowledgeBaseSpace;
  categoryId?: string | null;
  body?: string;
  tags?: string | null;
  isPublished?: boolean;
}

export async function updateArticle(id: string, input: UpdateArticleInput, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle> {
  const article = await KnowledgeBaseArticle.findByPk(id);
  if (!article) throw new NotFoundError('Article not found');
  assertCanManageSpace(actor, article.space);
  if (input.space && input.space !== article.space) {
    assertCanManageSpace(actor, input.space);
  }

  await article.update({
    ...input,
    body: input.body !== undefined ? sanitizeArticleHtml(input.body) : undefined,
    updatedById: actor.sub,
  });

  await KnowledgeBaseArticleRevision.create({
    articleId: article.id,
    title: article.title,
    body: article.body,
    space: article.space,
    categoryId: article.categoryId,
    editedById: actor.sub,
  });

  return article;
}

export async function deleteArticle(id: string, actor: AccessTokenPayload): Promise<void> {
  const article = await KnowledgeBaseArticle.findByPk(id);
  if (!article) throw new NotFoundError('Article not found');
  assertCanManageSpace(actor, article.space);
  await article.destroy();
}

export async function listRevisions(articleId: string, actor: AccessTokenPayload): Promise<KnowledgeBaseArticleRevision[]> {
  await getArticle(articleId, actor); // enforces view permission
  return KnowledgeBaseArticleRevision.findAll({ where: { articleId }, order: [['createdAt', 'DESC']] });
}

export async function restoreRevision(articleId: string, revisionId: string, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle> {
  const article = await KnowledgeBaseArticle.findByPk(articleId);
  if (!article) throw new NotFoundError('Article not found');
  assertCanManageSpace(actor, article.space);

  const revision = await KnowledgeBaseArticleRevision.findOne({ where: { id: revisionId, articleId } });
  if (!revision) throw new NotFoundError('Revision not found');
  if (revision.space !== article.space) {
    // Restoring across a space change would bypass the manage-permission check for the
    // revision's original space - keep it simple and disallow rather than re-deriving trust.
    assertCanManageSpace(actor, revision.space);
  }

  await article.update({
    title: revision.title,
    body: revision.body,
    space: revision.space,
    categoryId: revision.categoryId,
    updatedById: actor.sub,
  });

  await KnowledgeBaseArticleRevision.create({
    articleId: article.id,
    title: article.title,
    body: article.body,
    space: article.space,
    categoryId: article.categoryId,
    editedById: actor.sub,
  });

  return article;
}

async function snapshotRevision(article: KnowledgeBaseArticle, actor: AccessTokenPayload): Promise<void> {
  await KnowledgeBaseArticleRevision.create({
    articleId: article.id,
    title: article.title,
    body: article.body,
    space: article.space,
    categoryId: article.categoryId,
    editedById: actor.sub,
  });
}

export async function submitForReview(articleId: string, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle> {
  const article = await KnowledgeBaseArticle.findByPk(articleId);
  if (!article) throw new NotFoundError('Article not found');
  assertCanManageSpace(actor, article.space);

  await article.update({
    reviewStatus: 'pending_review',
    submittedForReviewById: actor.sub,
    submittedForReviewAt: new Date(),
  });
  return article;
}

export async function approveArticle(articleId: string, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle> {
  const article = await KnowledgeBaseArticle.findByPk(articleId);
  if (!article) throw new NotFoundError('Article not found');
  assertCanReviewSpace(actor, article.space);
  if (article.reviewStatus !== 'pending_review') {
    throw new BadRequestError('This article is not pending review');
  }

  await article.update({
    reviewStatus: 'approved',
    reviewedById: actor.sub,
    reviewedAt: new Date(),
    reviewNote: null,
    isPublished: true,
    updatedById: actor.sub,
  });
  await snapshotRevision(article, actor);
  return article;
}

export async function requestChanges(articleId: string, note: string | undefined, actor: AccessTokenPayload): Promise<KnowledgeBaseArticle> {
  const article = await KnowledgeBaseArticle.findByPk(articleId);
  if (!article) throw new NotFoundError('Article not found');
  assertCanReviewSpace(actor, article.space);
  if (article.reviewStatus !== 'pending_review') {
    throw new BadRequestError('This article is not pending review');
  }

  await article.update({
    reviewStatus: 'changes_requested',
    reviewedById: actor.sub,
    reviewedAt: new Date(),
    reviewNote: note ?? null,
  });
  return article;
}

// --- Article feedback ---

export interface FeedbackSummary {
  helpfulCount: number;
  notHelpfulCount: number;
  myVote: boolean | null;
}

export async function submitFeedback(
  articleId: string,
  input: { helpful: boolean; comment?: string },
  actor: AccessTokenPayload
): Promise<void> {
  await getArticle(articleId, actor); // enforces view permission
  const [feedback] = await KbArticleFeedback.findOrCreate({
    where: { articleId, userId: actor.sub },
    defaults: { articleId, userId: actor.sub, helpful: input.helpful, comment: input.comment ?? null },
  });
  await feedback.update({ helpful: input.helpful, comment: input.comment ?? null });
}

export async function getFeedbackSummary(articleId: string, actor: AccessTokenPayload): Promise<FeedbackSummary> {
  await getArticle(articleId, actor); // enforces view permission
  const rows = await KbArticleFeedback.findAll({ where: { articleId } });
  const mine = rows.find((r) => r.userId === actor.sub);
  return {
    helpfulCount: rows.filter((r) => r.helpful).length,
    notHelpfulCount: rows.filter((r) => !r.helpful).length,
    myVote: mine ? mine.helpful : null,
  };
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface AddAttachmentInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export async function addAttachment(
  articleId: string,
  input: AddAttachmentInput,
  actor: AccessTokenPayload
): Promise<KnowledgeBaseArticleAttachment> {
  const article = await KnowledgeBaseArticle.findByPk(articleId);
  if (!article) throw new NotFoundError('Article not found');
  assertCanManageSpace(actor, article.space);
  if (input.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestError('Attachment exceeds the 10MB size limit');
  }

  const key = `kb-articles/${articleId}/${Date.now()}-${input.fileName}`;
  await storageProvider.put({ key, body: input.buffer, contentType: input.mimeType });
  return KnowledgeBaseArticleAttachment.create({
    articleId,
    uploadedById: actor.sub,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    storageKey: key,
  });
}

export async function getLinkedTickets(articleId: string, actor: AccessTokenPayload): Promise<Ticket[]> {
  await getArticle(articleId, actor); // enforces view permission
  return Ticket.findAll({
    include: [{ model: KnowledgeBaseArticle, as: 'linkedArticles', where: { id: articleId }, attributes: [] }],
    order: [['createdAt', 'DESC']],
  });
}

export async function getAttachmentForDownload(
  articleId: string,
  attachmentId: string,
  actor: AccessTokenPayload
): Promise<{ attachment: KnowledgeBaseArticleAttachment; buffer: Buffer }> {
  await getArticle(articleId, actor); // enforces view permission
  const attachment = await KnowledgeBaseArticleAttachment.findOne({ where: { id: attachmentId, articleId } });
  if (!attachment) throw new NotFoundError('Attachment not found');
  const buffer = await storageProvider.get(attachment.storageKey);
  return { attachment, buffer };
}
