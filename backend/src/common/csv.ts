import { stringify } from 'csv-stringify/sync';

export interface CsvColumn<T> {
  key: keyof T;
  header: string;
}

// Generic row-array -> CSV string, promoted out of the asset-specific pattern
// (backend/src/modules/assets/csv.ts) that predates this - explicit columns rather than
// auto-detecting keys from the first row, so output stays stable even when the first row happens
// to be missing an optional field, and headers can read nicer than raw camelCase keys.
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: CsvColumn<T>[]): string {
  const records = rows.map((row) => columns.map((col) => row[col.key] ?? ''));
  return stringify(records, { header: true, columns: columns.map((col) => col.header) });
}
