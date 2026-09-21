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

describe('risk-policy bounds and deletion', () => {
  const accounts = () => simnet.getAccounts();

  it('rejects a min health factor that no position could ever satisfy', () => {
    const wallet = accounts().get('wallet_1')!;
    // Unbounded before: a policy could be set so high that every snapshot
    // breached it, making the alert pure noise.
    const result = simnet.callPublicFn('risk-policy', 'set-risk-policy', [
      Cl.uint(7000), Cl.uint(2_000_000), Cl.uint(5000), Cl.uint(4000),
    ], wallet);
    expect(result.result).toBeErr(Cl.uint(202));
  });

  it('accepts the documented maximum', () => {
    const wallet = accounts().get('wallet_1')!;
    expect(
      simnet.callPublicFn('risk-policy', 'set-risk-policy', [
        Cl.uint(7000), Cl.uint(1_000_000), Cl.uint(5000), Cl.uint(4000),
      ], wallet).result,
    ).toBeOk(Cl.bool(true));
  });

  it('publishes the bound so integrators need not guess it', () => {
    expect(
      simnet.callReadOnlyFn('risk-policy', 'get-max-min-health-factor', [],
        accounts().get('deployer')!).result,
    ).toBeUint(1_000_000);
  });

  it('deletes a policy entirely rather than only disabling it', () => {
    const wallet = accounts().get('wallet_2')!;
    simnet.callPublicFn('risk-policy', 'set-risk-policy', [
      Cl.uint(7000), Cl.uint(13000), Cl.uint(5000), Cl.uint(4000),
    ], wallet);
    expect(
      simnet.callReadOnlyFn('risk-policy', 'get-risk-policy', [Cl.principal(wallet)], wallet).result,
    ).not.toBeNone();

    expect(
      simnet.callPublicFn('risk-policy', 'delete-risk-policy', [], wallet).result,
    ).toBeOk(Cl.bool(true));
    expect(
      simnet.callReadOnlyFn('risk-policy', 'get-risk-policy', [Cl.principal(wallet)], wallet).result,
    ).toBeNone();
  });

  it('deleting only ever touches the caller own policy', () => {
    const a = accounts().get('wallet_1')!;
    const b = accounts().get('wallet_2')!;
    simnet.callPublicFn('risk-policy', 'set-risk-policy', [
      Cl.uint(7000), Cl.uint(13000), Cl.uint(5000), Cl.uint(4000),
    ], a);
    simnet.callPublicFn('risk-policy', 'delete-risk-policy', [], b);
    expect(
      simnet.callReadOnlyFn('risk-policy', 'get-risk-policy', [Cl.principal(a)], a).result,
    ).not.toBeNone();
  });
});
