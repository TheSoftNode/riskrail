import { describe, expect, it } from 'vitest';
import {
  ALERT_METRICS,
  bpsToPercent,
  fromBps,
  fromE4,
  toBps,
  toE4,
  WEBHOOK_EVENT_TYPES,
} from './index.js';

describe('fixed-point helpers', () => {
  it('converts basis points both ways', () => {
    expect(fromBps(4400)).toBeCloseTo(0.44);
    expect(toBps(0.44)).toBe(4400);
    expect(bpsToPercent(4400)).toBe(44);
  });

  it('converts a health factor both ways', () => {
    expect(fromE4(14700)).toBeCloseTo(1.47);
    expect(toE4(1.47)).toBe(14700);
  });

  it('round-trips without float drift', () => {
    for (const value of [0, 1, 1.47, 0.0001, 9999.9999]) {
      expect(fromE4(toE4(value))).toBeCloseTo(value, 4);
    }
  });
});

describe('published constants', () => {
  it('lists the webhook event types', () => {
    expect([...WEBHOOK_EVENT_TYPES]).toEqual([
      'portfolio.updated',
      'risk.updated',
      'alert.triggered',
      'policy.breached',
    ]);
  });

  it('lists every alert metric', () => {
    expect(ALERT_METRICS).toHaveLength(7);
    expect(ALERT_METRICS).toContain('healthFactorE4');
  });
});
