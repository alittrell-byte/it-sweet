import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Ticket, TICKET_STATUSES, TicketStatus } from '../../../core/models/ticket.model';
import { TicketService } from '../services/ticket.service';

const STATUS_BADGE: Record<TicketStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-700',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-sky-100 text-sky-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-semibold">{{ auth.isStaff() ? 'All Tickets' : 'My Tickets' }}</h1>
        @if (auth.isStaff()) {
          <div class="flex gap-2">
            <button
              (click)="filterStatus.set(null); load()"
              class="text-sm px-3 py-1 rounded border"
              [class.bg-slate-800]="!filterStatus()"
              [class.text-white]="!filterStatus()"
            >
              All
            </button>
            @for (status of statuses; track status) {
              <button
                (click)="filterStatus.set(status); load()"
                class="text-sm px-3 py-1 rounded border"
                [class.bg-slate-800]="filterStatus() === status"
                [class.text-white]="filterStatus() === status"
              >
                {{ status }}
              </button>
            }
          </div>
        }
      </div>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (ticket of tickets(); track ticket.id) {
          <a [routerLink]="['/tickets', ticket.id]" class="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div>
              <div class="font-medium">#{{ ticket.id }} - {{ ticket.subject }}</div>
              <div class="text-sm text-gray-500">
                {{ ticket.requester?.displayName }} &middot; {{ ticket.assignee?.displayName ?? 'Unassigned' }}
              </div>
            </div>
            <div class="flex gap-2">
              <span class="text-xs px-2 py-1 rounded" [class]="PRIORITY_BADGE[ticket.priority]">{{ ticket.priority }}</span>
              <span class="text-xs px-2 py-1 rounded" [class]="STATUS_BADGE[ticket.status]">{{ ticket.status }}</span>
            </div>
          </a>
        } @empty {
          <div class="px-4 py-8 text-center text-gray-500">No tickets yet.</div>
        }
      </div>
    </div>
  `,
})
export class TicketListComponent implements OnInit {
  readonly tickets = signal<Ticket[]>([]);
  readonly filterStatus = signal<TicketStatus | null>(null);
  readonly statuses = TICKET_STATUSES;
  readonly STATUS_BADGE = STATUS_BADGE;
  readonly PRIORITY_BADGE = PRIORITY_BADGE;

  constructor(
    readonly auth: AuthService,
    private readonly ticketService: TicketService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    const status = this.filterStatus();
    this.tickets.set(await this.ticketService.listTickets(status ? { status } : {}));
  }
}
