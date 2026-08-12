import { averagePercent } from '../../src/modules/projects/projectService';
import { normalizePercentForStatus } from '../../src/modules/projects/projectTaskService';

describe('averagePercent', () => {
  it('returns 0% for a project with no tasks', () => {
    expect(averagePercent(0, 0)).toBe(0);
  });

  it('averages and rounds to the nearest whole number', () => {
    expect(averagePercent(150, 3)).toBe(50);
    expect(averagePercent(100, 3)).toBe(33);
  });

  it('reports 100% when every task is fully complete', () => {
    expect(averagePercent(300, 3)).toBe(100);
  });
});

describe('normalizePercentForStatus', () => {
  it('forces 100% when the task is moving to done, regardless of what the client sent', () => {
    expect(normalizePercentForStatus('done', 10, { status: 'in_progress', percentComplete: 40 })).toBe(100);
    expect(normalizePercentForStatus('done', undefined, { status: 'in_progress', percentComplete: 40 })).toBe(100);
  });

  it('leaves percentComplete as-is when moving a task off done (no reset to 0)', () => {
    expect(normalizePercentForStatus('in_progress', undefined, { status: 'done', percentComplete: 100 })).toBe(100);
  });

  it('uses the client-provided value when the status is not changing to/from done', () => {
    expect(normalizePercentForStatus('in_progress', 70, { status: 'todo', percentComplete: 0 })).toBe(70);
  });

  it('falls back to the current value when no percentComplete or status is provided', () => {
    expect(normalizePercentForStatus(undefined, undefined, { status: 'in_progress', percentComplete: 55 })).toBe(55);
  });

  it('an already-done task stays at 100 even without an explicit status in the update', () => {
    expect(normalizePercentForStatus(undefined, 30, { status: 'done', percentComplete: 100 })).toBe(100);
  });
});
