import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  ProjectPriority,
  ProjectStatus,
  ProjectSummary,
} from '../../../core/models/project.model';
import { User } from '../../../core/models/user.model';
import { UserService } from '../../users/services/user.service';
import { ProjectService } from '../services/project.service';

const STATUS_BADGE: Record<ProjectStatus, string> = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-800',
  on_hold: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const PRIORITY_BADGE: Record<ProjectPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-sky-100 text-sky-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

type DateSortField = 'startDate' | 'targetEndDate';
type SortDir = 'asc' | 'desc';
type Scope = 'all' | 'mine';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-semibold">Projects</h1>
        @if (auth.hasPermission('projects.create')) {
          <a routerLink="/projects/new" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
            + New Project
          </a>
        }
      </div>

      <div class="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="w-16 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</span>
          <div class="flex gap-2 flex-wrap">
            @for (status of statuses; track status) {
              <button
                (click)="toggleStatus(status)"
                class="text-sm px-3 py-1 rounded border"
                [class.bg-slate-800]="selectedStatus() === status"
                [class.text-white]="selectedStatus() === status"
              >
                {{ status }}
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <span class="w-16 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">Show</span>
          <select [(ngModel)]="scope" (ngModelChange)="onScopeChange()" class="border rounded px-2 py-1 text-sm">
            <option value="all">All Projects</option>
            <option value="mine">My Projects</option>
          </select>
          @if (auth.isAdmin()) {
            <span class="text-xs text-gray-400">view as:</span>
            <select [(ngModel)]="viewAsUserId" (ngModelChange)="onViewAsChange()" class="border rounded px-2 py-1 text-sm">
              <option value="">(everyone)</option>
              @for (user of staff(); track user.id) {
                <option [value]="user.id">{{ user.displayName }}</option>
              }
            </select>
          }
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <span class="w-16 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">Sort</span>
          <select [(ngModel)]="sortField" class="border rounded px-2 py-1 text-sm">
            <option value="targetEndDate">Due date</option>
            <option value="startDate">Start date</option>
          </select>
          <button
            (click)="toggleSortDir()"
            class="text-sm px-3 py-1 rounded border"
            [title]="sortDir === 'asc' ? 'Ascending (soonest first)' : 'Descending (latest first)'"
          >
            {{ sortDir === 'asc' ? '↑ Ascending' : '↓ Descending' }}
          </button>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (project of visibleProjects(); track project.id) {
          <a
            [routerLink]="['/projects', project.id]"
            class="block p-4 hover:bg-gray-50 border-l-4"
            [class.border-red-500]="isPastDue(project)"
            [class.border-transparent]="!isPastDue(project)"
          >
            <div class="flex items-center justify-between">
              <div>
                <span class="font-medium">{{ project.name }}</span>
                <span class="ml-2 text-xs px-2 py-0.5 rounded" [class]="STATUS_BADGE[project.status]">{{ project.status }}</span>
                <span class="ml-1 text-xs px-2 py-0.5 rounded" [class]="PRIORITY_BADGE[project.priority]">{{ project.priority }}</span>
                @if (isPastDue(project)) {
                  <span class="ml-1 text-xs px-2 py-0.5 rounded bg-red-600 text-white">Past Due</span>
                }
                @if (project.parentProjectName) {
                  <div class="text-xs text-gray-400">sub-project of {{ project.parentProjectName }}</div>
                }
              </div>
              <span class="text-xs text-gray-500">{{ project.owner?.displayName }}</span>
            </div>
            <div class="mt-2 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <div class="flex-1 max-w-xs min-w-[8rem]">
                <div class="h-1.5 bg-gray-200 rounded overflow-hidden">
                  <div class="h-full bg-slate-800" [style.width.%]="project.percentComplete"></div>
                </div>
              </div>
              <span>{{ project.percentComplete }}% complete</span>
              <span>{{ project.taskCount }} tasks</span>
              <span>{{ project.ticketCount }} tickets ({{ project.openTicketCount }} open)</span>
              <span>{{ project.assetCount }} assets</span>
              <span>Start: {{ project.startDate || '-' }}</span>
              <span [class.text-red-600]="isPastDue(project)" [class.font-medium]="isPastDue(project)">
                Due: {{ project.targetEndDate || '-' }}
              </span>
            </div>
          </a>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No projects yet.</p>
        }
      </div>
    </div>
  `,
})
export class ProjectListComponent implements OnInit {
  readonly STATUS_BADGE = STATUS_BADGE;
  readonly PRIORITY_BADGE = PRIORITY_BADGE;
  readonly statuses = PROJECT_STATUSES;
  readonly priorities = PROJECT_PRIORITIES;

  readonly projects = signal<ProjectSummary[]>([]);
  readonly staff = signal<User[]>([]);
  readonly selectedStatus = signal<ProjectStatus | null>(null);

  scope: Scope = 'all';
  viewAsUserId = '';
  sortField: DateSortField = 'targetEndDate';
  sortDir: SortDir = 'asc';

  constructor(
    readonly auth: AuthService,
    private readonly projectService: ProjectService,
    private readonly userService: UserService
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.auth.isAdmin()) {
      this.staff.set((await this.userService.list().catch(() => [])).filter((u) => u.role !== 'customer'));
    }
    await this.load();
  }

  async load(): Promise<void> {
    const involvesUserId = this.viewAsUserId || (this.scope === 'mine' ? this.auth.currentUser()?.id : undefined);
    this.projects.set(await this.projectService.listProjects(involvesUserId ? { involvesUserId } : {}));
  }

  async onScopeChange(): Promise<void> {
    this.viewAsUserId = '';
    await this.load();
  }

  async onViewAsChange(): Promise<void> {
    await this.load();
  }

  toggleStatus(status: ProjectStatus): void {
    this.selectedStatus.set(this.selectedStatus() === status ? null : status);
  }

  toggleSortDir(): void {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
  }

  isPastDue(project: ProjectSummary): boolean {
    return !!project.targetEndDate && project.targetEndDate < todayIso() && project.status !== 'completed' && project.status !== 'cancelled';
  }

  visibleProjects(): ProjectSummary[] {
    const status = this.selectedStatus();
    const filtered = status ? this.projects().filter((p) => p.status === status) : this.projects();

    const field = this.sortField;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const aDate = a[field];
      const bDate = b[field];
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1; // no date always sorts last, regardless of direction
      if (!bDate) return -1;
      return aDate.localeCompare(bDate) * dir;
    });
  }
}
