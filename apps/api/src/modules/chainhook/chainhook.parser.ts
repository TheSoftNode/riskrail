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

export interface ChainhookPayload {
  apply?: ChainhookBlock[];
  rollback?: ChainhookBlock[];
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

  for (const block of payload.apply ?? []) {
    const index = block.block_identifier?.index;
    if (typeof index === 'number') {
      blockHeight = blockHeight === undefined ? index : Math.max(blockHeight, index);
    }
    collectPrincipals(block.transactions, addresses);
  }

  const rollback = payload.rollback ?? [];
  for (const block of rollback) {
    collectPrincipals(block.transactions, addresses);
  }

  return {
    addresses: [...addresses],
    ...(blockHeight === undefined ? {} : { blockHeight }),
    reorg: rollback.length > 0,
  };
}
