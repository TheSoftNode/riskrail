/**
 * Chainhook payload parsing.
 *
 * Chainhook decodes Clarity values into JSON whose exact shape varies by event
 * kind and version, so rather than pattern-matching a schema that may drift, we
 * walk the payload and collect anything that looks like a Stacks principal.
 * Over-collecting costs one redundant re-index; under-collecting silently
 * leaves a wallet stale, which is the worse failure.
 */

/** Standard address, optionally with a `.contract-name` suffix. */
const PRINCIPAL = /\b(S[PTMN][0-9A-HJKMNP-TV-Z]{38,40})(?:\.[a-zA-Z](?:[a-zA-Z0-9]|[-_])*)?\b/g;

export interface ChainhookBlock {
  block_identifier?: { index?: number; hash?: string };
  transactions?: unknown[];
}

/**
 * Chainhooks 2.0 nests the blocks under `event`; the 1.x node put them at the
 * top level. Both are accepted, so a delivery from either never parses as an
 * empty payload and gets silently acknowledged.
 */
export interface ChainhookPayload {
  apply?: ChainhookBlock[];
  rollback?: ChainhookBlock[];
  event?: { apply?: ChainhookBlock[]; rollback?: ChainhookBlock[] };
}

function blocks(payload: ChainhookPayload): { apply: ChainhookBlock[]; rollback: ChainhookBlock[] } {
  return {
    apply: payload.event?.apply ?? payload.apply ?? [],
    rollback: payload.event?.rollback ?? payload.rollback ?? [],
  };
}

/** Every distinct standard principal mentioned anywhere in the value. */
export function collectPrincipals(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const match of value.matchAll(PRINCIPAL)) {
      // Keep the account, not the contract it called.
      if (match[1]) into.add(match[1]);
    }
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPrincipals(item, into);
    return into;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectPrincipals(item, into);
  }
  return into;
}

export interface AffectedWallets {
  addresses: string[];
  blockHeight?: number;
  /** A rollback means the chain reorganised; those wallets need re-reading too. */
  reorg: boolean;
}

export function extractAffected(payload: ChainhookPayload): AffectedWallets {
  const addresses = new Set<string>();
  let blockHeight: number | undefined;
  const { apply, rollback } = blocks(payload);

  for (const block of apply) {
    const index = block.block_identifier?.index;
    if (typeof index === 'number') {
      blockHeight = blockHeight === undefined ? index : Math.max(blockHeight, index);
    }
    collectPrincipals(block.transactions, addresses);
  }

  for (const block of rollback) {
    collectPrincipals(block.transactions, addresses);
  }

  return {
    addresses: [...addresses],
    ...(blockHeight === undefined ? {} : { blockHeight }),
    reorg: rollback.length > 0,
  };
}

export interface PublishedSnapshot {
  /** Lower-case hex, no `0x`, so it compares against either spelling we store. */
  txId: string;
  snapshotId: bigint;
  blockHeight?: number;
}

export interface RegistryConfirmations {
  confirmed: PublishedSnapshot[];
  /** Transactions a reorg removed from the canonical chain. */
  rolledBack: string[];
}

export function normalizeTxId(value: string): string {
  return value.toLowerCase().replace(/^0x/, '');
}

interface ChainhookTx {
  transaction_identifier?: { hash?: unknown };
  /** 1.x: `success: true`, `result: "(ok u1)"`. 2.0: `status: "success"`, `result: { hex, repr }`. */
  metadata?: { success?: unknown; status?: unknown; result?: unknown };
}

function txHash(tx: unknown): string | undefined {
  const hash = (tx as ChainhookTx | null)?.transaction_identifier?.hash;
  return typeof hash === 'string' && /^(0x)?[0-9a-fA-F]{64}$/.test(hash) ? normalizeTxId(hash) : undefined;
}

/**
 * `publish-risk-snapshot` returns `(ok next-id)`. The return value is the
 * contract's own answer, so it is read instead of the print event, whose
 * decoded shape differs between Chainhook versions.
 */
function snapshotIdFromResult(tx: unknown): bigint | undefined {
  const meta = (tx as ChainhookTx | null)?.metadata;
  if (!meta || (meta.success !== true && meta.status !== 'success')) return undefined;
  const result = meta.result;
  const repr =
    typeof result === 'string'
      ? result
      : result && typeof result === 'object' && typeof (result as { repr?: unknown }).repr === 'string'
        ? (result as { repr: string }).repr
        : undefined;
  if (repr === undefined) return undefined;
  const match = /^\(ok u(\d+)\)$/.exec(repr.trim());
  return match?.[1] ? BigInt(match[1]) : undefined;
}

export function extractRegistryConfirmations(payload: ChainhookPayload): RegistryConfirmations {
  const confirmed: PublishedSnapshot[] = [];
  const { apply, rollback } = blocks(payload);
  for (const block of apply) {
    const blockHeight = block.block_identifier?.index;
    for (const tx of block.transactions ?? []) {
      const txId = txHash(tx);
      const snapshotId = snapshotIdFromResult(tx);
      if (txId && snapshotId !== undefined) {
        confirmed.push({ txId, snapshotId, ...(typeof blockHeight === 'number' ? { blockHeight } : {}) });
      }
    }
  }

  const rolledBack = new Set<string>();
  for (const block of rollback) {
    for (const tx of block.transactions ?? []) {
      const txId = txHash(tx);
      if (txId) rolledBack.add(txId);
    }
  }

  return { confirmed, rolledBack: [...rolledBack] };
}
