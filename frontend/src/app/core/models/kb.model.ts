export type KnowledgeBaseSpace = 'internal' | 'external';
export type KnowledgeBaseReviewStatus = 'none' | 'pending_review' | 'approved' | 'changes_requested';

export interface KnowledgeBaseCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  space: KnowledgeBaseSpace;
  categoryId: string | null;
  body: string;
  tags: string | null;
  isPublished: boolean;
  reviewStatus: KnowledgeBaseReviewStatus;
  submittedForReviewById: string | null;
  submittedForReviewAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseArticleRevision {
  id: string;
  articleId: string;
  title: string;
  body: string;
  space: KnowledgeBaseSpace;
  categoryId: string | null;
  editedById: string;
  createdAt: string;
}

export interface KnowledgeBaseArticleAttachment {
  id: string;
  articleId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface KbArticleTemplate {
  id: string;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  suggestedSpace: KnowledgeBaseSpace | null;
  suggestedCategoryId: string | null;
  isActive: boolean;
}

export interface KbArticleFeedbackSummary {
  helpfulCount: number;
  notHelpfulCount: number;
  myVote: boolean | null;
}
