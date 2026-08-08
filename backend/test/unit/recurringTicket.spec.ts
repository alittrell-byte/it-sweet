import { computeNextRunAt } from '../../src/modules/tickets/recurringTicketService';

describe('computeNextRunAt', () => {
  it('advances daily templates by exactly one day', () => {
    const next = computeNextRunAt({ type: 'daily' }, new Date('2026-03-05T09:00:00.000Z'));
    expect(next.toISOString()).toBe('2026-03-06T09:00:00.000Z');
  });

  it('advances weekly templates by exactly seven days', () => {
    const next = computeNextRunAt({ type: 'weekly', dayOfWeek: 1 }, new Date('2026-03-05T09:00:00.000Z'));
    expect(next.toISOString()).toBe('2026-03-12T09:00:00.000Z');
  });

  it('advances monthly templates by one month, preserving day-of-month when unspecified', () => {
    const next = computeNextRunAt({ type: 'monthly' }, new Date('2026-01-15T09:00:00.000Z'));
    expect(next.getUTCMonth()).toBe(1); // February
    expect(next.getUTCDate()).toBe(15);
  });

  it('clamps monthly dayOfMonth to the last day of a shorter month', () => {
    // From Jan 31 targeting day 31 - February only has 28 days in 2026 (not a leap year).
    const next = computeNextRunAt({ type: 'monthly', dayOfMonth: 31 }, new Date('2026-01-31T09:00:00.000Z'));
    expect(next.getUTCMonth()).toBe(1);
    expect(next.getUTCDate()).toBe(28);
  });

  it('honors an explicit dayOfMonth within range', () => {
    const next = computeNextRunAt({ type: 'monthly', dayOfMonth: 5 }, new Date('2026-01-20T09:00:00.000Z'));
    expect(next.getUTCMonth()).toBe(1);
    expect(next.getUTCDate()).toBe(5);
  });
});
