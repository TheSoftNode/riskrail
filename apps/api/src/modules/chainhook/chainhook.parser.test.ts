import { describe, expect, it } from 'vitest';
import { collectPrincipals, extractAffected } from './chainhook.parser.js';

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
