import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { ComplianceReportRow } from '../../../core/models/patch.model';
import { downloadFile } from '../../../core/utils/download';
import { PatchService } from '../services/patch.service';

@Component({
  selector: 'app-patch-compliance-report',
  standalone: true,
  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Patch Compliance Report</h1>
        <button (click)="downloadCsv()" class="text-sm text-blue-600 hover:underline">Download CSV</button>
      </div>
      <p class="text-sm text-gray-500">Only approved patches count toward these numbers.</p>
      <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="px-4 py-2">Asset</th>
              <th class="px-4 py-2">Compliant</th>
              <th class="px-4 py-2">Missing</th>
              <th class="px-4 py-2">Failed</th>
              <th class="px-4 py-2">Compliance</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (row of rows(); track row.assetId) {
              <tr>
                <td class="px-4 py-2">{{ row.assetName }}</td>
                <td class="px-4 py-2">{{ row.compliantCount }}</td>
                <td class="px-4 py-2">{{ row.missingCount }}</td>
                <td class="px-4 py-2">{{ row.failedCount }}</td>
                <td class="px-4 py-2">
                  <span
                    class="px-2 py-1 rounded text-xs"
                    [class.bg-red-100]="row.compliancePercent < 90"
                    [class.text-red-800]="row.compliancePercent < 90"
                    [class.bg-green-100]="row.compliancePercent >= 90"
                    [class.text-green-800]="row.compliancePercent >= 90"
                  >
                    {{ row.compliancePercent }}%
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500">No approved patch data reported yet.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class PatchComplianceReportComponent implements OnInit {
  readonly rows = signal<ComplianceReportRow[]>([]);

  constructor(
    private readonly patchService: PatchService,
    private readonly http: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    this.rows.set(await this.patchService.complianceReport());
  }

  downloadCsv(): Promise<void> {
    return downloadFile(this.http, '/api/reports/patches/compliance.csv', 'patch-compliance.csv');
  }
}
