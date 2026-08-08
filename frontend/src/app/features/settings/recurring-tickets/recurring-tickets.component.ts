import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecurrenceType, RecurringTicketTemplate, TICKET_PRIORITIES, TicketPriority } from '../../../core/models/ticket.model';
import { User } from '../../../core/models/user.model';
import { TicketService } from '../../tickets/services/ticket.service';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Component({
  selector: 'app-recurring-tickets',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Recurring Tickets</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-3">
        <input [(ngModel)]="name" name="name" placeholder="Name (e.g. Weekly Backup Check)" required class="w-full border rounded px-3 py-2 text-sm" />
        <input [(ngModel)]="subjectTemplate" name="subjectTemplate" placeholder="Ticket subject" required class="w-full border rounded px-3 py-2 text-sm" />
        <textarea
          [(ngModel)]="descriptionTemplate"
          name="descriptionTemplate"
          placeholder="Ticket description"
          required
          rows="3"
          class="w-full border rounded px-3 py-2 text-sm"
        ></textarea>
        <div class="flex gap-3">
          <select [(ngModel)]="priority" name="priority" class="border rounded px-3 py-2 text-sm">
            @for (p of priorities; track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
          <select [(ngModel)]="assigneeId" name="assigneeId" class="flex-1 border rounded px-3 py-2 text-sm">
            <option value="">Unassigned</option>
            @for (tech of technicians(); track tech.id) {
              <option [value]="tech.id">{{ tech.displayName }}</option>
            }
          </select>
        </div>
        <div class="flex gap-3 items-center">
          <select [(ngModel)]="recurrenceType" name="recurrenceType" class="border rounded px-3 py-2 text-sm">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          @if (recurrenceType === 'weekly') {
            <select [(ngModel)]="dayOfWeek" class="border rounded px-3 py-2 text-sm">
              @for (day of weekdays; track day; let i = $index) {
                <option [value]="i">{{ day }}</option>
              }
            </select>
          }
          @if (recurrenceType === 'monthly') {
            <input type="number" min="1" max="31" [(ngModel)]="dayOfMonth" placeholder="Day of month" class="w-32 border rounded px-3 py-2 text-sm" />
          }
          <label class="text-sm text-gray-600">First run:</label>
          <input type="datetime-local" [(ngModel)]="nextRunAt" name="nextRunAt" required class="border rounded px-3 py-2 text-sm" />
        </div>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add</button>
      </form>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (t of templates(); track t.id) {
          <div class="p-4 flex justify-between items-start">
            <div>
              <div class="font-medium text-sm">{{ t.name }} @if (!t.isActive) {<span class="text-xs text-gray-400">(paused)</span>}</div>
              <div class="text-sm text-gray-500">
                {{ t.recurrenceRule.type }} &middot; next run {{ t.nextRunAt | date: 'medium' }}
              </div>
            </div>
            <div class="flex gap-2">
              <button (click)="toggleActive(t)" class="text-xs text-slate-600 hover:underline">
                {{ t.isActive ? 'Pause' : 'Resume' }}
              </button>
              <button (click)="remove(t.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No recurring tickets yet.</p>
        }
      </div>
    </div>
  `,
})
export class RecurringTicketsComponent implements OnInit {
  readonly templates = signal<RecurringTicketTemplate[]>([]);
  readonly technicians = signal<User[]>([]);
  readonly priorities = TICKET_PRIORITIES;
  readonly weekdays = WEEKDAYS;
  name = '';
  subjectTemplate = '';
  descriptionTemplate = '';
  priority: TicketPriority = 'medium';
  assigneeId = '';
  recurrenceType: RecurrenceType = 'weekly';
  dayOfWeek = 1;
  dayOfMonth = 1;
  nextRunAt = '';

  constructor(private readonly ticketService: TicketService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
    this.technicians.set(await this.ticketService.listTechnicians());
  }

  async load(): Promise<void> {
    this.templates.set(await this.ticketService.listRecurringTemplates());
  }

  async create(): Promise<void> {
    if (!this.name.trim() || !this.subjectTemplate.trim() || !this.descriptionTemplate.trim() || !this.nextRunAt) return;
    await this.ticketService.createRecurringTemplate({
      name: this.name,
      subjectTemplate: this.subjectTemplate,
      descriptionTemplate: this.descriptionTemplate,
      category: null,
      priority: this.priority,
      assigneeId: this.assigneeId || null,
      recurrenceRule:
        this.recurrenceType === 'weekly'
          ? { type: 'weekly', dayOfWeek: this.dayOfWeek }
          : this.recurrenceType === 'monthly'
            ? { type: 'monthly', dayOfMonth: this.dayOfMonth }
            : { type: 'daily' },
      isActive: true,
      nextRunAt: new Date(this.nextRunAt).toISOString(),
    });
    this.name = '';
    this.subjectTemplate = '';
    this.descriptionTemplate = '';
    this.assigneeId = '';
    this.nextRunAt = '';
    await this.load();
  }

  async toggleActive(template: RecurringTicketTemplate): Promise<void> {
    await this.ticketService.updateRecurringTemplate(template.id, { isActive: !template.isActive });
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.ticketService.deleteRecurringTemplate(id);
    await this.load();
  }
}
