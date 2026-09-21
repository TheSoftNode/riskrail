import { describe, expect, it } from 'vitest';
import {
  collectPrincipals,
  extractAffected,
  extractRegistryConfirmations,
} from './chainhook.parser.js';

const WALLET = 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7';
const OTHER = 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE';

describe('collectPrincipals', () => {
  it('finds a principal in a plain string', () => {
    expect([...collectPrincipals(WALLET)]).toEqual([WALLET]);
  });

  it('strips the contract suffix and keeps the account', () => {
    expect([...collectPrincipals(`${WALLET}.risk-policy`)]).toEqual([WALLET]);
  });

  it('walks nested objects and arrays', () => {
    const payload = {
      metadata: { sender: WALLET, receipt: { events: [{ data: { value: { wallet: OTHER } } }] } },
    };
    expect([...collectPrincipals(payload)].sort()).toEqual([WALLET, OTHER].sort());
  });

  it('deduplicates repeats', () => {
    expect([...collectPrincipals([WALLET, WALLET, `${WALLET}.core`])]).toEqual([WALLET]);
  });

  it('ignores strings that merely start with S', () => {
    expect([...collectPrincipals(['SP', 'stacks', 'SPAM', ''])]).toEqual([]);
  });

  it('survives null and undefined', () => {
    expect([...collectPrincipals({ a: null, b: undefined, c: 0 })]).toEqual([]);
  });
});

describe('extractAffected', () => {
  it('reports the highest applied block height', () => {
    const result = extractAffected({
      apply: [
        { block_identifier: { index: 100 }, transactions: [WALLET] },
        { block_identifier: { index: 102 }, transactions: [OTHER] },
      ],
    });
    expect(result.blockHeight).toBe(102);
    expect(result.addresses.sort()).toEqual([WALLET, OTHER].sort());
    expect(result.reorg).toBe(false);
  });

  it('flags a reorg and still collects the rolled-back wallets', () => {
    const result = extractAffected({
      apply: [],
      rollback: [{ block_identifier: { index: 99 }, transactions: [WALLET] }],
    });
    expect(result.reorg).toBe(true);
    expect(result.addresses).toEqual([WALLET]);
  });

  it('returns nothing for an empty payload', () => {
    const result = extractAffected({});
    expect(result.addresses).toEqual([]);
    expect(result.reorg).toBe(false);
    expect(result.blockHeight).toBeUndefined();
  });

  it('handles a realistic contract-call payload', () => {
    const result = extractAffected({
      apply: [
        {
          block_identifier: { index: 184233, hash: '0xabc' },
          transactions: [
            {
              transaction_identifier: { hash: '0xdef' },
              metadata: {
                kind: { type: 'ContractCall', data: { contract_identifier: `${OTHER}.risk-policy`, method: 'set-risk-policy' } },
                sender: WALLET,
                success: true,
                receipt: {
                  events: [
                    { type: 'SmartContractEvent', data: { topic: 'print', value: { event: 'risk-policy-updated', wallet: WALLET } } },
                  ],
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.addresses.sort()).toEqual([WALLET, OTHER].sort());
    expect(result.blockHeight).toBe(184233);
  });
});

/**
 * Captured from Stacks mainnet tx 0x3d62373075… (a Zest `borrow` at block
 * 9031697), reshaped into the envelope Chainhook posts. It is here because the
 * predicate this feeds was previously watching a read-only function and could
 * never have fired — a hand-written fixture would not have caught that, since
 * the parser was never the broken part.
 */
const VAULT = 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-market-vault';
const BORROWER = 'SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3';

describe('real Zest vault print event', () => {
  const payload = {
    apply: [
      {
        block_identifier: { index: 9031697, hash: '0x00' },
        transactions: [
          {
            transaction_identifier: {
              hash: '0x3d62373075fe0252b9ea6320ca34774604dfd138607f666595dab1370a1fa19a',
            },
            metadata: {
              kind: {
                type: 'ContractCall',
                data: {
                  contract_identifier:
                    'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-8-market',
                  method: 'borrow',
                },
              },
              sender: BORROWER,
              success: true,
              receipt: {
                events: [
                  {
                    type: 'SmartContractEvent',
                    data: {
                      contract_identifier: VAULT,
                      topic: 'print',
                      value: {
                        action: 'debt-add-scaled',
                        caller:
                          'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-8-market',
                        data: {
                          account: BORROWER,
                          'asset-id': 6,
                          'scaled-amount': 9894517453,
                          'updated-scaled-debt': 175245193737,
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  };

  it('finds the borrower so their portfolio can be re-indexed', () => {
    expect(extractAffected(payload).addresses).toContain(BORROWER);
  });

  it('reads the block height the position changed at', () => {
    expect(extractAffected(payload).blockHeight).toBe(9031697);
  });

  it('keeps the deployer account but never a contract identifier', () => {
    const { addresses } = extractAffected(payload);
    expect(addresses).toContain('SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7');
    expect(addresses.some((a) => a.includes('.'))).toBe(false);
  });
});

describe('extractRegistryConfirmations', () => {
  const HASH = '0877e7b2a15bbea25fba100f14bea0321d2cfdab3c2278b627026cba93981e55';
  const tx = (hash: string, result: string, success = true) => ({
    transaction_identifier: { hash },
    metadata: { success, result },
  });

  it('reads the snapshot id from the (ok uN) return value', () => {
    const result = extractRegistryConfirmations({
      apply: [{ block_identifier: { index: 454753 }, transactions: [tx(`0x${HASH}`, '(ok u1)')] }],
    });
    expect(result.confirmed).toEqual([{ txId: HASH, snapshotId: 1n, blockHeight: 454753 }]);
    expect(result.rolledBack).toEqual([]);
  });

  it('normalises the hash to lower case without 0x', () => {
    const result = extractRegistryConfirmations({
      apply: [{ transactions: [tx(`0x${HASH.toUpperCase()}`, '(ok u7)')] }],
    });
    expect(result.confirmed[0]?.txId).toBe(HASH);
  });

  it('keeps ids beyond the safe integer range exact', () => {
    const result = extractRegistryConfirmations({
      apply: [{ transactions: [tx(HASH, '(ok u9007199254740993)')] }],
    });
    expect(result.confirmed[0]?.snapshotId).toBe(9007199254740993n);
  });

  it('ignores failed and aborted transactions', () => {
    const result = extractRegistryConfirmations({
      apply: [{ transactions: [tx(HASH, '(err u100)', false), tx(HASH, '(ok u1)', false)] }],
    });
    expect(result.confirmed).toEqual([]);
  });

  it('ignores malformed hashes and results', () => {
    const result = extractRegistryConfirmations({
      apply: [{ transactions: [tx('0x1234', '(ok u1)'), tx(HASH, '(ok true)'), null, 'x'] }],
    });
    expect(result.confirmed).toEqual([]);
  });

  it('reports rolled-back transactions once each', () => {
    const result = extractRegistryConfirmations({
      rollback: [{ transactions: [tx(HASH, '(ok u1)'), tx(`0x${HASH}`, '(ok u1)')] }],
    });
    expect(result.rolledBack).toEqual([HASH]);
    expect(result.confirmed).toEqual([]);
  });
});
