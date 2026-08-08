import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KnowledgeBaseCategory } from '../../../core/models/kb.model';
import { extractApiError } from '../../../core/utils/api-error';
import { categoryAncestorNames, sortCategoriesHierarchically } from '../category-tree';
import { KbService } from '../services/kb.service';

@Component({
  selector: 'app-kb-categories',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Knowledge Base Categories</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow flex gap-2 items-end">
        <div class="flex-1">
          <label class="block text-xs text-gray-600">Name</label>
          <input [(ngModel)]="name" name="name" required class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div class="flex-1">
          <label class="block text-xs text-gray-600">Parent (optional)</label>
          <select [(ngModel)]="parentId" name="parentId" class="w-full border rounded px-2 py-1.5 text-sm">
            <option [ngValue]="null">Top-level</option>
            @for (c of categories(); track c.id) {
              <option [ngValue]="c.id">{{ breadcrumb(c) }}</option>
            }
          </select>
        </div>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add</button>
      </form>
      @if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (c of categories(); track c.id) {
          <div class="p-4">
            @if (editingId === c.id) {
              <div class="flex gap-2 items-end">
                <div class="flex-1">
                  <label class="block text-xs text-gray-600">Name</label>
                  <input [(ngModel)]="editName" class="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div class="flex-1">
                  <label class="block text-xs text-gray-600">Parent</label>
                  <select [(ngModel)]="editParentId" class="w-full border rounded px-2 py-1.5 text-sm">
                    <option [ngValue]="null">Top-level</option>
                    @for (p of categories(); track p.id) {
                      @if (p.id !== c.id) {
                        <option [ngValue]="p.id">{{ breadcrumb(p) }}</option>
                      }
                    }
                  </select>
                </div>
                <button (click)="saveEdit(c.id)" class="text-xs bg-slate-800 text-white rounded px-3 py-1.5 hover:bg-slate-700">
                  Save
                </button>
                <button (click)="cancelEdit()" class="text-xs border rounded px-3 py-1.5 hover:bg-gray-50">Cancel</button>
              </div>
              @if (editError()) {
                <p class="text-xs text-red-600 mt-2">{{ editError() }}</p>
              }
            } @else {
              <div class="flex items-center justify-between">
                <div class="text-sm">
                  @if (ancestors(c).length > 0) {
                    <span class="text-gray-400">{{ ancestors(c).join(' › ') }} › </span>
                  }
                  {{ c.name }}
                </div>
                <div class="flex gap-3">
                  <button (click)="startEdit(c)" class="text-xs text-slate-600 hover:underline">Edit</button>
                  <button (click)="remove(c)" class="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            }
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No categories yet.</p>
        }
      </div>
    </div>
  `,
})
export class KbCategoriesComponent implements OnInit {
  readonly categories = signal<KnowledgeBaseCategory[]>([]);
  readonly error = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  name = '';
  parentId: string | null = null;
  editingId: string | null = null;
  editName = '';
  editParentId: string | null = null;

  constructor(private readonly kbService: KbService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.categories.set(sortCategoriesHierarchically(await this.kbService.listCategories()));
  }

  breadcrumb(category: KnowledgeBaseCategory): string {
    const ancestors = categoryAncestorNames(category, this.categories());
    return ancestors.length > 0 ? `${ancestors.join(' › ')} › ${category.name}` : category.name;
  }

  ancestors(category: KnowledgeBaseCategory): string[] {
    return categoryAncestorNames(category, this.categories());
  }

  async create(): Promise<void> {
    this.error.set(null);
    try {
      await this.kbService.createCategory({ name: this.name, parentId: this.parentId });
      this.name = '';
      this.parentId = null;
      await this.load();
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the category.'));
    }
  }

  startEdit(category: KnowledgeBaseCategory): void {
    this.editingId = category.id;
    this.editName = category.name;
    this.editParentId = category.parentId;
    this.editError.set(null);
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editError.set(null);
  }

  async saveEdit(id: string): Promise<void> {
    this.editError.set(null);
    try {
      await this.kbService.updateCategory(id, { name: this.editName, parentId: this.editParentId });
      this.editingId = null;
      await this.load();
    } catch (err) {
      this.editError.set(extractApiError(err, 'Could not save the category.'));
    }
  }

  async remove(category: KnowledgeBaseCategory): Promise<void> {
    this.error.set(null);
    if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    try {
      await this.kbService.deleteCategory(category.id);
      await this.load();
    } catch (err) {
      // The API already explains exactly what's still attached (articles/subcategories) when
      // it refuses to delete - surface that message as-is rather than a generic failure.
      this.error.set(extractApiError(err, 'Could not delete the category.'));
    }
  }
}
