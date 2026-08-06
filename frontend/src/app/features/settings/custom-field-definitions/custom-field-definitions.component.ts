import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssetCustomFieldDefinition, CustomFieldType } from '../../../core/models/asset.model';
import { extractApiError } from '../../../core/utils/api-error';
import { AssetService } from '../../assets/services/asset.service';

@Component({
  selector: 'app-custom-field-definitions',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <h1 class="text-xl font-semibold">Asset Custom Fields</h1>
      <p class="text-sm text-gray-500">
        Fields defined here appear automatically on the asset create/detail pages - no code changes needed.
      </p>

      <form (ngSubmit)="create()" class="bg-white p-4 rounded-lg shadow flex gap-2 items-end">
        <div class="flex-1">
          <label class="block text-xs text-gray-600">Key</label>
          <input
            [ngModel]="key"
            (ngModelChange)="onKeyChange($event)"
            name="key"
            placeholder="cost_center"
            required
            class="w-full border rounded px-2 py-1.5 text-sm"
          />
          <p class="text-xs text-gray-400 mt-0.5">lowercase letters, numbers, underscores only</p>
        </div>
        <div class="flex-1">
          <label class="block text-xs text-gray-600">Label</label>
          <input [(ngModel)]="label" name="label" placeholder="Cost Center" required class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-600">Type</label>
          <select [(ngModel)]="fieldType" name="fieldType" class="border rounded px-2 py-1.5 text-sm">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Boolean</option>
          </select>
        </div>
        <button type="submit" class="bg-slate-800 text-white rounded px-4 py-1.5 text-sm hover:bg-slate-700">Add</button>
      </form>
      @if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      }

      <div class="bg-white rounded-lg shadow divide-y">
        @for (def of definitions(); track def.id) {
          <div class="p-4 flex justify-between items-center">
            <div>
              <div class="font-medium text-sm">{{ def.label }}</div>
              <div class="text-xs text-gray-500">{{ def.key }} · {{ def.fieldType }}</div>
            </div>
            <button (click)="remove(def.id)" class="text-xs text-red-600 hover:underline">Delete</button>
          </div>
        } @empty {
          <p class="p-4 text-sm text-gray-400">No custom fields defined yet.</p>
        }
      </div>
    </div>
  `,
})
export class CustomFieldDefinitionsComponent implements OnInit {
  readonly definitions = signal<AssetCustomFieldDefinition[]>([]);
  readonly error = signal<string | null>(null);
  key = '';
  label = '';
  fieldType: CustomFieldType = 'text';

  constructor(private readonly assetService: AssetService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.definitions.set(await this.assetService.listCustomFieldDefinitions());
  }

  // Keeps the key in sync with what the backend will actually accept (it requires
  // /^[a-z0-9_]+$/) instead of letting the user type "Cost Center" and hit an opaque
  // validation error on submit.
  onKeyChange(value: string): void {
    this.key = value
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async create(): Promise<void> {
    this.error.set(null);
    try {
      await this.assetService.createCustomFieldDefinition({ key: this.key, label: this.label, fieldType: this.fieldType });
      this.key = '';
      this.label = '';
      await this.load();
    } catch (err) {
      this.error.set(extractApiError(err, 'Could not create the field.'));
    }
  }

  async remove(id: string): Promise<void> {
    await this.assetService.deleteCustomFieldDefinition(id);
    await this.load();
  }
}
