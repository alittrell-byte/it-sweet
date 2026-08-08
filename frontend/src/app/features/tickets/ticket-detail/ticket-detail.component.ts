import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  TICKET_STATUSES,
  Team,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketSatisfactionSurvey,
  TicketStatus,
  TicketTimeEntry,
} from '../../../core/models/ticket.model';
import { Asset } from '../../../core/models/asset.model';
import { KnowledgeBaseArticle } from '../../../core/models/kb.model';
import { User } from '../../../core/models/user.model';
import { CannedResponse, TicketService } from '../services/ticket.service';
import { AssetService } from '../../assets/services/asset.service';
import { KbService } from '../../knowledge-base/services/kb.service';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    @if (ticket(); as t) {
      <div class="max-w-4xl mx-auto space-y-6">
        @if (t.status === 'pending_approval') {
          <div class="bg-amber-50 border border-amber-300 p-4 rounded-lg flex items-center justify-between">
            <div>
              <p class="font-medium text-amber-800">This ticket requires approval before work begins.</p>
              @if (t.approvalReason) {
                <p class="text-sm text-amber-700 mt-1">Note: {{ t.approvalReason }}</p>
              }
            </div>
            @if (auth.hasPermission('tickets.approve')) {
              <div class="flex gap-2 items-center">
                <input
                  [(ngModel)]="rejectReason"
                  placeholder="Reason (optional)"
                  class="border rounded px-2 py-1 text-sm"
                />
                <button (click)="reject()" class="text-sm bg-red-600 text-white rounded px-3 py-1.5 hover:bg-red-700">
                  Reject
                </button>
                <button (click)="approve()" class="text-sm bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-700">
                  Approve
                </button>
              </div>
            }
          </div>
        }

        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-xl font-semibold">#{{ t.id }} - {{ t.subject }}</h1>
              <p class="text-sm text-gray-500 mt-1">
                Requested by {{ t.requester?.displayName }} &middot; Priority: {{ t.priority }}
                @if (t.team) {
                  &middot; Team: {{ t.team.name }}
                }
              </p>
              @if (t.tags && t.tags.length > 0) {
                <div class="flex gap-1 mt-2 flex-wrap">
                  @for (tag of t.tags; track tag.id) {
                    <span class="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{{ tag.name }}</span>
                  }
                </div>
              }
            </div>
            @if (auth.isStaff()) {
              <div class="flex gap-2 items-start">
                <select
                  [ngModel]="t.status"
                  (ngModelChange)="changeStatus($event)"
                  [disabled]="t.status === 'pending_approval'"
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
          @if (ticketAttachments().length > 0) {
            <div class="mt-3 flex gap-2 flex-wrap">
              @for (attachment of ticketAttachments(); track attachment.id) {
                <a
                  [href]="downloadUrl(attachment.id)"
                  target="_blank"
                  class="text-xs px-2 py-1 rounded border text-slate-600 hover:text-blue-600"
                >
                  {{ attachment.fileName }}
                </a>
              }
            </div>
          }
          @if (t.responseDueAt) {
            <p class="mt-3 text-xs text-gray-400">
              Response due {{ t.responseDueAt | date: 'medium' }} &middot; Resolution due
              {{ t.resolutionDueAt | date: 'medium' }}
            </p>
          }
        </div>

        @if (auth.isStaff()) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">Team / Escalation</h2>
            <div class="flex items-center gap-2 text-sm">
              <span class="text-gray-600">Current: {{ t.team?.name ?? 'Unassigned' }}</span>
              @if (teams().length > 0) {
                <select [(ngModel)]="escalateTargetId" class="border rounded px-2 py-1.5 text-sm ml-auto">
                  <option value="">Default (next tier)</option>
                  @for (team of teams(); track team.id) {
                    <option [value]="team.id">{{ team.name }}</option>
                  }
                </select>
                <button (click)="escalate()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                  Escalate
                </button>
              }
            </div>
            <div class="flex gap-2 mt-3">
              <input [(ngModel)]="tagInput" placeholder="tag-one, tag-two" class="flex-1 border rounded px-2 py-1.5 text-sm" />
              <button (click)="saveTags()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                Save Tags
              </button>
            </div>
          </div>
        }

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
                @if (commentAttachments(comment.id).length > 0) {
                  <div class="mt-2 flex gap-2 flex-wrap">
                    @for (attachment of commentAttachments(comment.id); track attachment.id) {
                      <a
                        [href]="downloadUrl(attachment.id)"
                        target="_blank"
                        class="text-xs px-2 py-1 rounded border bg-white text-slate-600 hover:text-blue-600"
                      >
                        {{ attachment.fileName }}
                      </a>
                    }
                  </div>
                }
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
            <div class="flex items-center gap-3">
              <input type="file" (change)="onReplyFileSelected($event)" class="text-sm" />
              @if (replyFile) {
                <span class="text-xs text-gray-500">{{ replyFile.name }}</span>
              }
            </div>
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

        @if (auth.isStaff()) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">Time Logged @if (t.totalMinutesLogged) {({{ t.totalMinutesLogged }} min total)}</h2>
            @for (entry of timeEntries(); track entry.id) {
              <div class="flex items-center justify-between text-sm py-1">
                <span>{{ entry.technician?.displayName }} &middot; {{ entry.minutes }} min @if (entry.note) {&middot; {{ entry.note }}}</span>
                @if (canDeleteTimeEntry(entry)) {
                  <button (click)="deleteTimeEntry(entry.id)" class="text-xs text-red-600 hover:underline">Delete</button>
                }
              </div>
            } @empty {
              <p class="text-sm text-gray-400 mb-2">No time logged yet.</p>
            }
            <div class="flex gap-2 mt-3">
              <input type="number" min="1" [(ngModel)]="timeMinutes" placeholder="Minutes" class="w-24 border rounded px-2 py-1.5 text-sm" />
              <input [(ngModel)]="timeNote" placeholder="Note (optional)" class="flex-1 border rounded px-2 py-1.5 text-sm" />
              <button (click)="logTime()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
                Log Time
              </button>
            </div>
          </div>
        }

        @if (t.status === 'closed' && !auth.isStaff()) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">How did we do?</h2>
            @if (survey() && survey()!.submittedAt) {
              <p class="text-sm text-gray-600">Thanks for your feedback! You rated this ticket {{ survey()!.rating }}/5.</p>
            } @else {
              <div class="flex gap-1 mb-3">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button
                    (click)="surveyRating = n"
                    class="w-9 h-9 rounded border text-sm"
                    [class.bg-amber-400]="surveyRating === n"
                    [class.border-amber-500]="surveyRating === n"
                  >
                    {{ n }}
                  </button>
                }
              </div>
              <textarea [(ngModel)]="surveyComment" rows="2" placeholder="Optional comment" class="w-full border rounded px-3 py-2 text-sm mb-2"></textarea>
              <button
                (click)="submitSurvey()"
                [disabled]="!surveyRating"
                class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700 disabled:opacity-50"
              >
                Submit Feedback
              </button>
            }
          </div>
        }

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

        @if (auth.isStaff()) {
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="font-medium mb-3">Linked KB Articles</h2>
            @for (article of t.linkedArticles; track article.id) {
              <div class="flex items-center justify-between text-sm py-1">
                <a [routerLink]="['/kb', article.id]" class="hover:text-blue-600">{{ article.title }}</a>
                <button (click)="unlinkArticle(article.id)" class="text-xs text-red-600 hover:underline">Unlink</button>
              </div>
            } @empty {
              <p class="text-sm text-gray-400 mb-2">No linked articles.</p>
            }
            <div class="flex gap-2 mt-3">
              <select [(ngModel)]="articleToLink" name="articleToLink" class="flex-1 border rounded px-2 py-1.5 text-sm">
                <option value="">Select an article to link...</option>
                @for (article of linkableArticles(t); track article.id) {
                  <option [value]="article.id">{{ article.title }}</option>
                }
              </select>
              <button (click)="linkArticle()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
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
  readonly allArticles = signal<KnowledgeBaseArticle[]>([]);
  readonly cannedResponses = signal<CannedResponse[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly timeEntries = signal<TicketTimeEntry[]>([]);
  readonly survey = signal<TicketSatisfactionSurvey | null>(null);
  readonly attachments = signal<TicketAttachment[]>([]);
  readonly statuses = TICKET_STATUSES.filter((s) => s !== 'pending_approval') as TicketStatus[];
  newCommentBody = '';
  newCommentInternal = false;
  replyFile: File | null = null;
  assetToLink = '';
  articleToLink = '';
  rejectReason = '';
  escalateTargetId = '';
  tagInput = '';
  timeMinutes: number | null = null;
  timeNote = '';
  surveyRating = 0;
  surveyComment = '';

  constructor(
    readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly ticketService: TicketService,
    private readonly assetService: AssetService,
    private readonly kbService: KbService
  ) {}

  private get ticketId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
    if (this.auth.isStaff()) {
      this.technicians.set(await this.ticketService.listTechnicians());
      this.cannedResponses.set(await this.ticketService.listCannedResponses());
      this.teams.set(await this.ticketService.listTeams());
      this.timeEntries.set(await this.ticketService.listTimeEntries(this.ticketId));
    }
    if (this.auth.hasPermission('assets.view')) {
      this.allAssets.set(await this.assetService.list());
    }
    if (this.auth.isStaff()) {
      this.allArticles.set(await this.kbService.listArticles());
    }
    if (this.ticket()?.status === 'closed') {
      this.survey.set(await this.ticketService.getSurvey(this.ticketId));
    }
  }

  linkableAssets(ticket: Ticket): Asset[] {
    const linkedIds = new Set((ticket.linkedAssets ?? []).map((a) => a.id));
    return this.allAssets().filter((a) => !linkedIds.has(a.id));
  }

  linkableArticles(ticket: Ticket): KnowledgeBaseArticle[] {
    const linkedIds = new Set((ticket.linkedArticles ?? []).map((a) => a.id));
    return this.allArticles().filter((a) => !linkedIds.has(a.id));
  }

  async linkArticle(): Promise<void> {
    if (!this.articleToLink) return;
    await this.ticketService.linkArticle(this.ticketId, this.articleToLink);
    this.articleToLink = '';
    await this.reload();
  }

  async unlinkArticle(articleId: string): Promise<void> {
    await this.ticketService.unlinkArticle(this.ticketId, articleId);
    await this.reload();
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
    const [ticket, comments, attachments] = await Promise.all([
      this.ticketService.getTicket(this.ticketId),
      this.ticketService.listComments(this.ticketId),
      this.ticketService.listAttachments(this.ticketId),
    ]);
    this.ticket.set(ticket);
    this.comments.set(comments);
    this.attachments.set(attachments);
    this.tagInput = (ticket.tags ?? []).map((t) => t.name).join(', ');
  }

  ticketAttachments(): TicketAttachment[] {
    return this.attachments().filter((a) => !a.commentId);
  }

  commentAttachments(commentId: string): TicketAttachment[] {
    return this.attachments().filter((a) => a.commentId === commentId);
  }

  downloadUrl(attachmentId: string): string {
    const token = this.auth.getAccessToken();
    const base = this.ticketService.attachmentDownloadUrl(this.ticketId, attachmentId);
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }

  onReplyFileSelected(event: Event): void {
    this.replyFile = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  async changeStatus(status: TicketStatus): Promise<void> {
    this.ticket.set(await this.ticketService.changeStatus(this.ticketId, status));
  }

  async approve(): Promise<void> {
    this.ticket.set(await this.ticketService.approve(this.ticketId));
  }

  async reject(): Promise<void> {
    this.ticket.set(await this.ticketService.reject(this.ticketId, this.rejectReason || undefined));
    this.rejectReason = '';
  }

  async assign(assigneeId: string | null): Promise<void> {
    if (!assigneeId) return;
    this.ticket.set(await this.ticketService.assign(this.ticketId, assigneeId));
  }

  async escalate(): Promise<void> {
    this.ticket.set(await this.ticketService.escalate(this.ticketId, this.escalateTargetId || undefined));
    this.escalateTargetId = '';
  }

  async saveTags(): Promise<void> {
    const tags = this.tagInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    this.ticket.set(await this.ticketService.setTags(this.ticketId, tags));
  }

  canDeleteTimeEntry(entry: TicketTimeEntry): boolean {
    return entry.technicianId === this.auth.currentUser()?.id || this.auth.currentUser()?.role === 'admin';
  }

  async logTime(): Promise<void> {
    if (!this.timeMinutes || this.timeMinutes <= 0) return;
    await this.ticketService.logTime(this.ticketId, this.timeMinutes, this.timeNote || undefined);
    this.timeMinutes = null;
    this.timeNote = '';
    this.timeEntries.set(await this.ticketService.listTimeEntries(this.ticketId));
    await this.reload();
  }

  async deleteTimeEntry(entryId: string): Promise<void> {
    await this.ticketService.deleteTimeEntry(this.ticketId, entryId);
    this.timeEntries.set(await this.ticketService.listTimeEntries(this.ticketId));
    await this.reload();
  }

  async submitSurvey(): Promise<void> {
    if (!this.surveyRating) return;
    this.survey.set(await this.ticketService.submitSurvey(this.ticketId, this.surveyRating, this.surveyComment || undefined));
  }

  insertCannedResponse(cannedResponseId: string): void {
    const cr = this.cannedResponses().find((c) => c.id === cannedResponseId);
    if (!cr) return;
    this.newCommentBody = this.newCommentBody ? `${this.newCommentBody}\n\n${cr.body}` : cr.body;
  }

  async submitComment(): Promise<void> {
    if (!this.newCommentBody.trim()) return;
    const comment = await this.ticketService.addComment(this.ticketId, this.newCommentBody, this.newCommentInternal);
    if (this.replyFile) {
      await this.ticketService.uploadAttachment(this.ticketId, this.replyFile, comment.id);
      this.replyFile = null;
    }
    this.newCommentBody = '';
    this.newCommentInternal = false;
    await this.reload();
  }
}
