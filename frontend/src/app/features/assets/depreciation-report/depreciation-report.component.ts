import { Component, OnInit, signal } from '@angular/core';
import { DepreciationRow } from '../../../core/models/asset.model';
import { AssetService } from '../services/asset.service';

@Component({
  selector: 'app-depreciation-report',
  standalone: true,
  template: `
    <div class="max-w-3xl mx-auto space-y-4">
      <h1 class="text-xl font-semibold">Depreciation Report</h1>
      <p class="text-sm text-gray-500">
        Straight-line depreciation, computed as of today. Configure purchase cost, method, and useful life on an
        asset's detail page.
      </p>
      <div class="bg-white rounded-lg shadow overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="px-4 py-2">Asset</th>
              <th class="px-4 py-2">Purchase Cost</th>
              <th class="px-4 py-2">Useful Life</th>
              <th class="px-4 py-2">Purchased</th>
              <th class="px-4 py-2">Accumulated Depreciation</th>
              <th class="px-4 py-2">Current Value</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            @for (row of rows(); track row.assetId) {
              <tr>
                <td class="px-4 py-2">{{ row.name }}</td>
                <td class="px-4 py-2">\${{ row.purchaseCost }}</td>
                <td class="px-4 py-2">{{ row.usefulLifeMonths }} mo</td>
                <td class="px-4 py-2">{{ row.purchaseDate }}</td>
                <td class="px-4 py-2">\${{ row.accumulatedDepreciation }}</td>
                <td class="px-4 py-2 font-medium">\${{ row.currentValue }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-500">No assets with depreciation tracking configured.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class DepreciationReportComponent implements OnInit {
  readonly rows = signal<DepreciationRow[]>([]);

  constructor(private readonly assetService: AssetService) {}

  async ngOnInit(): Promise<void> {
    this.rows.set(await this.assetService.depreciationReport());
  }
}
