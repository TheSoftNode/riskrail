import { describe, expect, it } from 'vitest';
import { compareThreshold, crossedIntoBreach, policyChecks } from './alert-evaluator.js';

describe('alert evaluator', () => {
  it('evaluates threshold operators', () => {
    expect(compareThreshold(12_000, 'lt', 13_000)).toBe(true);
    expect(compareThreshold(13_000, 'lte', 13_000)).toBe(true);
    expect(compareThreshold(7_500, 'gt', 7_000)).toBe(true);
    expect(compareThreshold(7_000, 'gte', 7_000)).toBe(true);
  });

  it('only fires when a metric crosses into a breach', () => {
    expect(crossedIntoBreach(12_500, 14_000, 'lt', 13_000)).toBe(true);
    expect(crossedIntoBreach(12_000, 12_500, 'lt', 13_000)).toBe(false);
    expect(crossedIntoBreach(14_000, 14_500, 'lt', 13_000)).toBe(false);
  });

  it('maps the four on-chain policy guardrails to evaluator checks', () => {
    const checks = policyChecks({
      maxRiskScoreBps: 7_000,
      minHealthFactorE4: 13_000,
      maxProtocolConcentrationBps: 5_000,
      minLiquidityScoreBps: 4_000,
      enabled: true,
      updatedAt: 123,
    });
    expect(checks).toHaveLength(4);
    expect(checks.map((check) => check.metric)).toContain('healthFactorE4');
  });
});
