import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Asset, AssetStatus, AssetType } from './asset.model';
import { Vendor } from './vendor.model';
import { CreateAssetInput } from './assetService';

const CSV_COLUMNS = [
  'name',
  'type',
  'status',
  'serialNumber',
  'vendor',
  'purchaseDate',
  'warrantyExpiry',
  'licenseSeatsPurchased',
  'notes',
  'customFields',
] as const;

const VALID_TYPES: AssetType[] = ['hardware', 'software_license', 'peripheral'];
const VALID_STATUSES: AssetStatus[] = ['available', 'in_use', 'retired', 'lost', 'under_repair', 'ordered'];

// The `vendor` column is a plain name string on both sides of the CSV boundary, even though
// Asset itself stores a vendorId FK - export joins to Vendor for its name, and import resolves
// (find-or-create) a Vendor by that name. Keeps the CSV format stable across the vendor-entity
// migration instead of forcing spreadsheet users to know vendor UUIDs.
export function assetsToCsv(assets: Asset[]): string {
  const rows = assets.map((asset) => ({
    name: asset.name,
    type: asset.type,
    status: asset.status,
    serialNumber: asset.serialNumber ?? '',
    vendor: (asset as unknown as { vendor: Vendor | null }).vendor?.name ?? '',
    purchaseDate: asset.purchaseDate ?? '',
    warrantyExpiry: asset.warrantyExpiry ?? '',
    licenseSeatsPurchased: asset.licenseSeatsPurchased ?? '',
    notes: asset.notes ?? '',
    customFields: JSON.stringify(asset.customFields ?? {}),
  }));
  return stringify(rows, { header: true, columns: [...CSV_COLUMNS] });
}

export interface CsvRowResult {
  row: number;
  status: 'parsed' | 'error';
  data?: CreateAssetInput;
  /** Raw vendor name from the CSV, if any - resolved to a vendorId by the caller (needs DB access). */
  vendorName?: string | null;
  error?: string;
}

// Parsing is kept separate from persistence (assetService.createAsset/updateAsset) so it
// can be unit tested without a database, and so the import endpoint can report exactly
// which rows failed and why before touching the DB. Vendor name -> vendorId resolution also
// needs the DB, so it's deliberately left to the caller (assetController.importCsv) too -
// this function only reports the raw name back via `vendorName`.
export function parseAssetsCsv(csvText: string): CsvRowResult[] {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return [{ row: 0, status: 'error', error: `Could not parse CSV: ${(err as Error).message}` }];
  }

  return records.map((record, index) => {
    const rowNumber = index + 2; // +1 for 0-index, +1 for the header row
    const name = record.name?.trim();
    if (!name) {
      return { row: rowNumber, status: 'error', error: 'Missing required "name" column' };
    }
    const type = record.type?.trim() as AssetType;
    if (!VALID_TYPES.includes(type)) {
      return { row: rowNumber, status: 'error', error: `Invalid "type": ${record.type} (expected one of ${VALID_TYPES.join(', ')})` };
    }
    const status = record.status?.trim() as AssetStatus | undefined;
    if (status && !VALID_STATUSES.includes(status)) {
      return { row: rowNumber, status: 'error', error: `Invalid "status": ${record.status}` };
    }

    let customFields: Record<string, string | number | boolean | null> = {};
    if (record.customFields?.trim()) {
      try {
        customFields = JSON.parse(record.customFields);
      } catch {
        return { row: rowNumber, status: 'error', error: 'customFields column is not valid JSON' };
      }
    }

    const licenseSeatsPurchased = record.licenseSeatsPurchased?.trim()
      ? Number(record.licenseSeatsPurchased)
      : null;
    if (licenseSeatsPurchased !== null && Number.isNaN(licenseSeatsPurchased)) {
      return { row: rowNumber, status: 'error', error: 'licenseSeatsPurchased must be a number' };
    }

    return {
      row: rowNumber,
      status: 'parsed',
      vendorName: record.vendor?.trim() || null,
      data: {
        name,
        type,
        status,
        serialNumber: record.serialNumber?.trim() || null,
        purchaseDate: record.purchaseDate?.trim() || null,
        warrantyExpiry: record.warrantyExpiry?.trim() || null,
        licenseSeatsPurchased,
        notes: record.notes?.trim() || null,
        customFields,
      },
    };
  });
}
