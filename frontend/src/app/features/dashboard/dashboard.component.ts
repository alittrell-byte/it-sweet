import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardSummary } from '../../core/models/ticket.model';
import { downloadFile } from '../../core/utils/download';
import { TicketService } from '../tickets/services/ticket.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (summary(); as s) {
      <div class="max-w-5xl mx-auto space-y-6">
        <div class="flex justify-end">
          <button (click)="downloadCsv()" class="text-sm text-blue-600 hover:underline">Download CSV</button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          @for (status of statusKeys(s); track status) {
            <div class="bg-white p-4 rounded-lg shadow text-center">
              <div class="text-2xl font-semibold">{{ s.openByStatus[status] }}</div>
              <div class="text-xs uppercase text-gray-500 mt-1">{{ status }}</div>
            </div>
          }
        </div>

        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-2xl font-semibold text-red-600">{{ s.breachedCount }}</div>
          <div class="text-xs uppercase text-gray-500">SLA breaches (open tickets)</div>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="font-medium mb-3">Workload by Technician</h2>
            @for (w of s.workloadByTech; track w.assigneeId) {
              <div class="flex justify-between text-sm py-1 border-b last:border-b-0">
                <span>{{ w.displayName }}</span>
                <span class="font-medium">{{ w.openCount }}</span>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">No open assignments.</p>
            }
          </div>

          <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="font-medium mb-3">Aging Tickets (3+ days)</h2>
            @for (t of s.agingTickets; track t.id) {
              <a [routerLink]="['/tickets', t.id]" class="flex justify-between text-sm py-1 border-b last:border-b-0 hover:text-blue-600">
                <span>#{{ t.id }} {{ t.subject }}</span>
                <span class="font-medium">{{ t.ageInDays }}d</span>
              </a>
            } @empty {
              <p class="text-sm text-gray-400">Nothing aging right now.</p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardComponent implements OnInit {
  readonly summary = signal<DashboardSummary | null>(null);

  constructor(
    private readonly ticketService: TicketService,
    private readonly http: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    this.summary.set(await this.ticketService.getDashboard());
  }

  downloadCsv(): Promise<void> {
    return downloadFile(this.http, '/api/reports/tickets/aging.csv', 'ticket-dashboard.csv');
  }

  statusKeys(s: DashboardSummary): Array<keyof DashboardSummary['openByStatus']> {
    return Object.keys(s.openByStatus) as Array<keyof DashboardSummary['openByStatus']>;
  }
}
