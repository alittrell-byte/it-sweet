import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { KbArticleFeedbackSummary, KnowledgeBaseArticle, KnowledgeBaseArticleRevision } from '../../../core/models/kb.model';
import { Ticket } from '../../../core/models/ticket.model';
import { KbService } from '../services/kb.service';

const REVIEW_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-red-100 text-red-800',
};

@Component({
  selector: 'app-kb-article-view',
  standalone: true,
  imports: [DatePipe, RouterLink, FormsModule],
  template: `
    @if (article(); as a) {
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-xl font-semibold">{{ a.title }}</h1>
              <p class="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                <span>
                  {{ a.space === 'internal' ? 'Internal' : 'External' }}
                  {{ !a.isPublished ? '· Draft' : '' }}
                  · updated {{ a.updatedAt | date: 'medium' }}
                </span>
                @if (a.reviewStatus !== 'none') {
                  <span class="text-xs px-2 py-0.5 rounded-full" [class]="REVIEW_BADGE[a.reviewStatus]">
                    {{ a.reviewStatus === 'pending_review' ? 'Pending Review' : a.reviewStatus === 'approved' ? 'Approved' : 'Changes Requested' }}
                  </span>
                }
              </p>
              @if (a.reviewStatus === 'changes_requested' && a.reviewNote) {
                <p class="text-sm text-red-700 mt-2 bg-red-50 border border-red-200 rounded px-3 py-2">
                  Reviewer feedback: {{ a.reviewNote }}
                </p>
              }
            </div>
            @if (canManage()) {
              <a [routerLink]="['/kb', a.id, 'edit']" class="text-sm border rounded px-3 py-1.5 hover:bg-gray-50">Edit</a>
            }
          </div>
          <div class="prose max-w-none mt-4 ql-editor" [innerHTML]="renderedBody()"></div>

          @if (canManage() && a.reviewStatus !== 'pending_review') {
            <div class="mt-4 pt-4 border-t">
              <button (click)="submitForReview()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                Submit for Review
              </button>
            </div>
          }
          @if (canReview() && a.reviewStatus === 'pending_review') {
            <div class="mt-4 pt-4 border-t flex items-center gap-2">
              <input [(ngModel)]="reviewNote" placeholder="Note (for request changes)" class="flex-1 border rounded px-2 py-1.5 text-sm" />
              <button (click)="requestChanges()" class="text-sm bg-red-600 text-white rounded px-3 py-1.5 hover:bg-red-700">
                Request Changes
              </button>
              <button (click)="approve()" class="text-sm bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-700">
                Approve &amp; Publish
              </button>
            </div>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Was this helpful?</h2>
          @if (feedback(); as fb) {
            <div class="flex items-center gap-3">
              <button
                (click)="vote(true)"
                class="text-sm px-3 py-1.5 rounded border"
                [class.bg-slate-800]="fb.myVote === true"
                [class.text-white]="fb.myVote === true"
              >
                Yes
              </button>
              <button
                (click)="vote(false)"
                class="text-sm px-3 py-1.5 rounded border"
                [class.bg-slate-800]="fb.myVote === false"
                [class.text-white]="fb.myVote === false"
              >
                No
              </button>
              @if (canManage()) {
                <span class="text-xs text-gray-500 ml-2">{{ fb.helpfulCount }} helpful · {{ fb.notHelpfulCount }} not helpful</span>
              }
            </div>
          }
        </div>

        @if (canManage()) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">Revision History</h2>
            @for (rev of revisions(); track rev.id) {
              <div class="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0">
                <span>{{ rev.title }} - {{ rev.createdAt | date: 'medium' }}</span>
                <button (click)="restore(rev.id)" class="text-xs text-blue-600 hover:underline">Restore</button>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">No revisions yet.</p>
            }
          </div>
        }

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Linked Tickets</h2>
          @for (t of linkedTickets(); track t.id) {
            <a [routerLink]="['/tickets', t.id]" class="block text-sm py-1 hover:text-blue-600">#{{ t.id }} - {{ t.subject }}</a>
          } @empty {
            <p class="text-sm text-gray-400">No tickets reference this article yet.</p>
          }
        </div>
      </div>
    }
  `,
})
export class KbArticleViewComponent implements OnInit {
  readonly article = signal<KnowledgeBaseArticle | null>(null);
  readonly revisions = signal<KnowledgeBaseArticleRevision[]>([]);
  readonly linkedTickets = signal<Ticket[]>([]);
  readonly renderedBody = signal<SafeHtml>('');
  readonly feedback = signal<KbArticleFeedbackSummary | null>(null);
  readonly REVIEW_BADGE = REVIEW_BADGE;
  reviewNote = '';

  constructor(
    readonly auth: AuthService,
    private readonly kbService: KbService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly sanitizer: DomSanitizer
  ) {}

  private get articleId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  canManage(): boolean {
    const article = this.article();
    if (!article) return false;
    return this.auth.hasPermission(article.space === 'internal' ? 'kb.manage_internal' : 'kb.manage_external');
  }

  canReview(): boolean {
    const article = this.article();
    if (!article) return false;
    return this.auth.hasPermission(article.space === 'internal' ? 'kb.review_internal' : 'kb.review_external');
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.linkedTickets.set(await this.kbService.listLinkedTickets(this.articleId));
    if (this.canManage()) {
      this.revisions.set(await this.kbService.listRevisions(this.articleId));
    }
    this.feedback.set(await this.kbService.getFeedbackSummary(this.articleId));
  }

  async reload(): Promise<void> {
    const article = await this.kbService.getArticle(this.articleId);
    this.article.set(article);
    this.renderedBody.set(this.sanitizer.bypassSecurityTrustHtml(this.injectImageTokens(article.body)));
  }

  // Embedded <img> tags point at our own attachment endpoint, which requires auth - but an
  // <img> tag can't send an Authorization header. Appending the *current* access token as a
  // query param (same fallback already used for the SSE log tail) works without ever storing
  // a token in the article content itself, so it keeps working across token rotations.
  private injectImageTokens(html: string): string {
    const token = this.auth.getAccessToken();
    if (!token) return html;
    return html.replace(/<img([^>]*)\ssrc="(\/api\/kb\/articles\/[^"]+)"/g, (_match, attrs, src) => {
      const separator = src.includes('?') ? '&' : '?';
      return `<img${attrs} src="${src}${separator}token=${encodeURIComponent(token)}"`;
    });
  }

  async restore(revisionId: string): Promise<void> {
    if (!confirm('Restore this revision? The current content will be replaced (and saved as a new revision).')) return;
    await this.kbService.restoreRevision(this.articleId, revisionId);
    await this.reload();
    this.revisions.set(await this.kbService.listRevisions(this.articleId));
  }

  async submitForReview(): Promise<void> {
    this.article.set(await this.kbService.submitForReview(this.articleId));
  }

  async approve(): Promise<void> {
    this.article.set(await this.kbService.approveArticle(this.articleId));
  }

  async requestChanges(): Promise<void> {
    this.article.set(await this.kbService.requestChanges(this.articleId, this.reviewNote || undefined));
    this.reviewNote = '';
  }

  async vote(helpful: boolean): Promise<void> {
    await this.kbService.submitFeedback(this.articleId, helpful);
    this.feedback.set(await this.kbService.getFeedbackSummary(this.articleId));
  }
}
