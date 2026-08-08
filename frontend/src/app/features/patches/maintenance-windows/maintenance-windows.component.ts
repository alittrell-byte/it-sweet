import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaintenanceWindow, MaintenanceWindowRecurrence } from '../../../core/models/patch.model';
import { Team } from '../../../core/models/ticket.model';
import { AuthService } from '../../../core/services/auth.service';
import { extractApiError } from '../../../core/utils/api-error';
import { PatchService } from '../services/patch.service';

@Component({
  selector: 'app-maintenance-windows',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Maintenance Windows</h1>
      <p class="text-sm text-gray-500">
        Informational scheduling only - nothing in this app gates or triggers patch installs
        against a window.
      </p>

      @if (auth.hasPermission('patches.manage_windows')) {
        <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <input [(ngModel)]="name" name="name" placeholder="Name" required class="border rounded px-2 py-1.5 text-sm" />
            <select [(ngModel)]="teamId" name="teamId" class="border rounded px-2 py-1.5 text-sm">
              <option [ngValue]="null">No team</option>
              @for (t of teams(); track t.id) {
                <option [ngValue]="t.id">{{ t.name }}</option>
              }
            </select>
            <div>
              <label class="block text-xs text-gray-600">Starts</label>
              <input type="datetime-local" [(ngModel)]="startsAt" name="startsAt" required class="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-600">Ends</label>
              <input type="datetime-local" [(ngModel)]="endsAt" name="endsAt" required class="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <select [(ngModel)]="recurrence" name="recurrence" class="border rounded px-2 py-1.5 text-sm">
              <option value="once">Once</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <textarea [(ngModel)]="notes" name="notes" placeholder="Notes (optional)" rows="2" class="w-full border rounded px-2 py-1.5 text-sm"></textarea>
          <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add Window</button>
        </form>
        @if (error()) {
          <p class="text-sm text-red-600">{{ error() }}</p>
        }
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (w of windows(); track w.id) {
          <div class="p-4 flex justify-between items-center">
            <div>
              <div class="font-medium text-sm">{{ w.name }}</div>
              <div class="text-xs text-gray-500">
                {{ w.startsAt | date: 'medium' }} &rarr; {{ w.endsAt | date: 'medium' }} &middot; {{ w.recurrence }}
                @if (w.team) {
                  &middot; {{ w.team.name }}
                }
              </div>
              @if (w.notes) {
                <div class="text-xs text-gray-400 mt-0.5">{{ w.notes }}</div>
              }
            </div>
            @if (auth.hasPermission('patches.manage_windows')) {
              <button (click)="remove(w.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            }
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No maintenance windows scheduled.</p>
        }
      </div>
    </div>
  `,
})
export class MaintenanceWindowsComponent implements OnInit {
  readonly windows = signal<MaintenanceWindow[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly error = signal<string | null>(null);

  name = '';
  teamId: string | null = null;
  startsAt = '';
  endsAt = '';
  recurrence: MaintenanceWindowRecurrence = 'once';
  notes = '';

  constructor(
    readonly auth: AuthService,
    private readonly patchService: PatchService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadTeams()]);
  }

  async load(): Promise<void> {
    this.windows.set(await this.patchService.listMaintenanceWindows());
  }

  async loadTeams(): Promise<void> {
    this.teams.set(await this.patchService.listTeams());
  }

  async create(): Promise<void> {
    this.error.set(null);
    try {
      await this.patchService.createMaintenanceWindow({
        name: this.name,
        teamId: this.teamId,
        startsAt: new Date(this.startsAt).toISOString(),
        endsAt: new Date(this.endsAt).toISOString(),
        recurrence: this.recurrence,
        notes: this.notes || null,
      });
      this.name = '';
      this.teamId = null;
      this.startsAt = '';
      this.endsAt = '';
      this.recurrence = 'once';
      this.notes = '';
      await this.load();
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the maintenance window.'));
    }
  }

  async remove(id: string): Promise<void> {
    if (!confirm('Delete this maintenance window?')) return;
    await this.patchService.deleteMaintenanceWindow(id);
    await this.load();
  }
}
