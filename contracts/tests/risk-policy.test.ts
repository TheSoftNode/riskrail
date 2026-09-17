import { describe, expect, it } from 'vitest';
import { Cl } from '@stacks/transactions';

describe('risk-policy', () => {
  it('stores policy against tx-sender', () => {
    const wallet = simnet.getAccounts().get('wallet_1')!;
    const result = simnet.callPublicFn('risk-policy', 'set-risk-policy', [
      Cl.uint(7000), Cl.uint(13000), Cl.uint(5000), Cl.uint(4000),
    ], wallet);
    expect(result.result).toBeOk(Cl.bool(true));
    const read = simnet.callReadOnlyFn('risk-policy', 'get-risk-policy', [Cl.principal(wallet)], wallet);
    expect(read.result).toBeSome();
  });
});
