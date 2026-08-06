import { computeUtilizationPercent } from '../../src/modules/assets/assetService';

describe('computeUtilizationPercent', () => {
  it('computes a normal percentage rounded to the nearest whole number', () => {
    expect(computeUtilizationPercent(10, 3)).toBe(30);
    expect(computeUtilizationPercent(3, 1)).toBe(33);
  });

  it('caps nothing - over-deployed licenses report over 100%', () => {
    expect(computeUtilizationPercent(5, 10)).toBe(200);
  });

  it('treats zero purchased seats with zero deployed as 0%', () => {
    expect(computeUtilizationPercent(0, 0)).toBe(0);
  });

  it('treats zero purchased seats with any deployed as 100% (fully out of compliance)', () => {
    expect(computeUtilizationPercent(0, 4)).toBe(100);
  });

  it('reports 0% when nothing purchased seats exist but none deployed', () => {
    expect(computeUtilizationPercent(20, 0)).toBe(0);
  });
});
