import { Component, OnInit, signal } from '@angular/core';
import { LicenseComplianceRow } from '../../../core/models/asset.model';
import { AssetService } from '../services/asset.service';

@Component({
  selector: 'app-license-compliance',
  standalone: true,
  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <h1 class="text-xl font-semibold">License Compliance</h1>
      <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="px-4 py-2">License</th>
              <th class="px-4 py-2">Purchased</th>
              <th class="px-4 py-2">Deployed</th>
              <th class="px-4 py-2">Utilization</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (row of rows(); track row.assetId) {
              <tr>
                <td class="px-4 py-2">{{ row.name }}</td>
                <td class="px-4 py-2">{{ row.seatsPurchased }}</td>
                <td class="px-4 py-2">{{ row.seatsDeployed }}</td>
                <td class="px-4 py-2">
                  <span
                    class="px-2 py-1 rounded text-xs"
                    [class.bg-red-100]="row.utilizationPercent > 100"
                    [class.text-red-800]="row.utilizationPercent > 100"
                    [class.bg-green-100]="row.utilizationPercent <= 100"
                    [class.text-green-800]="row.utilizationPercent <= 100"
                  >
                    {{ row.utilizationPercent }}%
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500">No software licenses tracked yet.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class LicenseComplianceComponent implements OnInit {
  readonly rows = signal<LicenseComplianceRow[]>([]);

  constructor(private readonly assetService: AssetService) {}

  async ngOnInit(): Promise<void> {
    this.rows.set(await this.assetService.licenseCompliance());
  }
}
