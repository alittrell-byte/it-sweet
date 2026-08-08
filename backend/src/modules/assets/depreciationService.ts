import { Asset } from './asset.model';

export interface DepreciationRow {
  assetId: string;
  name: string;
  purchaseCost: number;
  usefulLifeMonths: number;
  purchaseDate: string;
  currentValue: number;
  accumulatedDepreciation: number;
}

// Straight-line only, floored at 0, no salvage value - kept intentionally simple for a polish
// pass rather than a full depreciation-schedule engine. Sequelize returns DECIMAL columns as
// strings (both pg and mysql2 do this to avoid float precision loss), so purchaseCost is
// coerced defensively here rather than trusted as already-numeric.
export function computeCurrentValue(asset: Asset, asOf: Date = new Date()): number | null {
  if (asset.depreciationMethod !== 'straight_line') return null;
  if (asset.purchaseCost == null || asset.usefulLifeMonths == null || !asset.purchaseDate) return null;

  const cost = Number(asset.purchaseCost);
  const usefulLifeMonths = asset.usefulLifeMonths;
  const purchased = new Date(asset.purchaseDate);
  const monthsElapsed =
    (asOf.getUTCFullYear() - purchased.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - purchased.getUTCMonth());

  if (monthsElapsed <= 0) return cost;
  if (monthsElapsed >= usefulLifeMonths) return 0;
  return Math.round(cost * (1 - monthsElapsed / usefulLifeMonths) * 100) / 100;
}

export async function getDepreciationReport(asOf: Date = new Date()): Promise<DepreciationRow[]> {
  const assets = await Asset.findAll({ where: { depreciationMethod: 'straight_line' }, order: [['name', 'ASC']] });
  const rows: DepreciationRow[] = [];
  for (const asset of assets) {
    const currentValue = computeCurrentValue(asset, asOf);
    if (currentValue === null || asset.purchaseCost == null || asset.usefulLifeMonths == null || !asset.purchaseDate) continue;
    const cost = Number(asset.purchaseCost);
    rows.push({
      assetId: asset.id,
      name: asset.name,
      purchaseCost: cost,
      usefulLifeMonths: asset.usefulLifeMonths,
      purchaseDate: asset.purchaseDate,
      currentValue,
      accumulatedDepreciation: Math.round((cost - currentValue) * 100) / 100,
    });
  }
  return rows;
}
