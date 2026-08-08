import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbArticleTemplate, KnowledgeBaseCategory, KnowledgeBaseSpace } from '../../../core/models/kb.model';
import { KbService } from '../../knowledge-base/services/kb.service';

@Component({
  selector: 'app-kb-templates',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Knowledge Base Article Templates</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-3">
        <input [(ngModel)]="name" name="name" placeholder="Template name (e.g. Device Documentation)" required class="w-full border rounded px-3 py-2 text-sm" />
        <input [(ngModel)]="titleTemplate" name="titleTemplate" placeholder="Default article title" required class="w-full border rounded px-3 py-2 text-sm" />
        <textarea
          [(ngModel)]="bodyTemplate"
          name="bodyTemplate"
          placeholder="Starter content (HTML)"
          required
          rows="5"
          class="w-full border rounded px-3 py-2 text-sm font-mono"
        ></textarea>
        <div class="flex gap-3">
          <select [(ngModel)]="suggestedSpace" name="suggestedSpace" class="border rounded px-3 py-2 text-sm">
            <option [ngValue]="null">No suggested space</option>
            <option value="external">External</option>
            <option value="internal">Internal</option>
          </select>
          <select [(ngModel)]="suggestedCategoryId" name="suggestedCategoryId" class="flex-1 border rounded px-3 py-2 text-sm">
            <option [ngValue]="null">No suggested category</option>
            @for (c of categories(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add Template</button>
      </form>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (t of templates(); track t.id) {
          <div class="p-4 flex justify-between items-start">
            <div>
              <div class="font-medium text-sm">{{ t.name }} @if (!t.isActive) {<span class="text-xs text-gray-400">(inactive)</span>}</div>
              <div class="text-sm text-gray-500">{{ t.titleTemplate }}</div>
            </div>
            <div class="flex gap-2">
              <button (click)="toggleActive(t)" class="text-xs text-slate-600 hover:underline">
                {{ t.isActive ? 'Deactivate' : 'Activate' }}
              </button>
              <button (click)="remove(t.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No templates yet.</p>
        }
      </div>
    </div>
  `,
})
export class KbTemplatesComponent implements OnInit {
  readonly templates = signal<KbArticleTemplate[]>([]);
  readonly categories = signal<KnowledgeBaseCategory[]>([]);
  name = '';
  titleTemplate = '';
  bodyTemplate = '';
  suggestedSpace: KnowledgeBaseSpace | null = null;
  suggestedCategoryId: string | null = null;

  constructor(private readonly kbService: KbService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
    this.categories.set(await this.kbService.listCategories());
  }

  async load(): Promise<void> {
    this.templates.set(await this.kbService.listAllArticleTemplates());
  }

  async create(): Promise<void> {
    if (!this.name.trim() || !this.titleTemplate.trim() || !this.bodyTemplate.trim()) return;
    await this.kbService.createArticleTemplate({
      name: this.name,
      titleTemplate: this.titleTemplate,
      bodyTemplate: this.bodyTemplate,
      suggestedSpace: this.suggestedSpace,
      suggestedCategoryId: this.suggestedCategoryId,
      isActive: true,
    });
    this.name = '';
    this.titleTemplate = '';
    this.bodyTemplate = '';
    this.suggestedSpace = null;
    this.suggestedCategoryId = null;
    await this.load();
  }

  async toggleActive(template: KbArticleTemplate): Promise<void> {
    await this.kbService.updateArticleTemplate(template.id, { isActive: !template.isActive });
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.kbService.deleteArticleTemplate(id);
    await this.load();
  }
}
