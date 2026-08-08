import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  KbArticleFeedbackSummary,
  KbArticleTemplate,
  KnowledgeBaseArticle,
  KnowledgeBaseArticleAttachment,
  KnowledgeBaseArticleRevision,
  KnowledgeBaseCategory,
  KnowledgeBaseReviewStatus,
  KnowledgeBaseSpace,
} from '../../../core/models/kb.model';
import { Ticket } from '../../../core/models/ticket.model';

export interface ArticleFilter {
  space?: KnowledgeBaseSpace;
  categoryId?: string;
  q?: string;
  includeUnpublished?: boolean;
  reviewStatus?: KnowledgeBaseReviewStatus;
}

export interface UpsertArticleInput {
  title: string;
  space: KnowledgeBaseSpace;
  categoryId?: string | null;
  body: string;
  tags?: string | null;
  isPublished?: boolean;
}

@Injectable({ providedIn: 'root' })
export class KbService {
  constructor(private readonly http: HttpClient) {}

  listArticles(filter: ArticleFilter = {}): Promise<KnowledgeBaseArticle[]> {
    const params: Record<string, string> = {};
    if (filter.space) params['space'] = filter.space;
    if (filter.categoryId) params['categoryId'] = filter.categoryId;
    if (filter.q) params['q'] = filter.q;
    if (filter.includeUnpublished) params['includeUnpublished'] = 'true';
    if (filter.reviewStatus) params['reviewStatus'] = filter.reviewStatus;
    return firstValueFrom(this.http.get<KnowledgeBaseArticle[]>('/api/kb/articles', { params }));
  }

  getArticle(id: string): Promise<KnowledgeBaseArticle> {
    return firstValueFrom(this.http.get<KnowledgeBaseArticle>(`/api/kb/articles/${id}`));
  }

  createArticle(input: UpsertArticleInput): Promise<KnowledgeBaseArticle> {
    return firstValueFrom(this.http.post<KnowledgeBaseArticle>('/api/kb/articles', input));
  }

  updateArticle(id: string, input: Partial<UpsertArticleInput>): Promise<KnowledgeBaseArticle> {
    return firstValueFrom(this.http.patch<KnowledgeBaseArticle>(`/api/kb/articles/${id}`, input));
  }

  deleteArticle(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kb/articles/${id}`));
  }

  listLinkedTickets(articleId: string): Promise<Ticket[]> {
    return firstValueFrom(this.http.get<Ticket[]>(`/api/kb/articles/${articleId}/tickets`));
  }

  listRevisions(articleId: string): Promise<KnowledgeBaseArticleRevision[]> {
    return firstValueFrom(this.http.get<KnowledgeBaseArticleRevision[]>(`/api/kb/articles/${articleId}/revisions`));
  }

  restoreRevision(articleId: string, revisionId: string): Promise<KnowledgeBaseArticle> {
    return firstValueFrom(
      this.http.post<KnowledgeBaseArticle>(`/api/kb/articles/${articleId}/revisions/${revisionId}/restore`, {})
    );
  }

  uploadAttachment(articleId: string, file: File): Promise<KnowledgeBaseArticleAttachment> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(
      this.http.post<KnowledgeBaseArticleAttachment>(`/api/kb/articles/${articleId}/attachments`, form)
    );
  }

  attachmentUrl(articleId: string, attachmentId: string): string {
    return `/api/kb/articles/${articleId}/attachments/${attachmentId}`;
  }

  // --- Review workflow ---

  submitForReview(articleId: string): Promise<KnowledgeBaseArticle> {
    return firstValueFrom(this.http.patch<KnowledgeBaseArticle>(`/api/kb/articles/${articleId}/submit-for-review`, {}));
  }

  approveArticle(articleId: string): Promise<KnowledgeBaseArticle> {
    return firstValueFrom(this.http.patch<KnowledgeBaseArticle>(`/api/kb/articles/${articleId}/approve`, {}));
  }

  requestChanges(articleId: string, note?: string): Promise<KnowledgeBaseArticle> {
    return firstValueFrom(this.http.patch<KnowledgeBaseArticle>(`/api/kb/articles/${articleId}/request-changes`, { note }));
  }

  // --- Feedback ---

  submitFeedback(articleId: string, helpful: boolean, comment?: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/kb/articles/${articleId}/feedback`, { helpful, comment }));
  }

  getFeedbackSummary(articleId: string): Promise<KbArticleFeedbackSummary> {
    return firstValueFrom(this.http.get<KbArticleFeedbackSummary>(`/api/kb/articles/${articleId}/feedback`));
  }

  // --- Article templates ---

  listArticleTemplates(): Promise<KbArticleTemplate[]> {
    return firstValueFrom(this.http.get<KbArticleTemplate[]>('/api/kb/templates'));
  }

  listAllArticleTemplates(): Promise<KbArticleTemplate[]> {
    return firstValueFrom(this.http.get<KbArticleTemplate[]>('/api/kb/templates/manage'));
  }

  createArticleTemplate(input: Omit<KbArticleTemplate, 'id'>): Promise<KbArticleTemplate> {
    return firstValueFrom(this.http.post<KbArticleTemplate>('/api/kb/templates', input));
  }

  updateArticleTemplate(id: string, input: Partial<Omit<KbArticleTemplate, 'id'>>): Promise<KbArticleTemplate> {
    return firstValueFrom(this.http.patch<KbArticleTemplate>(`/api/kb/templates/${id}`, input));
  }

  deleteArticleTemplate(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kb/templates/${id}`));
  }

  listCategories(): Promise<KnowledgeBaseCategory[]> {
    return firstValueFrom(this.http.get<KnowledgeBaseCategory[]>('/api/kb/categories'));
  }

  createCategory(input: { name: string; parentId?: string | null }): Promise<KnowledgeBaseCategory> {
    return firstValueFrom(this.http.post<KnowledgeBaseCategory>('/api/kb/categories', input));
  }

  updateCategory(id: string, input: { name?: string; parentId?: string | null }): Promise<KnowledgeBaseCategory> {
    return firstValueFrom(this.http.patch<KnowledgeBaseCategory>(`/api/kb/categories/${id}`, input));
  }

  deleteCategory(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kb/categories/${id}`));
  }
}
