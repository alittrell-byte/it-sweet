import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Asset } from '../../../core/models/asset.model';
import { LogSource, LogSourceType } from '../../../core/models/log.model';
import { Team } from '../../../core/models/ticket.model';
import { extractApiError } from '../../../core/utils/api-error';
import { AssetService } from '../../assets/services/asset.service';
import { LogService } from '../services/log.service';

@Component({
  selector: 'app-log-sources',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Log Sources &amp; Retention</h1>

      <div class="bg-white p-4 rounded-lg shadow">
        <h2 class="font-medium mb-3">Global Default Retention</h2>
        <div class="flex items-end gap-3">
          <div>
            <label class="block text-xs text-gray-600">Days</label>
            <input type="number" min="1" [(ngModel)]="defaultRetentionDays" class="w-28 border rounded px-2 py-1.5 text-sm" />
          </div>
          <label class="flex items-center gap-2 text-sm pb-1.5">
            <input type="checkbox" [(ngModel)]="archiveBeforePurge" />
            Archive to cold storage before purging
          </label>
          <button (click)="saveRetention()" class="text-sm bg-slate-800 text-white rounded px-4 py-1.5 hover:bg-slate-700">
            Save
          </button>
          <button (click)="purgeNow()" class="text-sm border border-red-300 text-red-600 rounded px-4 py-1.5 hover:bg-red-50">
            Purge Now
          </button>
        </div>
        @if (purgeMessage()) {
          <p class="text-sm text-green-700 mt-2">{{ purgeMessage() }}</p>
        }
      </div>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow flex gap-2 items-end">
        <div class="flex-1">
          <label class="block text-xs text-gray-600">Name</label>
          <input [(ngModel)]="name" name="name" required placeholder="web-server-1" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-600">Type</label>
          <select [(ngModel)]="type" name="type" class="border rounded px-2 py-1.5 text-sm">
            <option value="http">HTTP</option>
            <option value="syslog">Syslog</option>
            <option value="internal">Internal</option>
          </select>
        </div>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Register</button>
      </form>
      @if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (s of sources(); track s.id) {
          <div class="p-4">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-medium text-sm">{{ s.name }}</div>
                <div class="text-xs text-gray-500">{{ s.type }}</div>
              </div>
              <button (click)="remove(s.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
            <div class="mt-2 flex items-center gap-2 text-xs">
              <span class="text-gray-500">API Key:</span>
              <code class="bg-gray-100 px-2 py-1 rounded">{{ s.apiKey }}</code>
              <button (click)="rotateKey(s.id)" class="text-blue-600 hover:underline">Rotate</button>
            </div>
            <div class="mt-2 flex items-center gap-2 text-xs">
              <span class="text-gray-500">Retention override (days, blank = use global default):</span>
              <input
                type="number"
                min="1"
                [ngModel]="s.retentionDays"
                (change)="updateRetention(s, $event)"
                class="w-20 border rounded px-2 py-1"
              />
            </div>
            <div class="mt-2 flex items-center gap-2 text-xs">
              <span class="text-gray-500">Restrict visibility to team:</span>
              <select [ngModel]="s.restrictedToTeamId" (ngModelChange)="updateSourceField(s, 'restrictedToTeamId', $event)" class="border rounded px-2 py-1">
                <option [ngValue]="null">Anyone with log access</option>
                @for (t of teams(); track t.id) {
                  <option [ngValue]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>
            <div class="mt-2 flex items-center gap-2 text-xs">
              <span class="text-gray-500">Correlated asset:</span>
              <select [ngModel]="s.assetId" (ngModelChange)="updateSourceField(s, 'assetId', $event)" class="border rounded px-2 py-1">
                <option [ngValue]="null">None</option>
                @for (a of assets(); track a.id) {
                  <option [ngValue]="a.id">{{ a.name }}</option>
                }
              </select>
            </div>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No sources registered yet.</p>
        }
      </div>
    </div>
  `,
})
export class LogSourcesComponent implements OnInit {
  readonly sources = signal<LogSource[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly assets = signal<Asset[]>([]);
  readonly error = signal<string | null>(null);
  readonly purgeMessage = signal<string | null>(null);
  defaultRetentionDays = 30;
  archiveBeforePurge = false;
  name = '';
  type: LogSourceType = 'http';

  constructor(
    private readonly logService: LogService,
    private readonly assetService: AssetService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadTeams(), this.loadAssets()]);
    const settings = await this.logService.getRetentionSettings();
    this.defaultRetentionDays = settings.defaultRetentionDays;
    this.archiveBeforePurge = settings.archiveBeforePurge;
  }

  async load(): Promise<void> {
    this.sources.set(await this.logService.listSources());
  }

  async loadTeams(): Promise<void> {
    this.teams.set(await this.logService.listTeams());
  }

  async loadAssets(): Promise<void> {
    this.assets.set(await this.assetService.list());
  }

  async saveRetention(): Promise<void> {
    const settings = await this.logService.updateRetentionSettings({
      defaultRetentionDays: this.defaultRetentionDays,
      archiveBeforePurge: this.archiveBeforePurge,
    });
    this.defaultRetentionDays = settings.defaultRetentionDays;
    this.archiveBeforePurge = settings.archiveBeforePurge;
  }

  async purgeNow(): Promise<void> {
    const res = await this.logService.purgeNow();
    this.purgeMessage.set(`Purged ${res.deleted} expired entries.`);
  }

  async create(): Promise<void> {
    this.error.set(null);
    try {
      await this.logService.createSource({ name: this.name, type: this.type });
      this.name = '';
      await this.load();
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not register the source.'));
    }
  }

  async rotateKey(id: string): Promise<void> {
    await this.logService.rotateSourceKey(id);
    await this.load();
  }

  async updateRetention(source: LogSource, event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value;
    const retentionDays = value ? Number(value) : null;
    await this.logService.updateSource(source.id, { retentionDays });
    await this.load();
  }

  async updateSourceField(source: LogSource, field: 'restrictedToTeamId' | 'assetId', value: string | null): Promise<void> {
    const patch = field === 'restrictedToTeamId' ? { restrictedToTeamId: value || null } : { assetId: value || null };
    await this.logService.updateSource(source.id, patch);
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.logService.deleteSource(id);
    await this.load();
  }
}
