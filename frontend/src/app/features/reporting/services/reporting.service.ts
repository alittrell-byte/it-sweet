import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  KbFeedbackReportRow,
  OverviewSummary,
  ScheduledReport,
  ScheduledReportCadence,
  ScheduledReportType,
} from '../../../core/models/reporting.model';
import { NotificationGroupOption } from '../../../core/models/log.model';

export interface CreateScheduledReportInput {
  name: string;
  reportType: ScheduledReportType;
  cadence: ScheduledReportCadence;
  notifyGroupId: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReportingService {
  constructor(private readonly http: HttpClient) {}

  overview(): Promise<OverviewSummary> {
    return firstValueFrom(this.http.get<OverviewSummary>('/api/reports/overview'));
  }

  kbFeedbackReport(): Promise<KbFeedbackReportRow[]> {
    return firstValueFrom(this.http.get<KbFeedbackReportRow[]>('/api/reports/kb-feedback'));
  }

  listScheduledReports(): Promise<ScheduledReport[]> {
    return firstValueFrom(this.http.get<ScheduledReport[]>('/api/reports/scheduled-reports'));
  }

  createScheduledReport(input: CreateScheduledReportInput): Promise<ScheduledReport> {
    return firstValueFrom(this.http.post<ScheduledReport>('/api/reports/scheduled-reports', input));
  }

  updateScheduledReport(id: string, input: Partial<CreateScheduledReportInput>): Promise<ScheduledReport> {
    return firstValueFrom(this.http.patch<ScheduledReport>(`/api/reports/scheduled-reports/${id}`, input));
  }

  deleteScheduledReport(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/reports/scheduled-reports/${id}`));
  }

  listNotificationGroups(): Promise<NotificationGroupOption[]> {
    return firstValueFrom(this.http.get<NotificationGroupOption[]>('/api/notification-groups'));
  }
}
