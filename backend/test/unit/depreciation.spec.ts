import { computeCurrentValue } from '../../src/modules/assets/depreciationService';
import { Asset } from '../../src/modules/assets/asset.model';

function buildAsset(overrides: Partial<{
  depreciationMethod: 'none' | 'straight_line';
  purchaseCost: number | null;
  usefulLifeMonths: number | null;
  purchaseDate: string | null;
}>): Asset {
  return Asset.build({
    name: 'Test Asset',
    type: 'hardware',
    status: 'available',
    depreciationMethod: 'none',
    purchaseCost: null,
    usefulLifeMonths: null,
    purchaseDate: null,
    ...overrides,
  });
}

describe('computeCurrentValue', () => {
  it('returns null when depreciationMethod is "none"', () => {
    const asset = buildAsset({ depreciationMethod: 'none', purchaseCost: 1200, usefulLifeMonths: 24, purchaseDate: '2024-01-01' });
    expect(computeCurrentValue(asset)).toBeNull();
  });

  it('returns null when purchaseCost, usefulLifeMonths, or purchaseDate is unset', () => {
    expect(computeCurrentValue(buildAsset({ depreciationMethod: 'straight_line', usefulLifeMonths: 24, purchaseDate: '2024-01-01' }))).toBeNull();
    expect(computeCurrentValue(buildAsset({ depreciationMethod: 'straight_line', purchaseCost: 1200, purchaseDate: '2024-01-01' }))).toBeNull();
    expect(computeCurrentValue(buildAsset({ depreciationMethod: 'straight_line', purchaseCost: 1200, usefulLifeMonths: 24 }))).toBeNull();
  });

  it('returns full cost when asOf is at or before the purchase date', () => {
    const asset = buildAsset({ depreciationMethod: 'straight_line', purchaseCost: 1200, usefulLifeMonths: 24, purchaseDate: '2024-01-01' });
    expect(computeCurrentValue(asset, new Date('2024-01-01T00:00:00Z'))).toBe(1200);
  });

  it('computes straight-line depreciation partway through the useful life', () => {
    const asset = buildAsset({ depreciationMethod: 'straight_line', purchaseCost: 1200, usefulLifeMonths: 24, purchaseDate: '2024-01-01' });
    // 12 of 24 months elapsed -> half the value remains
    expect(computeCurrentValue(asset, new Date('2025-01-01T00:00:00Z'))).toBe(600);
  });

  it('floors at 0 once the useful life has fully elapsed', () => {
    const asset = buildAsset({ depreciationMethod: 'straight_line', purchaseCost: 1200, usefulLifeMonths: 24, purchaseDate: '2024-01-01' });
    expect(computeCurrentValue(asset, new Date('2027-01-01T00:00:00Z'))).toBe(0);
  });

  it('coerces a string purchaseCost (as Sequelize DECIMAL columns return from the driver)', () => {
    const asset = buildAsset({ depreciationMethod: 'straight_line', usefulLifeMonths: 24, purchaseDate: '2024-01-01' });
    (asset as unknown as { purchaseCost: unknown }).purchaseCost = '1200.00';
    expect(computeCurrentValue(asset, new Date('2025-01-01T00:00:00Z'))).toBe(600);
  });
});
