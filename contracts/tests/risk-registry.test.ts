import { describe, expect, it } from 'vitest';
import { Cl } from '@stacks/transactions';

describe('risk-registry', () => {
  it('allows owner to publish a bounded snapshot and preserves history', () => {
    const accounts = simnet.getAccounts();
    const deployer = accounts.get('deployer')!;
    const wallet = accounts.get('wallet_1')!;
    const hash = new Uint8Array(32).fill(7);

    const published = simnet.callPublicFn('risk-registry', 'publish-risk-snapshot', [
      Cl.principal(wallet), Cl.uint(6400), Cl.uint(14700), Cl.uint(1800),
      Cl.uint(4400), Cl.uint(7200), Cl.uint(0), Cl.buffer(hash),
    ], deployer);

    expect(published.result).toBeOk(Cl.uint(1));

    const latest = simnet.callReadOnlyFn('risk-registry', 'get-latest-risk-score', [Cl.principal(wallet)], deployer);
    expect(latest.result).toBeOk(Cl.some(Cl.uint(6400)));
  });

  it('rejects an unauthorized publisher', () => {
    const accounts = simnet.getAccounts();
    const caller = accounts.get('wallet_2')!;
    const wallet = accounts.get('wallet_1')!;
    const hash = new Uint8Array(32);
    const result = simnet.callPublicFn('risk-registry', 'publish-risk-snapshot', [
      Cl.principal(wallet), Cl.uint(1000), Cl.uint(20000), Cl.uint(5000),
      Cl.uint(5000), Cl.uint(5000), Cl.uint(0), Cl.buffer(hash),
    ], caller);
    expect(result.result).toBeErr(Cl.uint(100));
  });
});
