import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PROJECT_PRIORITIES, PROJECT_STATUSES, ProjectPriority, ProjectStatus, ProjectTemplate } from '../../../core/models/project.model';
import { User } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/utils/api-error';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../users/services/user.service';
import { ProjectService } from '../services/project.service';

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-2xl mx-auto">
      <h1 class="text-xl font-semibold mb-4">{{ parentId ? 'New Sub-project' : 'New Project' }}</h1>
      <form (ngSubmit)="create()" class="bg-white p-6 rounded-lg shadow space-y-3">
        @if (parentProjectName()) {
          <p class="text-xs text-gray-500">Sub-project of <span class="font-medium">{{ parentProjectName() }}</span></p>
        }
        <div>
          <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Name</label>
          <input [(ngModel)]="name" name="name" required class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</label>
          <textarea [(ngModel)]="description" name="description" rows="3" class="w-full border rounded px-2 py-1.5 text-sm"></textarea>
        </div>
        @if (!parentId && templates().length > 0) {
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Start from template</label>
            <select [(ngModel)]="templateId" name="templateId" class="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">(none)</option>
              @for (t of templates(); track t.id) {
                <option [value]="t.id">{{ t.name }}</option>
              }
            </select>
          </div>
        }
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Owner</label>
            <select [(ngModel)]="ownerId" name="ownerId" required class="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">Select an owner...</option>
              @for (user of staff(); track user.id) {
                <option [value]="user.id">{{ user.displayName }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priority</label>
            <select [(ngModel)]="priority" name="priority" class="w-full border rounded px-2 py-1.5 text-sm">
              @for (p of priorities; track p) {
                <option [value]="p">{{ p }}</option>
              }
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
            <select [(ngModel)]="status" name="status" class="w-full border rounded px-2 py-1.5 text-sm">
              @for (s of statuses; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </div>
          <div></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Start Date</label>
            <input type="date" [(ngModel)]="startDate" name="startDate" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Target End Date</label>
            <input type="date" [(ngModel)]="targetEndDate" name="targetEndDate" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>

        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }

        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Create Project</button>
      </form>
    </div>
  `,
})
export class ProjectCreateComponent implements OnInit {
  readonly statuses = PROJECT_STATUSES;
  readonly priorities = PROJECT_PRIORITIES;
  readonly staff = signal<User[]>([]);
  readonly templates = signal<ProjectTemplate[]>([]);
  readonly parentProjectName = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  name = '';
  description = '';
  ownerId = '';
  status: ProjectStatus = 'planning';
  priority: ProjectPriority = 'medium';
  startDate = '';
  targetEndDate = '';
  templateId = '';
  parentId = '';

  constructor(
    readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly userService: UserService,
    private readonly projectService: ProjectService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.parentId = this.route.snapshot.queryParamMap.get('parentId') ?? '';

    const [users, templates] = await Promise.all([
      this.userService.list(),
      this.auth.hasPermission('projects.view') ? this.projectService.listTemplates().catch(() => []) : Promise.resolve([]),
    ]);
    this.staff.set(users.filter((u) => u.role !== 'customer'));
    this.templates.set(templates);

    const currentUserId = this.auth.currentUser()?.id;
    if (currentUserId) this.ownerId = currentUserId;

    if (this.parentId) {
      const parent = await this.projectService.getProject(this.parentId).catch(() => null);
      if (parent) this.parentProjectName.set(parent.name);
    }
  }

  async create(): Promise<void> {
    this.error.set(null);
    try {
      const project = await this.projectService.createProject({
        name: this.name,
        description: this.description || null,
        ownerId: this.ownerId,
        status: this.status,
        priority: this.priority,
        startDate: this.startDate || null,
        targetEndDate: this.targetEndDate || null,
        parentProjectId: this.parentId || null,
        templateId: this.templateId || undefined,
      });
      await this.router.navigate(['/projects', project.id]);
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the project.'));
    }
  }
}
