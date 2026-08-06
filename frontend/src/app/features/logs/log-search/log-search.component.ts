import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LOG_SEVERITIES, LogEntry, LogSeverity, LogSourceOption } from '../../../core/models/log.model';
import { LogService } from '../services/log.service';

const SEVERITY_BADGE: Record<LogSeverity, string> = {
  emergency: 'bg-red-200 text-red-900',
  alert: 'bg-red-200 text-red-900',
  critical: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  notice: 'bg-sky-100 text-sky-800',
  info: 'bg-gray-100 text-gray-700',
  debug: 'bg-gray-100 text-gray-500',
};

@Component({
  selector: 'app-log-search',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-6xl mx-auto space-y-4">
      <h1 class="text-xl font-semibold">Log Search</h1>

      <div class="bg-white p-4 rounded-lg shadow flex flex-wrap gap-2 items-end">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs text-gray-600">Text</label>
          <input [(ngModel)]="query" (keyup.enter)="search()" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="Search message..." />
        </div>
        <div>
          <label class="block text-xs text-gray-600">Source</label>
          <select [(ngModel)]="sourceId" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All sources</option>
            @for (s of sources(); track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600">Severity</label>
          <select [(ngModel)]="severity" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All severities</option>
            @for (s of severities; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600">From</label>
          <input type="datetime-local" [(ngModel)]="from" class="border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-600">To</label>
          <input type="datetime-local" [(ngModel)]="to" class="border rounded px-2 py-1.5 text-sm" />
        </div>
        <button (click)="search()" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Search</button>
      </div>

      <div class="text-sm text-gray-500">{{ total() }} result(s)</div>

      <div class="bg-white rounded-lg shadow divide-y overflow-x-auto">
        @for (entry of results(); track entry.id) {
          <div class="px-4 py-2 text-sm flex gap-3 items-start">
            <span class="text-xs px-2 py-1 rounded shrink-0" [class]="SEVERITY_BADGE[entry.severity]">{{ entry.severity }}</span>
            <span class="text-xs text-gray-400 shrink-0 w-40">{{ entry.receivedAt | date: 'short' }}</span>
            <span class="text-xs text-gray-500 shrink-0 w-32 truncate">{{ entry.source?.name ?? 'Unregistered' }}</span>
            <span class="flex-1 whitespace-pre-wrap break-words">{{ entry.message }}</span>
          </div>
        } @empty {
          <div class="px-4 py-8 text-center text-gray-500">No log entries match.</div>
        }
      </div>
    </div>
  `,
})
export class LogSearchComponent implements OnInit {
  readonly results = signal<LogEntry[]>([]);
  readonly total = signal(0);
  readonly sources = signal<LogSourceOption[]>([]);
  readonly severities = LOG_SEVERITIES;
  readonly SEVERITY_BADGE = SEVERITY_BADGE;

  query = '';
  sourceId = '';
  severity = '';
  from = '';
  to = '';

  constructor(private readonly logService: LogService) {}

  async ngOnInit(): Promise<void> {
    this.sources.set(await this.logService.sourceOptions());
    await this.search();
  }

  async search(): Promise<void> {
    const result = await this.logService.search({
      q: this.query || undefined,
      sourceId: this.sourceId || undefined,
      severity: (this.severity || undefined) as LogSeverity | undefined,
      from: this.from ? new Date(this.from).toISOString() : undefined,
      to: this.to ? new Date(this.to).toISOString() : undefined,
    });
    this.results.set(result.rows);
    this.total.set(result.total);
  }
}
