import { isReportDue } from '../../src/modules/reporting/scheduledReportService';

describe('isReportDue', () => {
  it('is always due if it has never been sent', () => {
    expect(isReportDue('daily', null)).toBe(true);
    expect(isReportDue('monthly', null)).toBe(true);
  });

  it('is not due before the cadence interval has elapsed', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(isReportDue('daily', new Date('2026-01-14T12:00:00Z'), now)).toBe(false);
    expect(isReportDue('weekly', new Date('2026-01-10T00:00:00Z'), now)).toBe(false);
    expect(isReportDue('monthly', new Date('2026-01-01T00:00:00Z'), now)).toBe(false);
  });

  it('is due once the cadence interval has fully elapsed', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(isReportDue('daily', new Date('2026-01-14T00:00:00Z'), now)).toBe(true);
    expect(isReportDue('weekly', new Date('2026-01-08T00:00:00Z'), now)).toBe(true);
    expect(isReportDue('monthly', new Date('2025-12-16T00:00:00Z'), now)).toBe(true);
  });

  it('is due exactly at the boundary', () => {
    const lastSentAt = new Date('2026-01-14T00:00:00Z');
    const now = new Date(lastSentAt.getTime() + 24 * 60 * 60 * 1000);
    expect(isReportDue('daily', lastSentAt, now)).toBe(true);
  });
});
