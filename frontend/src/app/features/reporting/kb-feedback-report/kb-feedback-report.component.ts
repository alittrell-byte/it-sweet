import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { KbFeedbackReportRow } from '../../../core/models/reporting.model';
import { downloadFile } from '../../../core/utils/download';
import { ReportingService } from '../services/reporting.service';

@Component({
  selector: 'app-kb-feedback-report',
  standalone: true,
  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Knowledge Base Feedback</h1>
        <button (click)="downloadCsv()" class="text-sm text-blue-600 hover:underline">Download CSV</button>
      </div>
      <p class="text-sm text-gray-500">Sorted worst-first - these are the articles that need work.</p>
      <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="px-4 py-2">Article</th>
              <th class="px-4 py-2">Helpful</th>
              <th class="px-4 py-2">Not Helpful</th>
              <th class="px-4 py-2">Helpful %</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (row of rows(); track row.articleId) {
              <tr>
                <td class="px-4 py-2">{{ row.title }}</td>
                <td class="px-4 py-2">{{ row.helpfulCount }}</td>
                <td class="px-4 py-2">{{ row.notHelpfulCount }}</td>
                <td class="px-4 py-2">
                  <span
                    class="px-2 py-1 rounded text-xs"
                    [class.bg-red-100]="row.helpfulPercent < 50"
                    [class.text-red-800]="row.helpfulPercent < 50"
                    [class.bg-green-100]="row.helpfulPercent >= 50"
                    [class.text-green-800]="row.helpfulPercent >= 50"
                  >
                    {{ row.helpfulPercent }}%
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500">No feedback recorded yet.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class KbFeedbackReportComponent implements OnInit {
  readonly rows = signal<KbFeedbackReportRow[]>([]);

  constructor(
    private readonly reportingService: ReportingService,
    private readonly http: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    this.rows.set(await this.reportingService.kbFeedbackReport());
  }

  downloadCsv(): Promise<void> {
    return downloadFile(this.http, '/api/reports/kb-feedback.csv', 'kb-feedback.csv');
  }
}
