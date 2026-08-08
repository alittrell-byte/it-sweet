import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { QuillEditorComponent } from 'ngx-quill';
import type Quill from 'quill';
import { AuthService } from '../../../core/services/auth.service';
import { KbArticleTemplate, KnowledgeBaseCategory, KnowledgeBaseSpace } from '../../../core/models/kb.model';
import { extractApiError } from '../../../core/utils/api-error';
import { categoryDepth, sortCategoriesHierarchically } from '../category-tree';
import { KbService } from '../services/kb.service';

@Component({
  selector: 'app-kb-article-edit',
  standalone: true,
  imports: [FormsModule, QuillEditorComponent],
  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <h1 class="text-xl font-semibold">{{ articleId ? 'Edit Article' : 'New Article' }}</h1>

      <div class="bg-white p-6 rounded-lg shadow space-y-4">
        <div class="grid grid-cols-3 gap-4">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700">Title</label>
            <input [(ngModel)]="title" class="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Space</label>
            <select [(ngModel)]="space" class="mt-1 w-full border rounded px-3 py-2">
              @if (auth.hasPermission('kb.manage_external')) {
                <option value="external">External (customer-facing)</option>
              }
              @if (auth.hasPermission('kb.manage_internal')) {
                <option value="internal">Internal (staff-only)</option>
              }
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Category</label>
            <select [(ngModel)]="categoryId" class="mt-1 w-full border rounded px-3 py-2">
              <option [ngValue]="null">Uncategorized</option>
              @for (c of categories(); track c.id) {
                <option [ngValue]="c.id">{{ indent(c) }}{{ c.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Tags</label>
            <input [(ngModel)]="tags" placeholder="comma, separated" class="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <label class="flex items-center gap-2 mt-6 text-sm">
            <input type="checkbox" [(ngModel)]="isPublished" />
            Published
          </label>
        </div>

        @if (!articleId) {
          @if (templates().length > 0) {
            <div>
              <label class="block text-sm font-medium text-gray-700">Start from a template (optional)</label>
              <select
                [ngModel]="selectedTemplateId"
                (ngModelChange)="applyTemplate($event)"
                class="mt-1 w-full border rounded px-3 py-2"
              >
                <option value="">Blank article</option>
                @for (t of templates(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>
          }
          <p class="text-sm text-gray-500">
            Save the title/space first - once the article exists you can add content and embed images.
          </p>
          @if (error()) {
            <p class="text-sm text-red-600">{{ error() }}</p>
          }
          <button (click)="createShell()" class="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700">
            Create &amp; Continue
          </button>
        } @else {
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <quill-editor
              [(ngModel)]="body"
              format="html"
              [modules]="quillModules"
              (onEditorCreated)="onEditorCreated($event)"
              [styles]="{ height: '400px' }"
            ></quill-editor>
          </div>
          @if (error()) {
            <p class="text-sm text-red-600">{{ error() }}</p>
          }
          @if (message()) {
            <p class="text-sm text-green-700">{{ message() }}</p>
          }
          <button (click)="save()" class="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700">Save</button>
        }
      </div>
    </div>
  `,
})
export class KbArticleEditComponent implements OnInit {
  articleId: string | null = null;
  title = '';
  space: KnowledgeBaseSpace = 'external';
  categoryId: string | null = null;
  tags = '';
  isPublished = true;
  body = '';
  selectedTemplateId = '';
  readonly categories = signal<KnowledgeBaseCategory[]>([]);
  readonly templates = signal<KbArticleTemplate[]>([]);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  private quill: Quill | null = null;

  readonly quillModules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: {
        image: () => this.pickAndUploadImage(),
      },
    },
  };

  constructor(
    readonly auth: AuthService,
    private readonly kbService: KbService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    // Load/apply the existing article (if editing) first and independently of the
    // categories/templates fetches below - those are secondary conveniences, and an error
    // fetching them must never prevent the actual article content from loading and rendering.
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.articleId = id;
      const article = await this.kbService.getArticle(id);
      this.title = article.title;
      this.space = article.space;
      this.categoryId = article.categoryId;
      this.tags = article.tags ?? '';
      this.isPublished = article.isPublished;
      this.body = article.body;
    } else if (!this.auth.hasPermission('kb.manage_external') && this.auth.hasPermission('kb.manage_internal')) {
      this.space = 'internal';
    }

    this.categories.set(sortCategoriesHierarchically(await this.kbService.listCategories()));
    try {
      this.templates.set(await this.kbService.listArticleTemplates());
    } catch {
      this.templates.set([]);
    }
  }

  indent(category: KnowledgeBaseCategory): string {
    return '— '.repeat(categoryDepth(category, this.categories()));
  }

  applyTemplate(templateId: string): void {
    this.selectedTemplateId = templateId;
    const template = this.templates().find((t) => t.id === templateId);
    if (!template) return;
    this.title = template.titleTemplate;
    if (template.suggestedSpace) this.space = template.suggestedSpace;
    if (template.suggestedCategoryId) this.categoryId = template.suggestedCategoryId;
    this.body = template.bodyTemplate;
  }

  onEditorCreated(editor: Quill): void {
    this.quill = editor;
  }

  private pickAndUploadImage(): void {
    if (!this.articleId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !this.quill) return;
      const attachment = await this.kbService.uploadAttachment(this.articleId!, file);
      const range = this.quill.getSelection(true);
      const url = this.kbService.attachmentUrl(this.articleId!, attachment.id);
      this.quill.insertEmbed(range?.index ?? 0, 'image', url, 'user');
    };
    input.click();
  }

  async createShell(): Promise<void> {
    this.error.set(null);
    try {
      const article = await this.kbService.createArticle({
        title: this.title,
        space: this.space,
        categoryId: this.categoryId,
        body: this.body || '<p></p>',
        tags: this.tags || null,
        isPublished: this.isPublished,
      });
      this.router.navigate(['/kb', article.id, 'edit']);
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the article.'));
    }
  }

  async save(): Promise<void> {
    this.error.set(null);
    this.message.set(null);
    try {
      await this.kbService.updateArticle(this.articleId!, {
        title: this.title,
        space: this.space,
        categoryId: this.categoryId,
        body: this.body,
        tags: this.tags || null,
        isPublished: this.isPublished,
      });
      this.message.set('Saved.');
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not save the article.'));
    }
  }
}
