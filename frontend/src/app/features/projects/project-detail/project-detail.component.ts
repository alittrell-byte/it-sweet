import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  PROJECT_MEMBER_ROLES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  ProjectDetail,
  ProjectMemberRole,
  ProjectPriority,
  ProjectStatus,
} from '../../../core/models/project.model';
import { Ticket } from '../../../core/models/ticket.model';
import { Asset } from '../../../core/models/asset.model';
import { User } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/utils/api-error';
import { UserService } from '../../users/services/user.service';
import { TicketService } from '../../tickets/services/ticket.service';
import { AssetService } from '../../assets/services/asset.service';
import { ProjectService, UpdateProjectInput } from '../services/project.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    @if (project(); as p) {
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between mb-2">
            @if (editable) {
              <input [(ngModel)]="form.name" class="text-xl font-semibold border-b border-gray-300 focus:outline-none" />
            } @else {
              <h1 class="text-xl font-semibold">{{ p.name }}</h1>
            }
            <a [routerLink]="['/projects', projectId, 'board']" class="text-sm text-blue-600 hover:underline">View Board →</a>
          </div>

          @if (editable) {
            <textarea [(ngModel)]="form.description" rows="2" class="w-full border rounded px-2 py-1 text-sm mb-3"></textarea>
          } @else if (p.description) {
            <p class="text-sm text-gray-600 mb-3">{{ p.description }}</p>
          }

          <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select
                [ngModel]="p.status"
                (ngModelChange)="changeStatus($event)"
                [disabled]="!editable"
                class="w-full border rounded px-2 py-1 text-sm"
              >
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priority</label>
              @if (editable) {
                <select [(ngModel)]="form.priority" class="w-full border rounded px-2 py-1 text-sm">
                  @for (pr of priorities; track pr) {
                    <option [value]="pr">{{ pr }}</option>
                  }
                </select>
              } @else {
                <p class="py-1">{{ p.priority }}</p>
              }
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Owner</label>
              <p class="py-1">{{ p.owner?.displayName || '-' }}</p>
            </div>
            <div></div>
            <div>
              <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Start</label>
              @if (editable) {
                <input type="date" [(ngModel)]="form.startDate" class="w-full border rounded px-2 py-1 text-sm" />
              } @else {
                <p class="py-1">{{ p.startDate || '-' }}</p>
              }
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Target End</label>
              @if (editable) {
                <input type="date" [(ngModel)]="form.targetEndDate" class="w-full border rounded px-2 py-1 text-sm" />
              } @else {
                <p class="py-1">{{ p.targetEndDate || '-' }}</p>
              }
            </div>
          </div>

          <div class="mb-3">
            <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{{ p.percentComplete }}% complete</span>
              <span>{{ p.taskCounts.todo }} to do &middot; {{ p.taskCounts.inProgress }} in progress &middot; {{ p.taskCounts.done }} done</span>
            </div>
            <div class="h-2 bg-gray-200 rounded overflow-hidden">
              <div class="h-full bg-slate-800" [style.width.%]="p.percentComplete"></div>
            </div>
          </div>

          @if (editable) {
            <button (click)="save()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
              Save Changes
            </button>
            @if (saveError()) {
              <span class="ml-2 text-sm text-red-600">{{ saveError() }}</span>
            }
            @if (saveMessage()) {
              <span class="ml-2 text-sm text-green-700">{{ saveMessage() }}</span>
            }
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Team</h2>
          @for (member of p.members; track member.id) {
            <div class="flex items-center justify-between text-sm py-1">
              <span>{{ member.user.displayName }}</span>
              <div class="flex items-center gap-2">
                @if (manageable) {
                  <select
                    [ngModel]="member.role"
                    (ngModelChange)="changeMemberRole(member.id, $event)"
                    class="border rounded px-2 py-0.5 text-xs"
                  >
                    @for (r of roles; track r) {
                      <option [value]="r">{{ r }}</option>
                    }
                  </select>
                  <button (click)="removeMember(member.id)" class="text-xs text-red-600 hover:underline">Remove</button>
                } @else {
                  <span class="text-xs text-gray-500">{{ member.role }}</span>
                }
              </div>
            </div>
          } @empty {
            <p class="text-sm text-gray-400">No team members yet.</p>
          }
          @if (manageable) {
            <div class="flex gap-2 mt-3">
              <select [(ngModel)]="memberToAdd" class="flex-1 border rounded px-2 py-1.5 text-sm">
                <option value="">Select a person to add...</option>
                @for (user of addableMembers(); track user.id) {
                  <option [value]="user.id">{{ user.displayName }}</option>
                }
              </select>
              <select [(ngModel)]="memberRoleToAdd" class="border rounded px-2 py-1.5 text-sm">
                @for (r of roles; track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
              <button (click)="addMember()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">Add</button>
            </div>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Linked Tickets</h2>
          @for (ticket of p.linkedTickets; track ticket.id) {
            <div class="flex items-center justify-between text-sm py-1">
              <a [routerLink]="['/tickets', ticket.id]" class="hover:text-blue-600">#{{ ticket.id }} - {{ ticket.subject }}</a>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">{{ ticket.status }}</span>
                @if (manageable) {
                  <button (click)="unlinkTicket(ticket.id)" class="text-xs text-red-600 hover:underline">Unlink</button>
                }
              </div>
            </div>
          } @empty {
            <p class="text-sm text-gray-400">No linked tickets.</p>
          }
          @if (manageable) {
            <div class="flex gap-2 mt-3">
              <select [(ngModel)]="ticketToLink" class="flex-1 border rounded px-2 py-1.5 text-sm">
                <option value="">Select a ticket to link...</option>
                @for (ticket of linkableTickets(); track ticket.id) {
                  <option [ngValue]="ticket.id">#{{ ticket.id }} - {{ ticket.subject }}</option>
                }
              </select>
              <button (click)="linkTicket()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">Link</button>
            </div>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-3">Linked Assets</h2>
          @for (asset of p.linkedAssets; track asset.id) {
            <div class="flex items-center justify-between text-sm py-1">
              <a [routerLink]="['/assets', asset.id]" class="hover:text-blue-600">{{ asset.name }} ({{ asset.type }})</a>
              @if (manageable) {
                <button (click)="unlinkAsset(asset.id)" class="text-xs text-red-600 hover:underline">Unlink</button>
              }
            </div>
          } @empty {
            <p class="text-sm text-gray-400">No linked assets.</p>
          }
          @if (manageable && canBrowseAssets) {
            <div class="flex gap-2 mt-3">
              <select [(ngModel)]="assetToLink" class="flex-1 border rounded px-2 py-1.5 text-sm">
                <option value="">Select an asset to link...</option>
                @for (asset of linkableAssets(); track asset.id) {
                  <option [value]="asset.id">{{ asset.name }} ({{ asset.type }})</option>
                }
              </select>
              <button (click)="linkAsset()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">Link</button>
            </div>
          } @else if (manageable) {
            <p class="text-xs text-gray-400 mt-2">You need asset-view access to browse and link assets.</p>
          }
        </div>
      </div>
    }
  `,
})
export class ProjectDetailComponent implements OnInit {
  readonly statuses = PROJECT_STATUSES;
  readonly priorities = PROJECT_PRIORITIES;
  readonly roles = PROJECT_MEMBER_ROLES;

  readonly project = signal<ProjectDetail | null>(null);
  readonly staff = signal<User[]>([]);
  readonly allTickets = signal<Ticket[]>([]);
  readonly allAssets = signal<Asset[]>([]);
  readonly saveError = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);

  projectId = '';
  editable = false;
  manageable = false;
  canBrowseAssets = false;
  form: UpdateProjectInput = {};
  memberToAdd = '';
  memberRoleToAdd: ProjectMemberRole = 'contributor';
  ticketToLink: number | '' = '';
  assetToLink = '';

  constructor(
    readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
    private readonly ticketService: TicketService,
    private readonly assetService: AssetService
  ) {}

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.paramMap.get('id')!;
    this.editable = this.auth.hasPermission('projects.manage');
    this.manageable = this.auth.hasPermission('projects.manage') || this.auth.hasPermission('projects.manage_tasks');
    // assets.view is a separate module's permission - a user with full projects.* access but no
    // asset access must still be able to view the project. Gate the asset-browsing fetch on it
    // rather than letting a 403 there take down the whole page (it used to, via one shared
    // Promise.all - a real bug found via live testing with a technician missing assets.view).
    this.canBrowseAssets = this.auth.hasPermission('assets.view');
    await this.reload();
  }

  async reload(): Promise<void> {
    const project = await this.projectService.getProject(this.projectId);
    this.project.set(project);
    this.form = {
      name: project.name,
      description: project.description,
      priority: project.priority,
      startDate: project.startDate,
      targetEndDate: project.targetEndDate,
    };

    // These only feed the "link a new X" pickers - a failure or missing permission in any one of
    // them must not block viewing the project itself, which is already loaded above.
    const [users, tickets, assets] = await Promise.all([
      this.userService.list().catch(() => [] as User[]),
      this.ticketService.listTickets({}).catch(() => [] as Ticket[]),
      this.canBrowseAssets ? this.assetService.list().catch(() => [] as Asset[]) : Promise.resolve([] as Asset[]),
    ]);
    this.staff.set(users.filter((u) => u.role !== 'customer'));
    this.allTickets.set(tickets);
    this.allAssets.set(assets);
  }

  addableMembers(): User[] {
    const p = this.project();
    if (!p) return [];
    const memberIds = new Set(p.members.map((m) => m.user.id));
    return this.staff().filter((u) => !memberIds.has(u.id));
  }

  linkableTickets(): Ticket[] {
    const p = this.project();
    if (!p) return [];
    const linkedIds = new Set(p.linkedTickets.map((t) => t.id));
    return this.allTickets().filter((t) => !linkedIds.has(t.id));
  }

  linkableAssets(): Asset[] {
    const p = this.project();
    if (!p) return [];
    const linkedIds = new Set(p.linkedAssets.map((a) => a.id));
    return this.allAssets().filter((a) => !linkedIds.has(a.id));
  }

  async save(): Promise<void> {
    this.saveError.set(null);
    this.saveMessage.set(null);
    try {
      await this.projectService.updateProject(this.projectId, this.form);
      this.saveMessage.set('Saved.');
      await this.reload();
    } catch (err) {
      this.saveError.set(extractApiError(err, 'Could not save the project.'));
    }
  }

  async changeStatus(status: ProjectStatus): Promise<void> {
    await this.projectService.updateProject(this.projectId, { status });
    await this.reload();
  }

  async addMember(): Promise<void> {
    if (!this.memberToAdd) return;
    await this.projectService.addMember(this.projectId, this.memberToAdd, this.memberRoleToAdd);
    this.memberToAdd = '';
    await this.reload();
  }

  async changeMemberRole(memberId: string, role: ProjectMemberRole): Promise<void> {
    await this.projectService.updateMemberRole(this.projectId, memberId, role);
    await this.reload();
  }

  async removeMember(memberId: string): Promise<void> {
    await this.projectService.removeMember(this.projectId, memberId);
    await this.reload();
  }

  async linkTicket(): Promise<void> {
    if (this.ticketToLink === '') return;
    await this.projectService.linkTicket(this.projectId, this.ticketToLink);
    this.ticketToLink = '';
    await this.reload();
  }

  async unlinkTicket(ticketId: number): Promise<void> {
    await this.projectService.unlinkTicket(this.projectId, ticketId);
    await this.reload();
  }

  async linkAsset(): Promise<void> {
    if (!this.assetToLink) return;
    await this.projectService.linkAsset(this.projectId, this.assetToLink);
    this.assetToLink = '';
    await this.reload();
  }

  async unlinkAsset(assetId: string): Promise<void> {
    await this.projectService.unlinkAsset(this.projectId, assetId);
    await this.reload();
  }
}
