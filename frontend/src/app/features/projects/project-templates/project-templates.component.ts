import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectTemplate } from '../../../core/models/project.model';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-project-templates',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Project Templates</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-3">
        <input
          [(ngModel)]="name"
          name="name"
          placeholder="Template name (e.g. New Office Setup)"
          required
          class="w-full border rounded px-3 py-2 text-sm"
        />
        <textarea
          [(ngModel)]="description"
          name="description"
          placeholder="Description (optional)"
          rows="2"
          class="w-full border rounded px-3 py-2 text-sm"
        ></textarea>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add Template</button>
      </form>

      <div class="space-y-4">
        @for (t of templates(); track t.id) {
          <div class="bg-white rounded-lg shadow p-4">
            <div class="flex justify-between items-start mb-2">
              <div>
                <div class="font-medium text-sm">{{ t.name }}</div>
                @if (t.description) {
                  <div class="text-sm text-gray-500">{{ t.description }}</div>
                }
              </div>
              <button (click)="remove(t.id)" class="text-xs text-red-600 hover:underline">Delete Template</button>
            </div>

            <div class="border-t pt-2 mt-2">
              @for (task of t.tasks; track task.id) {
                <div class="flex items-center justify-between text-sm py-1">
                  <span>
                    {{ task.title }}
                    @if (task.relativeDueDays !== null) {
                      <span class="text-xs text-gray-400">(due {{ task.relativeDueDays }}d after start)</span>
                    }
                  </span>
                  <button (click)="removeTask(t.id, task.id)" class="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              } @empty {
                <p class="text-sm text-gray-400">No tasks yet.</p>
              }
              <div class="flex gap-2 mt-2">
                <input
                  [(ngModel)]="taskTitleByTemplate[t.id]"
                  [name]="'taskTitle-' + t.id"
                  placeholder="Task title"
                  class="flex-1 border rounded px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  [(ngModel)]="taskDueDaysByTemplate[t.id]"
                  [name]="'taskDueDays-' + t.id"
                  placeholder="Due days"
                  class="w-24 border rounded px-2 py-1 text-sm"
                />
                <button (click)="addTask(t.id)" class="text-sm bg-slate-800 text-white rounded px-3 py-1 hover:bg-slate-700">
                  Add Task
                </button>
              </div>
            </div>
          </div>
        } @empty {
          <p class="text-sm text-gray-400">No templates yet.</p>
        }
      </div>
    </div>
  `,
})
export class ProjectTemplatesComponent implements OnInit {
  readonly templates = signal<ProjectTemplate[]>([]);
  name = '';
  description = '';
  taskTitleByTemplate: Record<string, string> = {};
  taskDueDaysByTemplate: Record<string, number | null> = {};

  constructor(private readonly projectService: ProjectService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.templates.set(await this.projectService.listTemplates());
  }

  async create(): Promise<void> {
    if (!this.name.trim()) return;
    await this.projectService.createTemplate({ name: this.name, description: this.description || null });
    this.name = '';
    this.description = '';
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.projectService.deleteTemplate(id);
    await this.load();
  }

  async addTask(templateId: string): Promise<void> {
    const title = this.taskTitleByTemplate[templateId];
    if (!title?.trim()) return;
    await this.projectService.addTemplateTask(templateId, {
      title,
      relativeDueDays: this.taskDueDaysByTemplate[templateId] ?? null,
    });
    this.taskTitleByTemplate[templateId] = '';
    this.taskDueDaysByTemplate[templateId] = null;
    await this.load();
  }

  async removeTask(templateId: string, taskId: string): Promise<void> {
    await this.projectService.deleteTemplateTask(templateId, taskId);
    await this.load();
  }
}
