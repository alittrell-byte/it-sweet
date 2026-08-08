import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertRule,
  LOG_SEVERITIES,
  LogSeverity,
  LogSourceOption,
  NotificationGroupOption,
} from '../../../core/models/log.model';
import { extractApiError } from '../../../core/utils/api-error';
import { LogService } from '../services/log.service';

@Component({
  selector: 'app-alert-rules',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Alert Rules</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-600">Name</label>
            <input [(ngModel)]="name" name="name" required class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-600">Pattern (text match against message)</label>
            <input [(ngModel)]="pattern" name="pattern" required class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-600">Source (optional)</label>
            <select [(ngModel)]="sourceId" name="sourceId" class="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">All sources</option>
              @for (s of sources(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-600">Severity filter (optional)</label>
            <select [(ngModel)]="severityFilter" name="severityFilter" class="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">Any severity</option>
              @for (s of severities; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-600">Threshold count</label>
            <input type="number" min="1" [(ngModel)]="thresholdCount" name="thresholdCount" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-600">Within (minutes)</label>
            <input
              type="number"
              min="1"
              [(ngModel)]="thresholdWindowMinutes"
              name="thresholdWindowMinutes"
              class="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-600">Notify emails (comma-separated)</label>
            <input [(ngModel)]="notifyEmailsRaw" name="notifyEmailsRaw" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-600">Notify group (optional)</label>
            <select [(ngModel)]="notifyGroupId" name="notifyGroupId" class="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">None</option>
              @for (g of notificationGroups(); track g.id) {
                <option [value]="g.id">{{ g.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-600">Group by metadata field (optional)</label>
            <input
              [(ngModel)]="groupByMetadataField"
              name="groupByMetadataField"
              placeholder="e.g. sourceIp"
              class="w-full border rounded px-2 py-1.5 text-sm"
            />
            <p class="text-xs text-gray-400 mt-0.5">Fires when this many events share the same value, e.g. same IP</p>
          </div>
          <div>
            <label class="block text-xs text-gray-600">Webhook URL (optional)</label>
            <input [(ngModel)]="webhookUrl" name="webhookUrl" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" [(ngModel)]="createTicket" name="createTicket" />
          Auto-create a ticket when this fires
        </label>
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Create Rule</button>
      </form>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (rule of rules(); track rule.id) {
          <div class="p-4 flex items-center justify-between">
            <div>
              <div class="font-medium text-sm">{{ rule.name }}</div>
              <div class="text-xs text-gray-500">
                "{{ rule.pattern }}" &middot; {{ rule.thresholdCount }} in {{ rule.thresholdWindowMinutes }}m
                {{ rule.groupByMetadataField ? ' from the same ' + rule.groupByMetadataField : '' }}
                {{ rule.createTicket ? ' · auto-tickets' : '' }}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <label class="text-sm flex items-center gap-2">
                <input type="checkbox" [ngModel]="rule.isActive" (ngModelChange)="toggleActive(rule, $event)" />
                Active
              </label>
              <button (click)="remove(rule.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No alert rules yet.</p>
        }
      </div>
    </div>
  `,
})
export class AlertRulesComponent implements OnInit {
  readonly rules = signal<AlertRule[]>([]);
  readonly sources = signal<LogSourceOption[]>([]);
  readonly notificationGroups = signal<NotificationGroupOption[]>([]);
  readonly error = signal<string | null>(null);
  readonly severities = LOG_SEVERITIES;

  name = '';
  pattern = '';
  sourceId = '';
  severityFilter = '';
  thresholdCount = 5;
  thresholdWindowMinutes = 5;
  notifyEmailsRaw = '';
  notifyGroupId = '';
  groupByMetadataField = '';
  webhookUrl = '';
  createTicket = false;

  constructor(private readonly logService: LogService) {}

  async ngOnInit(): Promise<void> {
    const [rules, sources, notificationGroups] = await Promise.all([
      this.logService.listAlertRules(),
      this.logService.sourceOptions(),
      this.logService.listNotificationGroups(),
    ]);
    this.rules.set(rules);
    this.sources.set(sources);
    this.notificationGroups.set(notificationGroups);
  }

  async create(): Promise<void> {
    this.error.set(null);
    try {
      await this.logService.createAlertRule({
        name: this.name,
        pattern: this.pattern,
        sourceId: this.sourceId || null,
        severityFilter: (this.severityFilter || null) as LogSeverity | null,
        thresholdCount: this.thresholdCount,
        thresholdWindowMinutes: this.thresholdWindowMinutes,
        notifyEmails: this.notifyEmailsRaw
          ? this.notifyEmailsRaw.split(',').map((e) => e.trim()).filter(Boolean)
          : undefined,
        notifyGroupId: this.notifyGroupId || null,
        groupByMetadataField: this.groupByMetadataField || null,
        webhookUrl: this.webhookUrl || null,
        createTicket: this.createTicket,
      });
      this.name = '';
      this.pattern = '';
      this.notifyEmailsRaw = '';
      this.notifyGroupId = '';
      this.groupByMetadataField = '';
      this.webhookUrl = '';
      this.rules.set(await this.logService.listAlertRules());
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the alert rule.'));
    }
  }

  async toggleActive(rule: AlertRule, isActive: boolean): Promise<void> {
    await this.logService.updateAlertRule(rule.id, { isActive });
    this.rules.set(await this.logService.listAlertRules());
  }

  async remove(id: string): Promise<void> {
    await this.logService.deleteAlertRule(id);
    this.rules.set(await this.logService.listAlertRules());
  }
}
