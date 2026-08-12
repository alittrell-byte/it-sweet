import { Component, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { AuthService } from '../../../core/services/auth.service';
import {
  PROJECT_TASK_STATUS_LABELS,
  PROJECT_TASK_STATUSES,
  ProjectTask,
  ProjectTaskStatus,
} from '../../../core/models/project.model';
import { Ticket } from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/utils/api-error';
import { UserService } from '../../users/services/user.service';
import { TicketService } from '../../tickets/services/ticket.service';
import { ProjectService, UpdateTaskInput } from '../services/project.service';

@Component({
  selector: 'app-project-board',
  standalone: true,
  imports: [FormsModule, RouterLink, DragDropModule],
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-semibold">Board</h1>
        <div class="flex items-center gap-3">
          @if (manageable) {
            <button (click)="startCreate()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
              + New Task
            </button>
          }
          <a [routerLink]="['/projects', projectId]" class="text-sm text-blue-600 hover:underline">← Project Details</a>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-3 mb-4 flex items-center gap-3 flex-wrap">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Show</span>
        <select [(ngModel)]="taskScope" (ngModelChange)="onTaskScopeChange()" class="border rounded px-2 py-1 text-sm">
          <option value="all">All Tasks</option>
          <option value="mine">My Tasks</option>
        </select>
        @if (auth.isAdmin()) {
          <span class="text-xs text-gray-400">view as:</span>
          <select [(ngModel)]="taskViewAsUserId" (ngModelChange)="onTaskViewAsChange()" class="border rounded px-2 py-1 text-sm">
            <option value="">(everyone)</option>
            @for (user of staff(); track user.id) {
              <option [value]="user.id">{{ user.displayName }}</option>
            }
          </select>
        }
      </div>

      @if (boardError()) {
        <div class="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg px-4 py-2 mb-3">{{ boardError() }}</div>
      }
      @if (creating) {
        <form (ngSubmit)="createTask()" class="bg-white p-4 rounded-lg shadow mb-4 flex gap-2 items-end">
          <div class="flex-1">
            <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Title</label>
            <input [(ngModel)]="newTaskTitle" name="newTaskTitle" required class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">Add</button>
          <button type="button" (click)="creating = false" class="text-sm text-gray-500 hover:underline px-2 py-1.5">Cancel</button>
        </form>
      }

      <div class="grid grid-cols-3 gap-4">
        @for (status of statuses; track status) {
          <div class="bg-gray-50 rounded-lg p-3">
            <h2 class="text-sm font-medium text-gray-600 mb-2">{{ labels[status] }} ({{ columns[status]().length }})</h2>
            <div
              cdkDropList
              [id]="status"
              [cdkDropListData]="columns[status]()"
              [cdkDropListConnectedTo]="dropListIds"
              (cdkDropListDropped)="onDrop($event)"
              class="space-y-2 min-h-[100px]"
            >
              @for (task of columns[status](); track task.id) {
                <div
                  cdkDrag
                  [cdkDragData]="task"
                  [cdkDragDisabled]="!manageable"
                  (click)="openTask(task)"
                  class="bg-white p-3 rounded shadow-sm cursor-pointer hover:shadow"
                >
                  <div class="text-sm font-medium">{{ task.title }}</div>
                  <div class="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <span>{{ task.assignee?.displayName || 'Unassigned' }}</span>
                    <span>{{ task.dueDate || '' }}</span>
                  </div>
                  <div class="h-1 bg-gray-200 rounded overflow-hidden mt-2">
                    <div class="h-full bg-slate-800" [style.width.%]="task.percentComplete"></div>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>

      @if (selectedTask(); as t) {
        <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" (click)="closeTask()">
          <div class="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-3">
              <h2 class="font-medium">Edit Task</h2>
              <button (click)="closeTask()" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div class="space-y-2 text-sm">
              <div>
                <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Title</label>
                <input [(ngModel)]="editForm.title" [disabled]="!manageable" class="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <textarea
                  [(ngModel)]="editForm.description"
                  [disabled]="!manageable"
                  rows="2"
                  class="w-full border rounded px-2 py-1.5 text-sm"
                ></textarea>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Assignee</label>
                  <select [(ngModel)]="editForm.assigneeId" [disabled]="!manageable" class="w-full border rounded px-2 py-1.5 text-sm">
                    <option [ngValue]="null">Unassigned</option>
                    @for (user of staff(); track user.id) {
                      <option [ngValue]="user.id">{{ user.displayName }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due Date</label>
                  <input
                    type="date"
                    [(ngModel)]="editForm.dueDate"
                    [disabled]="!manageable"
                    class="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Percent Complete: {{ editForm.percentComplete }}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  [(ngModel)]="editForm.percentComplete"
                  [disabled]="!manageable"
                  class="w-full"
                />
              </div>

              @if (manageable) {
                <button (click)="saveTask(t.id)" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                  Save
                </button>
              }
              @if (canDeleteTasks) {
                <button (click)="deleteTask(t.id)" class="text-sm text-red-600 hover:underline ml-2">Delete Task</button>
              }
              @if (editError()) {
                <p class="text-sm text-red-600">{{ editError() }}</p>
              }

              <div class="border-t pt-2 mt-2">
                <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Depends On</h3>
                @for (dep of dependencies(); track dep.id) {
                  <div class="flex items-center justify-between py-0.5">
                    <span>{{ dep.title }} ({{ dep.status }})</span>
                    @if (manageable) {
                      <button (click)="removeDependency(t.id, dep.id)" class="text-xs text-red-600 hover:underline">Remove</button>
                    }
                  </div>
                } @empty {
                  <p class="text-gray-400">No dependencies.</p>
                }
                @if (manageable) {
                  <div class="flex gap-2 mt-2">
                    <select [(ngModel)]="dependencyToAdd" class="flex-1 border rounded px-2 py-1 text-sm">
                      <option value="">Depends on...</option>
                      @for (other of otherTasks(t.id); track other.id) {
                        <option [value]="other.id">{{ other.title }}</option>
                      }
                    </select>
                    <button (click)="addDependency(t.id)" class="text-sm bg-slate-800 text-white rounded px-3 py-1 hover:bg-slate-700">
                      Add
                    </button>
                  </div>
                  @if (dependencyError()) {
                    <p class="text-sm text-red-600 mt-1">{{ dependencyError() }}</p>
                  }
                }
              </div>

              <div class="border-t pt-2 mt-2">
                <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ticket</h3>
                @if (t.ticketId) {
                  <div class="flex items-center justify-between">
                    <a [routerLink]="['/tickets', t.ticketId]" class="text-blue-600 hover:underline">View Ticket #{{ t.ticketId }}</a>
                    @if (manageable) {
                      <button (click)="unlinkTicketFromTask(t.id)" class="text-xs text-red-600 hover:underline">Unlink</button>
                    }
                  </div>
                } @else if (manageable) {
                  <div class="flex gap-2">
                    <button (click)="spawnTicket(t.id)" class="text-sm bg-slate-800 text-white rounded px-3 py-1 hover:bg-slate-700">
                      Spawn New Ticket
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProjectBoardComponent implements OnInit {
  readonly statuses = PROJECT_TASK_STATUSES;
  readonly labels = PROJECT_TASK_STATUS_LABELS;
  readonly dropListIds = PROJECT_TASK_STATUSES as unknown as string[];

  readonly tasks = signal<ProjectTask[]>([]);
  readonly staff = signal<User[]>([]);
  readonly selectedTask = signal<ProjectTask | null>(null);
  readonly dependencies = signal<ProjectTask[]>([]);
  readonly boardError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly dependencyError = signal<string | null>(null);

  columns: Record<ProjectTaskStatus, WritableSignal<ProjectTask[]>> = {
    todo: signal<ProjectTask[]>([]),
    in_progress: signal<ProjectTask[]>([]),
    done: signal<ProjectTask[]>([]),
  };

  projectId = '';
  manageable = false;
  canDeleteTasks = false;
  creating = false;
  newTaskTitle = '';
  editForm: UpdateTaskInput = {};
  dependencyToAdd = '';
  taskScope: 'all' | 'mine' = 'all';
  taskViewAsUserId = '';

  constructor(
    readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
    private readonly ticketService: TicketService
  ) {}

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.paramMap.get('id')!;
    this.manageable = this.auth.hasPermission('projects.manage_tasks');
    this.canDeleteTasks = this.auth.hasPermission('projects.delete_tasks');
    const users = await this.userService.list().catch(() => [] as User[]);
    this.staff.set(users.filter((u) => u.role !== 'customer'));
    await this.reload();
  }

  /** No due date sorts last - a task with a real deadline should always rank ahead of a "someday" one. */
  private sortByDueDate(tasks: ProjectTask[]): ProjectTask[] {
    return [...tasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }

  /** "My Tasks" / admin "view as" is a display filter only - purely local, no re-fetch needed. */
  private applyTaskScope(tasks: ProjectTask[]): ProjectTask[] {
    const targetUserId = this.taskViewAsUserId || (this.taskScope === 'mine' ? this.auth.currentUser()?.id : undefined);
    return targetUserId ? tasks.filter((t) => t.assigneeId === targetUserId) : tasks;
  }

  private rebuildColumns(): void {
    const scoped = this.applyTaskScope(this.tasks());
    for (const status of this.statuses) {
      const inColumn = scoped.filter((t) => t.status === status);
      // To Do / In Progress sort by due date (soonest first) so what needs attention is visible
      // at a glance; Done keeps board position - there's no "urgency" left to sort by there.
      this.columns[status].set(status === 'done' ? inColumn.sort((a, b) => a.position - b.position) : this.sortByDueDate(inColumn));
    }
  }

  async reload(): Promise<void> {
    const tasks = await this.projectService.listTasks(this.projectId);
    this.tasks.set(tasks);
    this.rebuildColumns();
  }

  onTaskScopeChange(): void {
    this.taskViewAsUserId = '';
    this.rebuildColumns();
  }

  onTaskViewAsChange(): void {
    this.rebuildColumns();
  }

  otherTasks(taskId: string): ProjectTask[] {
    const existingDepIds = new Set(this.dependencies().map((d) => d.id));
    return this.tasks().filter((t) => t.id !== taskId && !existingDepIds.has(t.id));
  }

  startCreate(): void {
    this.creating = true;
    this.newTaskTitle = '';
    this.boardError.set(null);
  }

  async createTask(): Promise<void> {
    if (!this.newTaskTitle.trim()) return;
    this.boardError.set(null);
    try {
      await this.projectService.createTask(this.projectId, { title: this.newTaskTitle });
      this.creating = false;
      await this.reload();
    } catch (err) {
      this.boardError.set(extractApiError(err, 'Could not create the task.'));
    }
  }

  async onDrop(event: CdkDragDrop<ProjectTask[]>): Promise<void> {
    const task = event.item.data as ProjectTask;
    const sourceStatus = event.previousContainer.id as ProjectTaskStatus;
    const targetStatus = event.container.id as ProjectTaskStatus;
    this.boardError.set(null);

    // Explicit .set() with fresh array copies, rather than CDK's moveItemInArray/transferArrayItem
    // mutating the array a signal already holds in place - signals only notify template
    // consumers on .set()/.update(), never on an in-place mutation of their current value, which
    // is exactly why cards weren't visually shifting columns before this fix.
    const sourceItems = [...this.columns[sourceStatus]()];
    if (sourceStatus === targetStatus) {
      moveItemInArray(sourceItems, event.previousIndex, event.currentIndex);
      this.columns[sourceStatus].set(sourceItems);
    } else {
      const targetItems = [...this.columns[targetStatus]()];
      transferArrayItem(sourceItems, targetItems, event.previousIndex, event.currentIndex);
      this.columns[sourceStatus].set(sourceItems);
      this.columns[targetStatus].set(targetItems);
    }

    try {
      await this.projectService.moveTask(this.projectId, task.id, { status: targetStatus, position: event.currentIndex });
    } catch (err) {
      this.boardError.set(extractApiError(err, 'Could not move the task - it snapped back.'));
    } finally {
      // Re-sorts by due date and reconciles position after either a successful move or a
      // rejected one (e.g. blocked by an unmet dependency), which is also how a rejected move
      // visibly "snaps back" to its real column instead of staying wherever it was dropped.
      await this.reload();
    }
  }

  async openTask(task: ProjectTask): Promise<void> {
    this.selectedTask.set(task);
    this.editError.set(null);
    this.dependencyError.set(null);
    this.dependencyToAdd = '';
    this.editForm = {
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId,
      dueDate: task.dueDate,
      percentComplete: task.percentComplete,
    };
    this.dependencies.set(await this.projectService.listDependencies(this.projectId, task.id));
  }

  closeTask(): void {
    this.selectedTask.set(null);
  }

  async saveTask(taskId: string): Promise<void> {
    this.editError.set(null);
    try {
      await this.projectService.updateTask(this.projectId, taskId, this.editForm);
      await this.reload();
      this.closeTask();
    } catch (err) {
      this.editError.set(extractApiError(err, 'Could not save the task.'));
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    this.editError.set(null);
    try {
      await this.projectService.deleteTask(this.projectId, taskId);
      this.closeTask();
      await this.reload();
    } catch (err) {
      this.editError.set(extractApiError(err, 'Could not delete the task.'));
    }
  }

  async addDependency(taskId: string): Promise<void> {
    if (!this.dependencyToAdd) return;
    this.dependencyError.set(null);
    try {
      await this.projectService.addDependency(this.projectId, taskId, this.dependencyToAdd);
      this.dependencyToAdd = '';
      this.dependencies.set(await this.projectService.listDependencies(this.projectId, taskId));
    } catch (err) {
      this.dependencyError.set(extractApiError(err, 'Could not add the dependency.'));
    }
  }

  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    await this.projectService.removeDependency(this.projectId, taskId, dependsOnTaskId);
    this.dependencies.set(await this.projectService.listDependencies(this.projectId, taskId));
  }

  async spawnTicket(taskId: string): Promise<void> {
    this.editError.set(null);
    try {
      const ticket: Ticket = await this.projectService.spawnTicketFromTask(this.projectId, taskId);
      const current = this.selectedTask();
      if (current) this.selectedTask.set({ ...current, ticketId: ticket.id });
      await this.reload();
    } catch (err) {
      this.editError.set(extractApiError(err, 'Could not spawn a ticket from this task.'));
    }
  }

  async unlinkTicketFromTask(taskId: string): Promise<void> {
    const updated = await this.projectService.unlinkTicketFromTask(this.projectId, taskId);
    this.selectedTask.set(updated);
    await this.reload();
  }
}
