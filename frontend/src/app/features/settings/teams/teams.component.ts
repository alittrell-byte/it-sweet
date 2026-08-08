import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Team } from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';
import { TicketService } from '../../tickets/services/ticket.service';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Teams / Queues</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-3">
        <input [(ngModel)]="name" name="name" placeholder="Team name (e.g. Network)" required class="w-full border rounded px-3 py-2 text-sm" />
        <div class="flex gap-3">
          <input
            type="number"
            min="1"
            [(ngModel)]="tier"
            name="tier"
            placeholder="Tier"
            class="w-24 border rounded px-3 py-2 text-sm"
          />
          <select [(ngModel)]="escalatesToTeamId" name="escalatesTo" class="flex-1 border rounded px-3 py-2 text-sm">
            <option value="">Escalates to: none</option>
            @for (t of teams(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
        </div>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add Team</button>
      </form>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (team of teams(); track team.id) {
          <div class="p-4">
            <div class="flex justify-between items-start">
              <div>
                <div class="font-medium text-sm">{{ team.name }} <span class="text-xs text-gray-400">Tier {{ team.tier }}</span></div>
                @if (team.escalatesTo) {
                  <div class="text-xs text-gray-500">Escalates to {{ team.escalatesTo.name }}</div>
                }
              </div>
              <button (click)="remove(team.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
            <div class="mt-2">
              <div class="flex gap-1 flex-wrap mb-2">
                @for (member of team.members; track member.id) {
                  <span class="text-xs bg-slate-100 rounded-full px-2 py-0.5 flex items-center gap-1">
                    {{ member.displayName }}
                    <button (click)="removeMember(team.id, member.id)" class="text-red-500">&times;</button>
                  </span>
                } @empty {
                  <span class="text-xs text-gray-400">No members yet.</span>
                }
              </div>
              <div class="flex gap-2">
                <select [(ngModel)]="memberToAdd[team.id]" name="memberToAdd{{ team.id }}" class="flex-1 border rounded px-2 py-1 text-sm">
                  <option value="">Add member...</option>
                  @for (tech of technicians(); track tech.id) {
                    <option [value]="tech.id">{{ tech.displayName }}</option>
                  }
                </select>
                <button (click)="addMember(team.id)" class="text-sm px-3 py-1 rounded border">Add</button>
              </div>
            </div>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No teams yet.</p>
        }
      </div>
    </div>
  `,
})
export class TeamsComponent implements OnInit {
  readonly teams = signal<Team[]>([]);
  readonly technicians = signal<User[]>([]);
  name = '';
  tier: number | null = 1;
  escalatesToTeamId = '';
  memberToAdd: Record<string, string> = {};

  constructor(private readonly ticketService: TicketService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
    this.technicians.set(await this.ticketService.listTechnicians());
  }

  async load(): Promise<void> {
    this.teams.set(await this.ticketService.listTeams());
  }

  async create(): Promise<void> {
    if (!this.name.trim()) return;
    await this.ticketService.createTeam({
      name: this.name,
      tier: this.tier ?? 1,
      escalatesToTeamId: this.escalatesToTeamId || null,
    });
    this.name = '';
    this.tier = 1;
    this.escalatesToTeamId = '';
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.ticketService.deleteTeam(id);
    await this.load();
  }

  async addMember(teamId: string): Promise<void> {
    const userId = this.memberToAdd[teamId];
    if (!userId) return;
    await this.ticketService.addTeamMember(teamId, userId);
    this.memberToAdd[teamId] = '';
    await this.load();
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.ticketService.removeTeamMember(teamId, userId);
    await this.load();
  }
}
