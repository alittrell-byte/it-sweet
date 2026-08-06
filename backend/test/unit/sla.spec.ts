import { computeSlaDueDates, isBreached, SLA_TARGETS } from '../../src/modules/tickets/sla';

describe('computeSlaDueDates', () => {
  it('applies the configured response/resolution minutes for each priority', () => {
    const from = new Date('2024-01-01T00:00:00Z');
    for (const priority of Object.keys(SLA_TARGETS) as Array<keyof typeof SLA_TARGETS>) {
      const target = SLA_TARGETS[priority];
      const { responseDueAt, resolutionDueAt } = computeSlaDueDates(priority, from);
      expect(responseDueAt.getTime()).toBe(from.getTime() + target.responseMinutes * 60_000);
      expect(resolutionDueAt.getTime()).toBe(from.getTime() + target.resolutionMinutes * 60_000);
    }
  });

  it('gives urgent tickets tighter targets than low priority tickets', () => {
    expect(SLA_TARGETS.urgent.responseMinutes).toBeLessThan(SLA_TARGETS.low.responseMinutes);
    expect(SLA_TARGETS.urgent.resolutionMinutes).toBeLessThan(SLA_TARGETS.low.resolutionMinutes);
  });
});

describe('isBreached', () => {
  const dueAt = new Date('2024-01-01T12:00:00Z');

  it('is never breached when there is no due date', () => {
    expect(isBreached(null, null, new Date('2099-01-01'))).toBe(false);
  });

  it('is not breached when the target was achieved before the due date', () => {
    const achievedAt = new Date('2024-01-01T11:00:00Z');
    expect(isBreached(dueAt, achievedAt)).toBe(false);
  });

  it('is breached when the target was achieved after the due date', () => {
    const achievedAt = new Date('2024-01-01T13:00:00Z');
    expect(isBreached(dueAt, achievedAt)).toBe(true);
  });

  it('is breached when nothing has been achieved yet and now is past the due date', () => {
    expect(isBreached(dueAt, null, new Date('2024-01-01T13:00:00Z'))).toBe(true);
  });

  it('is not yet breached when nothing has been achieved and now is before the due date', () => {
    expect(isBreached(dueAt, null, new Date('2024-01-01T10:00:00Z'))).toBe(false);
  });
});
