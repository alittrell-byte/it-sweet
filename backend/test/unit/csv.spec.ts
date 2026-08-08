import { toCsv } from '../../src/common/csv';

describe('toCsv', () => {
  it('renders rows with a header using the given column labels, not raw keys', () => {
    const csv = toCsv(
      [{ name: 'Widget A', count: 3 }, { name: 'Widget B', count: 5 }],
      [
        { key: 'name', header: 'Name' },
        { key: 'count', header: 'Count' },
      ]
    );
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Name,Count');
    expect(lines[1]).toBe('Widget A,3');
    expect(lines[2]).toBe('Widget B,5');
  });

  it('respects the given column order regardless of key order in the row objects', () => {
    const csv = toCsv([{ b: 2, a: 1 }], [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }]);
    expect(csv.trim().split('\n')[0]).toBe('A,B');
    expect(csv.trim().split('\n')[1]).toBe('1,2');
  });

  it('renders a header-only CSV for an empty row array', () => {
    const csv = toCsv([], [{ key: 'name', header: 'Name' }]);
    expect(csv.trim()).toBe('Name');
  });

  it('renders a missing/null field as an empty cell rather than "null" or "undefined"', () => {
    const csv = toCsv([{ name: 'Widget', notes: null }], [
      { key: 'name', header: 'Name' },
      { key: 'notes', header: 'Notes' },
    ]);
    expect(csv.trim().split('\n')[1]).toBe('Widget,');
  });
});
