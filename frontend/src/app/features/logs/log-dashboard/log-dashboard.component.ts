import { Component, OnInit, signal } from '@angular/core';
import { LogDashboardSummary } from '../../../core/models/log.model';
import { LogService } from '../services/log.service';

@Component({
  selector: 'app-log-dashboard',
  standalone: true,
  template: `
    @if (summary(); as s) {
      <div class="max-w-5xl mx-auto space-y-6">
        <h1 class="text-xl font-semibold">Log Dashboard</h1>

        <div class="grid grid-cols-4 md:grid-cols-8 gap-3">
          @for (sev of severityKeys(s); track sev) {
            <div class="bg-white p-3 rounded-lg shadow text-center">
              <div class="text-xl font-semibold">{{ s.severityBreakdown[sev] }}</div>
              <div class="text-xs uppercase text-gray-500 mt-1">{{ sev }}</div>
            </div>
          }
        </div>

        <div class="grid grid-cols-2 gap-6">
          <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="font-medium mb-3">Top Sources (24h)</h2>
            @for (src of s.topSources; track src.sourceId) {
              <div class="flex justify-between text-sm py-1 border-b last:border-b-0">
                <span>{{ src.name }}</span>
                <span class="font-medium">{{ src.count }}</span>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">No activity in the last 24 hours.</p>
            }
          </div>

          <div class="bg-white p-4 rounded-lg shadow">
            <h2 class="font-medium mb-3">Error Rate by Hour (24h)</h2>
            @for (bucket of s.errorRateByHour; track bucket.hour) {
              <div class="flex justify-between text-sm py-1 border-b last:border-b-0">
                <span>{{ bucket.hour }}:00</span>
                <span class="font-medium text-red-700">{{ bucket.count }}</span>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">No error-tier entries in the last 24 hours.</p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class LogDashboardComponent implements OnInit {
  readonly summary = signal<LogDashboardSummary | null>(null);

  constructor(private readonly logService: LogService) {}

  async ngOnInit(): Promise<void> {
    this.summary.set(await this.logService.dashboard());
  }

  severityKeys(s: LogDashboardSummary): Array<keyof LogDashboardSummary['severityBreakdown']> {
    return Object.keys(s.severityBreakdown) as Array<keyof LogDashboardSummary['severityBreakdown']>;
  }
}
