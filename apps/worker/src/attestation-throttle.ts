/**
 * Decides whether a risk snapshot is worth an on-chain attestation.
 *
 * Every refresh produces a snapshot, and every attestation is a paid
 * transaction, so publishing all of them lets anyone who can press refresh
 * spend the publisher's balance. A snapshot is published only when it would
 * tell an on-chain reader something new:
 *
 * - the wallet has never been attested;
 * - a published figure changed (a reader acting on the old one would be wrong);
 * - or the last attestation is old enough that consumers checking freshness
 *   would start rejecting it.
 *
 * The interval is measured in source blocks, the same unit consumers use for
 * `max-age-blocks`. It should stay below the freshness bound integrators are
 * told to use (144 blocks), so an actively viewed wallet never goes stale.
 */

/** The fields `publish-risk-snapshot` writes on chain. */
export interface AttestedFigures {
  riskScoreBps: number;
  healthFactorE4: number | null;
  liquidationDistanceBps: number | null;
  protocolConcentrationBps: number;
  liquidityScoreBps: number;
  sourceBlock: bigint;
}

export const DEFAULT_MIN_INTERVAL_BLOCKS = 120;

export type AttestationDecision =
  | { publish: true; reason: 'first' | 'changed' | 'interval' }
  | { publish: false; reason: 'unchanged'; blocksSinceLast: number; minIntervalBlocks: number };

export function minIntervalFromEnv(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_MIN_INTERVAL_BLOCKS;
  const parsed = Number(value);
  // 0 turns the throttle off (publish every snapshot).
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_MIN_INTERVAL_BLOCKS;
}

function sameFigures(a: AttestedFigures, b: AttestedFigures): boolean {
  return (
    a.riskScoreBps === b.riskScoreBps &&
    a.healthFactorE4 === b.healthFactorE4 &&
    a.liquidationDistanceBps === b.liquidationDistanceBps &&
    a.protocolConcentrationBps === b.protocolConcentrationBps &&
    a.liquidityScoreBps === b.liquidityScoreBps
  );
}

export function decideAttestation(
  candidate: AttestedFigures,
  lastPublished: AttestedFigures | null,
  minIntervalBlocks: number,
): AttestationDecision {
  if (!lastPublished) return { publish: true, reason: 'first' };
  if (!sameFigures(candidate, lastPublished)) return { publish: true, reason: 'changed' };

  const blocksSinceLast = Number(candidate.sourceBlock - lastPublished.sourceBlock);
  if (blocksSinceLast >= minIntervalBlocks) return { publish: true, reason: 'interval' };
  return { publish: false, reason: 'unchanged', blocksSinceLast, minIntervalBlocks };
}
