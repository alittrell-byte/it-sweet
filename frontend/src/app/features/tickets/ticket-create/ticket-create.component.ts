import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TICKET_PRIORITIES, TicketPriority } from '../../../core/models/ticket.model';
import { KbArticle, TicketService } from '../services/ticket.service';

@Component({
  selector: 'app-ticket-create',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto grid grid-cols-3 gap-6">
      <div class="col-span-2 bg-white p-6 rounded-lg shadow">
        <h1 class="text-xl font-semibold mb-4">New Ticket</h1>
        <form (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              name="subject"
              [(ngModel)]="subject"
              (ngModelChange)="onQueryChange()"
              required
              class="mt-1 w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              [(ngModel)]="description"
              (ngModelChange)="onQueryChange()"
              required
              rows="6"
              class="mt-1 w-full border rounded px-3 py-2"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Priority</label>
            <select name="priority" [(ngModel)]="priority" class="mt-1 w-full border rounded px-3 py-2">
              @for (p of priorities; track p) {
                <option [value]="p">{{ p }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Attachment (optional)</label>
            <input type="file" (change)="onFileSelected($event)" class="mt-1 w-full" />
          </div>
          @if (error()) {
            <p class="text-sm text-red-600">{{ error() }}</p>
          }
          <button type="submit" class="bg-slate-800 text-white rounded px-4 py-2 hover:bg-slate-700">
            Submit Ticket
          </button>
        </form>
      </div>

      <div class="bg-white p-4 rounded-lg shadow h-fit">
        <h2 class="font-medium mb-2 text-sm text-gray-600">Suggested Articles</h2>
        @for (article of suggestions(); track article.id) {
          <div class="mb-3 pb-3 border-b last:border-b-0">
            <div class="font-medium text-sm">{{ article.title }}</div>
            <div class="text-xs text-gray-500 line-clamp-3">{{ article.body }}</div>
          </div>
        } @empty {
          <p class="text-sm text-gray-400">Start typing to see relevant help articles.</p>
        }
      </div>
    </div>
  `,
})
export class TicketCreateComponent {
  subject = '';
  description = '';
  priority: TicketPriority = 'medium';
  priorities = TICKET_PRIORITIES;
  selectedFile: File | null = null;
  readonly error = signal<string | null>(null);
  readonly suggestions = signal<KbArticle[]>([]);
  private queryTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly ticketService: TicketService,
    private readonly router: Router
  ) {}

  onQueryChange(): void {
    clearTimeout(this.queryTimeout);
    this.queryTimeout = setTimeout(async () => {
      const query = `${this.subject} ${this.description}`.trim();
      this.suggestions.set(query ? await this.ticketService.searchKb(query) : []);
    }, 400);
  }

  onFileSelected(event: Event): void {
    this.selectedFile = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  async submit(): Promise<void> {
    this.error.set(null);
    try {
      const ticket = await this.ticketService.createTicket({
        subject: this.subject,
        description: this.description,
        priority: this.priority,
      });
      if (this.selectedFile) {
        await this.ticketService.uploadAttachment(ticket.id, this.selectedFile);
      }
      this.router.navigate(['/tickets', ticket.id]);
    } catch {
      this.error.set('Could not create the ticket. Please check the form and try again.');
    }
  }
}
