import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TICKET_PRIORITIES, TicketPriority, TicketTemplate } from '../../../core/models/ticket.model';
import { TicketService } from '../../tickets/services/ticket.service';

@Component({
  selector: 'app-ticket-templates',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Ticket Templates</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-3">
        <input [(ngModel)]="name" name="name" placeholder="Template name (e.g. New Hire Setup)" required class="w-full border rounded px-3 py-2 text-sm" />
        <input [(ngModel)]="subjectTemplate" name="subjectTemplate" placeholder="Default subject" required class="w-full border rounded px-3 py-2 text-sm" />
        <textarea
          [(ngModel)]="descriptionTemplate"
          name="descriptionTemplate"
          placeholder="Default description"
          required
          rows="4"
          class="w-full border rounded px-3 py-2 text-sm"
        ></textarea>
        <div class="flex gap-3">
          <input [(ngModel)]="category" name="category" placeholder="Category (optional)" class="flex-1 border rounded px-3 py-2 text-sm" />
          <select [(ngModel)]="priority" name="priority" class="border rounded px-3 py-2 text-sm">
            @for (p of priorities; track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
        </div>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add Template</button>
      </form>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (t of templates(); track t.id) {
          <div class="p-4 flex justify-between items-start">
            <div>
              <div class="font-medium text-sm">{{ t.name }} @if (!t.isActive) {<span class="text-xs text-gray-400">(inactive)</span>}</div>
              <div class="text-sm text-gray-500">{{ t.subjectTemplate }}</div>
            </div>
            <div class="flex gap-2">
              <button (click)="toggleActive(t)" class="text-xs text-slate-600 hover:underline">
                {{ t.isActive ? 'Deactivate' : 'Activate' }}
              </button>
              <button (click)="remove(t.id)" class="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No templates yet.</p>
        }
      </div>
    </div>
  `,
})
export class TicketTemplatesComponent implements OnInit {
  readonly templates = signal<TicketTemplate[]>([]);
  readonly priorities = TICKET_PRIORITIES;
  name = '';
  subjectTemplate = '';
  descriptionTemplate = '';
  category = '';
  priority: TicketPriority = 'medium';

  constructor(private readonly ticketService: TicketService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.templates.set(await this.ticketService.listAllTicketTemplates());
  }

  async create(): Promise<void> {
    if (!this.name.trim() || !this.subjectTemplate.trim() || !this.descriptionTemplate.trim()) return;
    await this.ticketService.createTicketTemplate({
      name: this.name,
      subjectTemplate: this.subjectTemplate,
      descriptionTemplate: this.descriptionTemplate,
      category: this.category || null,
      priority: this.priority,
      isActive: true,
    });
    this.name = '';
    this.subjectTemplate = '';
    this.descriptionTemplate = '';
    this.category = '';
    this.priority = 'medium';
    await this.load();
  }

  async toggleActive(template: TicketTemplate): Promise<void> {
    await this.ticketService.updateTicketTemplate(template.id, { isActive: !template.isActive });
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.ticketService.deleteTicketTemplate(id);
    await this.load();
  }
}
