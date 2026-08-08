import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  Tag,
  Team,
  Ticket,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketPriority,
  TicketSavedView,
  TicketStatus,
} from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';
import { TicketService } from '../services/ticket.service';

const STATUS_BADGE: Record<TicketStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-purple-100 text-purple-800',
  pending_approval: 'bg-amber-100 text-amber-900',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-700',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-sky-100 text-sky-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

type SortOption = 'newest' | 'oldest' | 'priority_high' | 'priority_low';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="max-w-5xl mx-auto">
      <h1 class="text-xl font-semibold mb-4">{{ auth.isStaff() ? 'All Tickets' : 'My Tickets' }}</h1>

      @if (auth.isStaff()) {
        <div class="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="w-16 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</span>
            <div class="flex gap-2 flex-wrap">
              @for (status of statuses; track status) {
                <button
                  (click)="toggleStatus(status)"
                  class="text-sm px-3 py-1 rounded border"
                  [class.bg-slate-800]="selectedStatuses().has(status)"
                  [class.text-white]="selectedStatuses().has(status)"
                >
                  {{ status }}
                </button>
              }
            </div>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <span class="w-16 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</span>
            <div class="flex gap-2 flex-wrap">
              @for (priority of priorities; track priority) {
                <button
                  (click)="togglePriority(priority)"
                  class="text-sm px-3 py-1 rounded border"
                  [class.bg-slate-800]="selectedPriorities().has(priority)"
                  [class.text-white]="selectedPriorities().has(priority)"
                >
                  {{ priority }}
                </button>
              }
            </div>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <span class="w-16 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">Filters</span>
            <div class="flex gap-2 flex-wrap items-center">
              @if (teams().length > 0) {
                <select [(ngModel)]="filterTeamId" (ngModelChange)="onFilterChange()" class="border rounded px-2 py-1 text-sm">
                  <option value="">All teams</option>
                  @for (team of teams(); track team.id) {
                    <option [value]="team.id">{{ team.name }}</option>
                  }
                </select>
              }
              @if (tags().length > 0) {
                <select [(ngModel)]="filterTag" (ngModelChange)="onFilterChange()" class="border rounded px-2 py-1 text-sm">
                  <option value="">All tags</option>
                  @for (tag of tags(); track tag.id) {
                    <option [value]="tag.name">{{ tag.name }}</option>
                  }
                </select>
              }
              <select [(ngModel)]="sort" (ngModelChange)="onFilterChange()" class="border rounded px-2 py-1 text-sm">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="priority_high">Priority: high to low</option>
                <option value="priority_low">Priority: low to high</option>
              </select>
              <button (click)="clearFilters()" class="text-sm px-3 py-1 rounded border">Clear filters</button>
            </div>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <span class="w-16 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">Views</span>
            <div class="flex gap-2 flex-wrap items-center">
              <select [ngModel]="''" (ngModelChange)="applySavedView($event)" class="border rounded px-2 py-1 text-sm">
                <option value="">Saved views...</option>
                @for (view of savedViews(); track view.id) {
                  <option [value]="view.id">{{ view.name }}</option>
                }
              </select>
              <button (click)="saveCurrentView()" class="text-sm px-3 py-1 rounded border">Save view</button>
            </div>
          </div>
        </div>
      }

      @if (auth.isStaff() && selectedIds().size > 0) {
        <div class="bg-slate-100 rounded-lg p-3 mb-3 flex items-center gap-2 flex-wrap text-sm">
          <span class="font-medium">{{ selectedIds().size }} selected</span>
          <select [(ngModel)]="bulkStatus" class="border rounded px-2 py-1">
            <option value="">Set status...</option>
            @for (status of statuses; track status) {
              <option [value]="status">{{ status }}</option>
            }
          </select>
          <button (click)="applyBulkStatus()" class="px-2 py-1 rounded border">Apply</button>

          <select [(ngModel)]="bulkAssigneeId" class="border rounded px-2 py-1">
            <option value="">Assign to...</option>
            @for (tech of technicians(); track tech.id) {
              <option [value]="tech.id">{{ tech.displayName }}</option>
            }
          </select>
          <button (click)="applyBulkAssign()" class="px-2 py-1 rounded border">Apply</button>

          <input [(ngModel)]="bulkTags" placeholder="tag-one, tag-two" class="border rounded px-2 py-1 w-40" />
          <button (click)="applyBulkTags()" class="px-2 py-1 rounded border">Tag</button>

          @if (teams().length > 0) {
            <select [(ngModel)]="bulkTeamId" class="border rounded px-2 py-1">
              <option value="">Move to team...</option>
              @for (team of teams(); track team.id) {
                <option [value]="team.id">{{ team.name }}</option>
              }
            </select>
            <button (click)="applyBulkTeam()" class="px-2 py-1 rounded border">Apply</button>
          }

          <button (click)="clearSelection()" class="ml-auto text-slate-600 hover:underline">Clear selection</button>
        </div>
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (ticket of tickets(); track ticket.id) {
          <div class="flex items-center px-4 py-3 hover:bg-gray-50">
            @if (auth.isStaff()) {
              <input
                type="checkbox"
                class="mr-3"
                [checked]="selectedIds().has(ticket.id)"
                (change)="toggleSelected(ticket.id)"
              />
            }
            <a [routerLink]="['/tickets', ticket.id]" class="flex-1 flex items-center justify-between">
              <div>
                <div class="font-medium">#{{ ticket.id }} - {{ ticket.subject }}</div>
                <div class="text-sm text-gray-500">
                  {{ ticket.requester?.displayName }} &middot; {{ ticket.assignee?.displayName ?? 'Unassigned' }}
                  @if (ticket.team) {
                    &middot; {{ ticket.team.name }}
                  }
                </div>
              </div>
              <div class="flex gap-2 items-center">
                @for (tag of ticket.tags; track tag.id) {
                  <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{{ tag.name }}</span>
                }
                <span class="text-xs px-2 py-1 rounded" [class]="PRIORITY_BADGE[ticket.priority]">{{ ticket.priority }}</span>
                <span class="text-xs px-2 py-1 rounded" [class]="STATUS_BADGE[ticket.status]">{{ ticket.status }}</span>
              </div>
            </a>
          </div>
        } @empty {
          <div class="px-4 py-8 text-center text-gray-500">No tickets yet.</div>
        }
      </div>
    </div>
  `,
})
export class TicketListComponent implements OnInit {
  readonly tickets = signal<Ticket[]>([]);
  readonly selectedStatuses = signal<Set<TicketStatus>>(new Set());
  readonly selectedPriorities = signal<Set<TicketPriority>>(new Set());
  readonly teams = signal<Team[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly technicians = signal<User[]>([]);
  readonly savedViews = signal<TicketSavedView[]>([]);
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly statuses = TICKET_STATUSES;
  readonly priorities = TICKET_PRIORITIES;
  readonly STATUS_BADGE = STATUS_BADGE;
  readonly PRIORITY_BADGE = PRIORITY_BADGE;
  filterTeamId = '';
  filterTag = '';
  sort: SortOption = 'newest';
  bulkStatus = '';
  bulkAssigneeId = '';
  bulkTags = '';
  bulkTeamId = '';

  constructor(
    readonly auth: AuthService,
    private readonly ticketService: TicketService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.readFiltersFromUrl();
    await this.load();
    if (this.auth.isStaff()) {
      const [teams, tags, technicians, savedViews] = await Promise.all([
        this.ticketService.listTeams(),
        this.ticketService.listTags(),
        this.ticketService.listTechnicians(),
        this.ticketService.listSavedViews(),
      ]);
      this.teams.set(teams);
      this.tags.set(tags);
      this.technicians.set(technicians);
      this.savedViews.set(savedViews);
    }
  }

  private readFiltersFromUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    const priority = params.get('priority');
    this.selectedStatuses.set(new Set((status ? status.split(',') : []) as TicketStatus[]));
    this.selectedPriorities.set(new Set((priority ? priority.split(',') : []) as TicketPriority[]));
    this.filterTeamId = params.get('teamId') ?? '';
    this.filterTag = params.get('tag') ?? '';
    this.sort = (params.get('sort') as SortOption) ?? 'newest';
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: [...this.selectedStatuses()].join(',') || null,
        priority: [...this.selectedPriorities()].join(',') || null,
        teamId: this.filterTeamId || null,
        tag: this.filterTag || null,
        sort: this.sort !== 'newest' ? this.sort : null,
      },
      replaceUrl: true,
    });
  }

  private sortParams(): { sortBy: 'createdAt' | 'priority'; sortDir: 'ASC' | 'DESC' } {
    switch (this.sort) {
      case 'oldest':
        return { sortBy: 'createdAt', sortDir: 'ASC' };
      case 'priority_high':
        return { sortBy: 'priority', sortDir: 'DESC' };
      case 'priority_low':
        return { sortBy: 'priority', sortDir: 'ASC' };
      default:
        return { sortBy: 'createdAt', sortDir: 'DESC' };
    }
  }

  toggleStatus(status: TicketStatus): void {
    const next = new Set(this.selectedStatuses());
    if (next.has(status)) next.delete(status);
    else next.add(status);
    this.selectedStatuses.set(next);
    this.onFilterChange();
  }

  togglePriority(priority: TicketPriority): void {
    const next = new Set(this.selectedPriorities());
    if (next.has(priority)) next.delete(priority);
    else next.add(priority);
    this.selectedPriorities.set(next);
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.syncUrl();
    this.load();
  }

  clearFilters(): void {
    this.selectedStatuses.set(new Set());
    this.selectedPriorities.set(new Set());
    this.filterTeamId = '';
    this.filterTag = '';
    this.sort = 'newest';
    this.onFilterChange();
  }

  async load(): Promise<void> {
    const { sortBy, sortDir } = this.sortParams();
    this.tickets.set(
      await this.ticketService.listTickets({
        statuses: [...this.selectedStatuses()],
        priorities: [...this.selectedPriorities()],
        teamId: this.filterTeamId || undefined,
        tag: this.filterTag || undefined,
        sortBy,
        sortDir,
      })
    );
    this.selectedIds.set(new Set());
  }

  toggleSelected(id: number): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async applyBulkStatus(): Promise<void> {
    if (!this.bulkStatus) return;
    await this.ticketService.bulkChangeStatus([...this.selectedIds()], this.bulkStatus as TicketStatus);
    this.bulkStatus = '';
    await this.load();
  }

  async applyBulkAssign(): Promise<void> {
    if (!this.bulkAssigneeId) return;
    await this.ticketService.bulkAssign([...this.selectedIds()], this.bulkAssigneeId);
    this.bulkAssigneeId = '';
    await this.load();
  }

  async applyBulkTags(): Promise<void> {
    const tags = this.bulkTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tags.length === 0) return;
    await this.ticketService.bulkSetTags([...this.selectedIds()], tags);
    this.bulkTags = '';
    await this.load();
  }

  async applyBulkTeam(): Promise<void> {
    if (!this.bulkTeamId) return;
    await this.ticketService.bulkSetTeam([...this.selectedIds()], this.bulkTeamId);
    this.bulkTeamId = '';
    await this.load();
  }

  applySavedView(viewId: string): void {
    const view = this.savedViews().find((v) => v.id === viewId);
    if (!view) return;
    this.selectedStatuses.set(new Set((view.filters.status ? view.filters.status.split(',') : []) as TicketStatus[]));
    this.filterTeamId = view.filters.teamId ?? '';
    this.filterTag = view.filters.tag ?? '';
    this.onFilterChange();
  }

  async saveCurrentView(): Promise<void> {
    const name = window.prompt('Name this view:');
    if (!name) return;
    const view = await this.ticketService.createSavedView(name, {
      status: [...this.selectedStatuses()].join(',') || undefined,
      teamId: this.filterTeamId || undefined,
      tag: this.filterTag || undefined,
    });
    this.savedViews.set([...this.savedViews(), view]);
  }
}
