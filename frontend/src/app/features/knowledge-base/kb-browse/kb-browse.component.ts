import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { KnowledgeBaseArticle, KnowledgeBaseCategory, KnowledgeBaseReviewStatus, KnowledgeBaseSpace } from '../../../core/models/kb.model';
import { categoryDepth, sortCategoriesHierarchically } from '../category-tree';
import { KbService } from '../services/kb.service';

const REVIEW_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-red-100 text-red-800',
};

@Component({
  selector: 'app-kb-browse',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="max-w-4xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Knowledge Base</h1>
        @if (canManageAnySpace()) {
          <a routerLink="/kb/new" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
            + New Article
          </a>
        }
      </div>

      <div class="bg-white p-4 rounded-lg shadow flex flex-wrap gap-2 items-end">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-600">Search</label>
          <input [(ngModel)]="query" (keyup.enter)="load()" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        @if (auth.hasPermission('kb.view_internal')) {
          <div>
            <label class="block text-xs text-gray-600">Space</label>
            <select [(ngModel)]="space" (ngModelChange)="load()" class="border rounded px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="external">External (customer-facing)</option>
              <option value="internal">Internal (staff-only)</option>
            </select>
          </div>
        }
        <div>
          <label class="block text-xs text-gray-600">Category</label>
          <select [(ngModel)]="categoryId" (ngModelChange)="load()" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All categories</option>
            @for (c of categories(); track c.id) {
              <option [value]="c.id">{{ indent(c) }}{{ c.name }}</option>
            }
          </select>
        </div>
        <button (click)="load()" class="text-sm border rounded px-3 py-1.5 hover:bg-gray-50">Search</button>
      </div>

      @if (canManageAnySpace()) {
        <div class="bg-white p-4 rounded-lg shadow flex flex-wrap gap-2 items-end">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" [(ngModel)]="showMine" (ngModelChange)="onShowMineChange()" />
            My Drafts / Pending Review
          </label>
          @if (showMine) {
            <select [(ngModel)]="space" (ngModelChange)="load()" class="border rounded px-2 py-1.5 text-sm">
              @if (auth.hasPermission('kb.manage_external')) {
                <option value="external">External (customer-facing)</option>
              }
              @if (auth.hasPermission('kb.manage_internal')) {
                <option value="internal">Internal (staff-only)</option>
              }
            </select>
            <select [(ngModel)]="reviewStatus" (ngModelChange)="load()" class="border rounded px-2 py-1.5 text-sm">
              <option value="">Any status</option>
              <option value="none">Draft (not yet submitted)</option>
              <option value="pending_review">Pending Review</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="approved">Approved</option>
            </select>
          }
        </div>
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (a of articles(); track a.id) {
          <a [routerLink]="['/kb', a.id]" class="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div>
              <div class="font-medium text-sm">{{ a.title }}</div>
              <div class="text-xs text-gray-500">{{ categoryName(a.categoryId) }}</div>
            </div>
            <div class="flex gap-2 items-center">
              @if (!a.isPublished) {
                <span class="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">draft</span>
              }
              @if (a.reviewStatus !== 'none') {
                <span class="text-xs px-2 py-0.5 rounded-full" [class]="REVIEW_BADGE[a.reviewStatus]">
                  {{ a.reviewStatus === 'pending_review' ? 'pending review' : a.reviewStatus === 'approved' ? 'approved' : 'changes requested' }}
                </span>
              }
              @if (a.space === 'internal') {
                <span class="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">internal</span>
              }
            </div>
          </a>
        } @empty {
          <div class="px-4 py-8 text-center text-gray-500">No articles found.</div>
        }
      </div>
    </div>
  `,
})
export class KbBrowseComponent implements OnInit {
  readonly articles = signal<KnowledgeBaseArticle[]>([]);
  readonly categories = signal<KnowledgeBaseCategory[]>([]);
  readonly REVIEW_BADGE = REVIEW_BADGE;
  query = '';
  space = '';
  categoryId = '';
  showMine = false;
  reviewStatus = '';

  constructor(
    readonly auth: AuthService,
    private readonly kbService: KbService
  ) {}

  async ngOnInit(): Promise<void> {
    this.categories.set(sortCategoriesHierarchically(await this.kbService.listCategories()));
    await this.load();
  }

  canManageAnySpace(): boolean {
    return this.auth.hasPermission('kb.manage_internal') || this.auth.hasPermission('kb.manage_external');
  }

  // The backend only honors includeUnpublished when a specific manageable space is given (see
  // articleService.listArticles) - without a space to auto-select, toggling this on did nothing
  // visible at all. Picking a sensible default space here is what makes the checkbox take
  // effect. Turning it back off resets Space to "All" rather than leaving it stuck on whatever
  // was auto-picked - the general search should default back to unfiltered, not silently stay
  // scoped to one space after My Drafts is no longer in play.
  onShowMineChange(): void {
    if (this.showMine) {
      if (!this.space) {
        this.space = this.auth.hasPermission('kb.manage_external') ? 'external' : 'internal';
      }
    } else {
      this.space = '';
    }
    this.load();
  }

  indent(category: KnowledgeBaseCategory): string {
    return '— '.repeat(categoryDepth(category, this.categories()));
  }

  async load(): Promise<void> {
    this.articles.set(
      await this.kbService.listArticles({
        space: (this.space || undefined) as KnowledgeBaseSpace | undefined,
        categoryId: this.categoryId || undefined,
        q: this.query || undefined,
        includeUnpublished: this.showMine && !!this.space,
        reviewStatus: this.showMine ? ((this.reviewStatus || undefined) as KnowledgeBaseReviewStatus | undefined) : undefined,
      })
    );
  }

  categoryName(categoryId: string | null): string {
    if (!categoryId) return 'Uncategorized';
    return this.categories().find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
  }
}
