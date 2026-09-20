import { describe, expect, it } from 'vitest';
import { Cl } from '@stacks/transactions';

describe('risk-policy', () => {
  it('stores policy against tx-sender', () => {
    const wallet = simnet.getAccounts().get('wallet_1')!;
    const result = simnet.callPublicFn('risk-policy', 'set-risk-policy', [
      Cl.uint(7000), Cl.uint(13000), Cl.uint(5000), Cl.uint(4000),
    ], wallet);
    expect(result.result).toBeOk(Cl.bool(true));

    // The contract writes `updated-at: stacks-block-height`. After the call,
    // simnet.blockHeight is the height that tx executed at, so read it back
    // rather than pinning a literal that shifts if a call is added ahead.
    const writtenAt = simnet.blockHeight;

    const read = simnet.callReadOnlyFn('risk-policy', 'get-risk-policy', [Cl.principal(wallet)], wallet);
    // `toBeSome` compares against an expected value — calling it bare asserts
    // the policy equals `undefined`, which is why this test was failing.
    expect(read.result).toBeSome(
      Cl.tuple({
        'max-risk-score-bps': Cl.uint(7000),
        'min-health-factor-e4': Cl.uint(13000),
        'max-protocol-concentration-bps': Cl.uint(5000),
        'min-liquidity-score-bps': Cl.uint(4000),
        enabled: Cl.bool(true),
        'updated-at': Cl.uint(writtenAt),
      }),
    );
  });

  it('returns none for a wallet that has never set a policy', () => {
    const other = simnet.getAccounts().get('wallet_2')!;
    const read = simnet.callReadOnlyFn('risk-policy', 'get-risk-policy', [Cl.principal(other)], other);
    expect(read.result).toBeNone();
  });
});
