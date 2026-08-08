import { computeCompliancePercent } from '../../src/modules/patches/patchService';

describe('computeCompliancePercent', () => {
  it('computes a normal percentage rounded to the nearest whole number', () => {
    expect(computeCompliancePercent(9, 1, 0)).toBe(90);
    expect(computeCompliancePercent(2, 1, 0)).toBe(67);
  });

  it('counts both missing and failed against compliance', () => {
    expect(computeCompliancePercent(5, 3, 2)).toBe(50);
  });

  it('reports 100% when there is no approved-patch data at all (nothing to be non-compliant about)', () => {
    expect(computeCompliancePercent(0, 0, 0)).toBe(100);
  });

  it('reports 0% when every tracked patch is missing or failed', () => {
    expect(computeCompliancePercent(0, 4, 0)).toBe(0);
    expect(computeCompliancePercent(0, 0, 3)).toBe(0);
  });

  it('reports 100% when everything tracked is installed', () => {
    expect(computeCompliancePercent(7, 0, 0)).toBe(100);
  });
});
