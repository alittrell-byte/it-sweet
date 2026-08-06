import { computeCutoffDate } from '../../src/modules/logs/retentionService';

describe('computeCutoffDate', () => {
  it('subtracts the given number of days from the reference time', () => {
    const now = new Date('2026-01-31T00:00:00Z');
    expect(computeCutoffDate(30, now)).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(computeCutoffDate(1, now)).toEqual(new Date('2026-01-30T00:00:00Z'));
  });

  it('defaults to the current time when no reference is given', () => {
    const before = Date.now();
    const cutoff = computeCutoffDate(10);
    const after = Date.now();
    const expectedMin = before - 10 * 24 * 60 * 60 * 1000;
    const expectedMax = after - 10 * 24 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});
