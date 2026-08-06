import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface CannedResponse {
  id: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-canned-responses',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Canned Responses</h1>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow space-y-3">
        <input [(ngModel)]="title" name="title" placeholder="Title" required class="w-full border rounded px-3 py-2 text-sm" />
        <textarea
          [(ngModel)]="body"
          name="body"
          placeholder="Response text"
          required
          rows="3"
          class="w-full border rounded px-3 py-2 text-sm"
        ></textarea>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add</button>
      </form>

      <div class="bg-white rounded-lg shadow divide-y">
        @for (r of responses(); track r.id) {
          <div class="p-4 flex justify-between items-start">
            <div>
              <div class="font-medium text-sm">{{ r.title }}</div>
              <div class="text-sm text-gray-500">{{ r.body }}</div>
            </div>
            <button (click)="remove(r.id)" class="text-xs text-red-600 hover:underline">Delete</button>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No canned responses yet.</p>
        }
      </div>
    </div>
  `,
})
export class CannedResponsesComponent implements OnInit {
  readonly responses = signal<CannedResponse[]>([]);
  title = '';
  body = '';

  constructor(private readonly http: HttpClient) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.responses.set(await firstValueFrom(this.http.get<CannedResponse[]>('/api/canned-responses')));
  }

  async create(): Promise<void> {
    if (!this.title.trim() || !this.body.trim()) return;
    await firstValueFrom(this.http.post('/api/canned-responses', { title: this.title, body: this.body }));
    this.title = '';
    this.body = '';
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/canned-responses/${id}`));
    await this.load();
  }
}
