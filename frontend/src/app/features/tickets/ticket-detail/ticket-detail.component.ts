import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TICKET_STATUSES, Ticket, TicketComment, TicketStatus } from '../../../core/models/ticket.model';
import { Asset } from '../../../core/models/asset.model';
import { User } from '../../../core/models/user.model';
import { CannedResponse, TicketService } from '../services/ticket.service';
import { AssetService } from '../../assets/services/asset.service';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    @if (ticket(); as t) {
      <div class="max-w-4xl mx-auto space-y-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-xl font-semibold">#{{ t.id }} - {{ t.subject }}</h1>
              <p class="text-sm text-gray-500 mt-1">
                Requested by {{ t.requester?.displayName }} &middot; Priority: {{ t.priority }}
              </p>
            </div>
            @if (auth.isStaff()) {
              <div class="flex gap-2 items-start">
                <select
                  [ngModel]="t.status"
                  (ngModelChange)="changeStatus($event)"
                  class="border rounded px-2 py-1 text-sm"
                >
                  @for (status of statuses; track status) {
                    <option [value]="status">{{ status }}</option>
                  }
                </select>
                <select
                  [ngModel]="t.assigneeId"
                  (ngModelChange)="assign($event)"
                  class="border rounded px-2 py-1 text-sm"
                >
                  <option [ngValue]="null">Unassigned</option>
                  @for (tech of technicians(); track tech.id) {
                    <option [ngValue]="tech.id">{{ tech.displayName }}</option>
                  }
                </select>
              </div>
            }
          </div>
          <p class="mt-4 whitespace-pre-wrap">{{ t.description }}</p>
          @if (t.responseDueAt) {
            <p class="mt-3 text-xs text-gray-400">
              Response due {{ t.responseDueAt | date: 'medium' }} &middot; Resolution due
              {{ t.resolutionDueAt | date: 'medium' }}
            </p>
          }
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="font-medium mb-4">Activity</h2>
          <div class="space-y-3">
            @for (comment of comments(); track comment.id) {
              <div
                class="p-3 rounded border"
                [class.bg-amber-50]="comment.isInternal"
                [class.border-amber-300]="comment.isInternal"
                [class.bg-gray-50]="!comment.isInternal"
              >
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                  <span>
                    {{ comment.author?.displayName }}
                    @if (comment.isInternal) {
                      <span class="ml-2 uppercase tracking-wide text-amber-700 font-semibold">Internal note</span>
                    }
                  </span>
                  <span>{{ comment.createdAt | date: 'short' }}</span>
                </div>
                <p class="whitespace-pre-wrap text-sm">{{ comment.body }}</p>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">No activity yet.</p>
            }
          </div>

          <form (ngSubmit)="submitComment()" class="mt-4 space-y-2">
            @if (auth.isStaff() && cannedResponses().length > 0) {
              <select
                [ngModel]="''"
                (ngModelChange)="insertCannedResponse($event)"
                name="cannedResponse"
                class="border rounded px-2 py-1 text-sm text-gray-600"
              >
                <option value="">Insert canned response...</option>
                @for (cr of cannedResponses(); track cr.id) {
                  <option [value]="cr.id">{{ cr.title }}</option>
                }
              </select>
            }
            <textarea
              name="newComment"
              [(ngModel)]="newCommentBody"
              rows="3"
              placeholder="Add a reply..."
              class="w-full border rounded px-3 py-2 text-sm"
            ></textarea>
            <div class="flex items-center justify-between">
              @if (auth.isStaff()) {
                <label class="text-sm flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="newCommentInternal" name="isInternal" />
                  Internal note (never visible to the customer)
                </label>
              } @else {
                <span></span>
              }
              <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
                Post
              </button>
            </div>
          </form>
        </div>

        @if (auth.hasPermission('assets.view')) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">Linked Assets</h2>
            @for (asset of t.linkedAssets; track asset.id) {
              <div class="flex items-center justify-between text-sm py-1">
                <a [routerLink]="['/assets', asset.id]" class="hover:text-blue-600">{{ asset.name }} ({{ asset.type }})</a>
                <button (click)="unlinkAsset(asset.id)" class="text-xs text-red-600 hover:underline">Unlink</button>
              </div>
            } @empty {
              <p class="text-sm text-gray-400 mb-2">No linked assets.</p>
            }
            <div class="flex gap-2 mt-3">
              <select [(ngModel)]="assetToLink" name="assetToLink" class="flex-1 border rounded px-2 py-1.5 text-sm">
                <option value="">Select an asset to link...</option>
                @for (asset of linkableAssets(t); track asset.id) {
                  <option [value]="asset.id">{{ asset.name }} ({{ asset.type }})</option>
                }
              </select>
              <button (click)="linkAsset()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                Link
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class TicketDetailComponent implements OnInit {
  readonly ticket = signal<Ticket | null>(null);
  readonly comments = signal<TicketComment[]>([]);
  readonly technicians = signal<User[]>([]);
  readonly allAssets = signal<Asset[]>([]);
  readonly cannedResponses = signal<CannedResponse[]>([]);
  readonly statuses = TICKET_STATUSES as TicketStatus[];
  newCommentBody = '';
  newCommentInternal = false;
  assetToLink = '';

  constructor(
    readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly ticketService: TicketService,
    private readonly assetService: AssetService
  ) {}

  private get ticketId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
    if (this.auth.isStaff()) {
      this.technicians.set(await this.ticketService.listTechnicians());
      this.cannedResponses.set(await this.ticketService.listCannedResponses());
    }
    if (this.auth.hasPermission('assets.view')) {
      this.allAssets.set(await this.assetService.list());
    }
  }

  linkableAssets(ticket: Ticket): Asset[] {
    const linkedIds = new Set((ticket.linkedAssets ?? []).map((a) => a.id));
    return this.allAssets().filter((a) => !linkedIds.has(a.id));
  }

  async linkAsset(): Promise<void> {
    if (!this.assetToLink) return;
    await this.ticketService.linkAsset(this.ticketId, this.assetToLink);
    this.assetToLink = '';
    await this.reload();
  }

  async unlinkAsset(assetId: string): Promise<void> {
    await this.ticketService.unlinkAsset(this.ticketId, assetId);
    await this.reload();
  }

  async reload(): Promise<void> {
    const [ticket, comments] = await Promise.all([
      this.ticketService.getTicket(this.ticketId),
      this.ticketService.listComments(this.ticketId),
    ]);
    this.ticket.set(ticket);
    this.comments.set(comments);
  }

  async changeStatus(status: TicketStatus): Promise<void> {
    this.ticket.set(await this.ticketService.changeStatus(this.ticketId, status));
  }

  async assign(assigneeId: string | null): Promise<void> {
    if (!assigneeId) return;
    this.ticket.set(await this.ticketService.assign(this.ticketId, assigneeId));
  }

  insertCannedResponse(cannedResponseId: string): void {
    const cr = this.cannedResponses().find((c) => c.id === cannedResponseId);
    if (!cr) return;
    this.newCommentBody = this.newCommentBody ? `${this.newCommentBody}\n\n${cr.body}` : cr.body;
  }

  async submitComment(): Promise<void> {
    if (!this.newCommentBody.trim()) return;
    await this.ticketService.addComment(this.ticketId, this.newCommentBody, this.newCommentInternal);
    this.newCommentBody = '';
    this.newCommentInternal = false;
    await this.reload();
  }
}
