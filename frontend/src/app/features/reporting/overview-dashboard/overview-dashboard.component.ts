import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverviewSummary } from '../../../core/models/reporting.model';
import { ReportingService } from '../services/reporting.service';

@Component({
  selector: 'app-overview-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-5xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Overview</h1>
      <p class="text-sm text-gray-500">
        Only sections for modules you have access to appear here - each card links through to
        that module's full report.
      </p>

      @if (summary(); as s) {
        <div class="grid grid-cols-2 gap-4">
          @if (s.tickets; as t) {
            <div class="bg-white p-4 rounded-lg shadow">
              <h2 class="font-medium mb-2">Tickets</h2>
              <div class="text-sm space-y-1">
                <div>Open: <strong>{{ openTotal(t.openByStatus) }}</strong></div>
                <div>Aging (3+ days): <strong>{{ t.agingTickets.length }}</strong></div>
                <div>SLA breached: <strong class="text-red-600">{{ t.breachedCount }}</strong></div>
                <div>Avg CSAT: <strong>{{ t.avgCsatRating ?? 'N/A' }}</strong> ({{ t.csatResponseCount }} responses)</div>
              </div>
              <a routerLink="/dashboard" class="text-xs text-blue-600 hover:underline mt-2 inline-block">View ticket dashboard &rarr;</a>
            </div>
          }
          @if (s.assets; as a) {
            <div class="bg-white p-4 rounded-lg shadow">
              <h2 class="font-medium mb-2">Assets</h2>
              <div class="text-sm space-y-1">
                <div>Licenses tracked: <strong>{{ a.licenseCompliance.length }}</strong></div>
                <div>Avg license utilization: <strong>{{ a.avgLicenseUtilization }}%</strong></div>
                <div>Depreciable assets: <strong>{{ a.depreciation.length }}</strong></div>
                <div>Total current value: <strong>\${{ a.totalCurrentValue }}</strong></div>
              </div>
              <a routerLink="/assets/license-compliance" class="text-xs text-blue-600 hover:underline mt-2 inline-block">
                View license compliance &rarr;
              </a>
            </div>
          }
          @if (s.patches; as p) {
            <div class="bg-white p-4 rounded-lg shadow">
              <h2 class="font-medium mb-2">Patch Compliance</h2>
              <div class="text-sm space-y-1">
                <div>Assets tracked: <strong>{{ p.complianceReport.length }}</strong></div>
                <div>Below 90% compliant: <strong class="text-red-600">{{ p.assetsBelowNinetyPercent }}</strong></div>
              </div>
              <a routerLink="/patches/compliance-report" class="text-xs text-blue-600 hover:underline mt-2 inline-block">
                View patch compliance &rarr;
              </a>
            </div>
          }
          @if (s.logs; as l) {
            <div class="bg-white p-4 rounded-lg shadow">
              <h2 class="font-medium mb-2">Logs (24h)</h2>
              <div class="text-sm space-y-1">
                <div>Top source: <strong>{{ l.topSources[0] ? l.topSources[0].name : 'N/A' }}</strong></div>
                <div>Error-tier entries: <strong>{{ errorCount(l.errorRateByHour) }}</strong></div>
              </div>
              <a routerLink="/logs/dashboard" class="text-xs text-blue-600 hover:underline mt-2 inline-block">View log dashboard &rarr;</a>
            </div>
          }
        </div>
        @if (!s.tickets && !s.assets && !s.patches && !s.logs) {
          <p class="text-sm text-gray-400">No report sections available for your permissions.</p>
        }
      }
    </div>
  `,
})
export class OverviewDashboardComponent implements OnInit {
  readonly summary = signal<OverviewSummary | null>(null);

  constructor(private readonly reportingService: ReportingService) {}

  async ngOnInit(): Promise<void> {
    this.summary.set(await this.reportingService.overview());
  }

  openTotal(openByStatus: Record<string, number>): number {
    return Object.values(openByStatus).reduce((sum, v) => sum + v, 0);
  }

  errorCount(errorRateByHour: Array<{ count: number }>): number {
    return errorRateByHour.reduce((sum, r) => sum + r.count, 0);
  }
}
