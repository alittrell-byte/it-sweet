import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ScheduledReport,
  ScheduledReportCadence,
  ScheduledReportType,
  SCHEDULED_REPORT_TYPES,
} from '../../../core/models/reporting.model';
import { NotificationGroupOption } from '../../../core/models/log.model';
import { AuthService } from '../../../core/services/auth.service';
import { extractApiError } from '../../../core/utils/api-error';
import { ReportingService } from '../services/reporting.service';

@Component({
  selector: 'app-scheduled-reports',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Scheduled Reports</h1>
      <p class="text-sm text-gray-500">
        Emails the full report to a notification group on a recurring schedule.
      </p>

      @if (auth.hasPermission('reports.manage_scheduled')) {
        <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow grid grid-cols-2 gap-2">
          <input [(ngModel)]="name" name="name" placeholder="Name" required class="border rounded px-2 py-1.5 text-sm col-span-2" />
          <select [(ngModel)]="reportType" name="reportType" class="border rounded px-2 py-1.5 text-sm">
            @for (t of reportTypes; track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
            }
          </select>
          <select [(ngModel)]="cadence" name="cadence" class="border rounded px-2 py-1.5 text-sm">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <select [(ngModel)]="notifyGroupId" name="notifyGroupId" required class="border rounded px-2 py-1.5 text-sm col-span-2">
            <option value="">Select a notification group...</option>
            @for (g of notificationGroups(); track g.id) {
              <option [value]="g.id">{{ g.name }}</option>
            }
          </select>
          <button type="submit" class="col-span-2 bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">
            Create Schedule
          </button>
        </form>
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (r of reports(); track r.id) {
          <div class="p-4 flex items-center justify-between">
            <div>
              <div class="font-medium text-sm">{{ r.name }}</div>
              <div class="text-xs text-gray-500">
                {{ label(r.reportType) }} &middot; {{ r.cadence }} &middot;
                {{ r.lastSentAt ? 'Last sent ' + (r.lastSentAt | date: 'medium') : 'Never sent' }}
              </div>
            </div>
            @if (auth.hasPermission('reports.manage_scheduled')) {
              <div class="flex items-center gap-3">
                <label class="text-sm flex items-center gap-2">
                  <input type="checkbox" [ngModel]="r.isActive" (ngModelChange)="toggleActive(r, $event)" />
                  Active
                </label>
                <button (click)="remove(r.id)" class="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            }
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No scheduled reports yet.</p>
        }
      </div>
    </div>
  `,
})
export class ScheduledReportsComponent implements OnInit {
  readonly reports = signal<ScheduledReport[]>([]);
  readonly notificationGroups = signal<NotificationGroupOption[]>([]);
  readonly error = signal<string | null>(null);
  readonly reportTypes = SCHEDULED_REPORT_TYPES;

  name = '';
  reportType: ScheduledReportType = 'ticket_dashboard';
  cadence: ScheduledReportCadence = 'weekly';
  notifyGroupId = '';

  constructor(
    readonly auth: AuthService,
    private readonly reportingService: ReportingService
  ) {}

  async ngOnInit(): Promise<void> {
    const [reports, groups] = await Promise.all([
      this.reportingService.listScheduledReports(),
      this.reportingService.listNotificationGroups(),
    ]);
    this.reports.set(reports);
    this.notificationGroups.set(groups);
  }

  label(type: ScheduledReportType): string {
    return this.reportTypes.find((t) => t.value === type)?.label ?? type;
  }

  async create(): Promise<void> {
    this.error.set(null);
    if (!this.notifyGroupId) return;
    try {
      await this.reportingService.createScheduledReport({
        name: this.name,
        reportType: this.reportType,
        cadence: this.cadence,
        notifyGroupId: this.notifyGroupId,
      });
      this.name = '';
      this.notifyGroupId = '';
      this.reports.set(await this.reportingService.listScheduledReports());
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the scheduled report.'));
    }
  }

  async toggleActive(report: ScheduledReport, isActive: boolean): Promise<void> {
    await this.reportingService.updateScheduledReport(report.id, { isActive });
    this.reports.set(await this.reportingService.listScheduledReports());
  }

  async remove(id: string): Promise<void> {
    await this.reportingService.deleteScheduledReport(id);
    this.reports.set(await this.reportingService.listScheduledReports());
  }
}
