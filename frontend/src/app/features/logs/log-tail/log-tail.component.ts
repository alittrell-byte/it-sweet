import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { LOG_SEVERITIES, LogEntry, LogSeverity, LogSourceOption } from '../../../core/models/log.model';
import { LogService } from '../services/log.service';

@Component({
  selector: 'app-log-tail',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-6xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Live Tail</h1>
        <span class="text-xs px-2 py-1 rounded" [class]="connected() ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'">
          {{ connected() ? 'Live' : 'Connecting...' }}
        </span>
      </div>

      <div class="bg-white p-4 rounded-lg shadow flex gap-2 items-end">
        <div>
          <label class="block text-xs text-gray-600">Source</label>
          <select [(ngModel)]="sourceId" (ngModelChange)="reconnect()" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All sources</option>
            @for (s of sources(); track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600">Severity</label>
          <select [(ngModel)]="severity" (ngModelChange)="reconnect()" class="border rounded px-2 py-1.5 text-sm">
            <option value="">All severities</option>
            @for (s of severities; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </div>
        <button (click)="entries.set([])" class="text-sm border rounded px-3 py-1.5 hover:bg-gray-50">Clear</button>
      </div>

      <div class="bg-slate-900 text-slate-100 rounded-lg shadow p-3 font-mono text-xs h-[60vh] overflow-y-auto">
        @for (entry of entries(); track entry.id) {
          <div class="py-0.5">
            <span class="text-slate-500">{{ entry.receivedAt | date: 'HH:mm:ss' }}</span>
            <span class="text-slate-400">[{{ entry.severity }}]</span>
            <span>{{ entry.message }}</span>
          </div>
        } @empty {
          <p class="text-slate-500">Waiting for log entries...</p>
        }
      </div>
    </div>
  `,
})
export class LogTailComponent implements OnInit, OnDestroy {
  readonly entries = signal<LogEntry[]>([]);
  readonly sources = signal<LogSourceOption[]>([]);
  readonly connected = signal(false);
  readonly severities = LOG_SEVERITIES;
  sourceId = '';
  severity = '';

  private eventSource: EventSource | null = null;

  constructor(
    private readonly logService: LogService,
    private readonly auth: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    this.sources.set(await this.logService.sourceOptions());
    this.connect();
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  reconnect(): void {
    this.eventSource?.close();
    this.entries.set([]);
    this.connect();
  }

  private connect(): void {
    const base = this.logService.tailUrl({
      sourceId: this.sourceId || undefined,
      severity: (this.severity || undefined) as LogSeverity | undefined,
    });
    const token = this.auth.getAccessToken();
    const url = `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token ?? '')}`;

    const es = new EventSource(url);
    this.eventSource = es;
    es.onopen = () => this.connected.set(true);
    es.onerror = () => this.connected.set(false);
    es.onmessage = (event) => {
      const entry = JSON.parse(event.data) as LogEntry;
      this.entries.update((current) => [...current.slice(-499), entry]);
    };
  }
}
