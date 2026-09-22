import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_INTERVAL_BLOCKS,
  decideAttestation,
  minIntervalFromEnv,
  type AttestedFigures,
} from './attestation-throttle.js';

const base: AttestedFigures = {
  riskScoreBps: 1200,
  healthFactorE4: 14700,
  liquidationDistanceBps: 3200,
  protocolConcentrationBps: 9970,
  liquidityScoreBps: 4100,
  sourceBlock: 464_000n,
};
const later = (blocks: number, patch: Partial<AttestedFigures> = {}): AttestedFigures => ({
  ...base,
  ...patch,
  sourceBlock: base.sourceBlock + BigInt(blocks),
});

describe('decideAttestation', () => {
  it('publishes a wallet that has never been attested', () => {
    expect(decideAttestation(base, null, 120)).toEqual({ publish: true, reason: 'first' });
  });

  it('skips an unchanged snapshot inside the interval', () => {
    expect(decideAttestation(later(3), base, 120)).toEqual({
      publish: false,
      reason: 'unchanged',
      blocksSinceLast: 3,
      minIntervalBlocks: 120,
    });
  });

  it('skips a refresh at the same block', () => {
    expect(decideAttestation(later(0), base, 120).publish).toBe(false);
  });

  it('republishes an unchanged snapshot once the interval has passed', () => {
    expect(decideAttestation(later(119), base, 120).publish).toBe(false);
    expect(decideAttestation(later(120), base, 120)).toEqual({ publish: true, reason: 'interval' });
  });

  it.each([
    ['riskScoreBps', { riskScoreBps: 1201 }],
    ['healthFactorE4', { healthFactorE4: 14699 }],
    ['liquidationDistanceBps', { liquidationDistanceBps: 3100 }],
    ['protocolConcentrationBps', { protocolConcentrationBps: 9000 }],
    ['liquidityScoreBps', { liquidityScoreBps: 4000 }],
  ])('publishes immediately when %s changes', (_field, patch) => {
    expect(decideAttestation(later(1, patch), base, 120)).toEqual({ publish: true, reason: 'changed' });
  });

  it('treats taking on debt as a change (null health factor -> a number)', () => {
    const noDebt = { ...base, healthFactorE4: null, liquidationDistanceBps: null };
    expect(decideAttestation(later(1), noDebt, 120)).toEqual({ publish: true, reason: 'changed' });
  });

  it('treats two debt-free snapshots as equal', () => {
    const noDebt = { ...base, healthFactorE4: null, liquidationDistanceBps: null };
    expect(decideAttestation({ ...noDebt, sourceBlock: base.sourceBlock + 5n }, noDebt, 120).publish).toBe(false);
  });

  it('publishes every snapshot when the interval is 0', () => {
    expect(decideAttestation(later(0), base, 0)).toEqual({ publish: true, reason: 'interval' });
  });
});

describe('minIntervalFromEnv', () => {
  it('defaults when unset or invalid', () => {
    expect(minIntervalFromEnv(undefined)).toBe(DEFAULT_MIN_INTERVAL_BLOCKS);
    expect(minIntervalFromEnv('')).toBe(DEFAULT_MIN_INTERVAL_BLOCKS);
    expect(minIntervalFromEnv('-5')).toBe(DEFAULT_MIN_INTERVAL_BLOCKS);
    expect(minIntervalFromEnv('ten')).toBe(DEFAULT_MIN_INTERVAL_BLOCKS);
    expect(minIntervalFromEnv('1.5')).toBe(DEFAULT_MIN_INTERVAL_BLOCKS);
  });

  it('accepts a whole number, including 0 to disable', () => {
    expect(minIntervalFromEnv('60')).toBe(60);
    expect(minIntervalFromEnv('0')).toBe(0);
  });
});
