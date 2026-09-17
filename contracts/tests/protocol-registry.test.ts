import { describe, expect, it } from 'vitest';
import { Cl } from '@stacks/transactions';

describe('protocol-registry', () => {
  it('allows owner to register a protocol', () => {
    const accounts = simnet.getAccounts();
    const deployer = accounts.get('deployer')!;
    const contractPrincipal = `${deployer}.risk-policy`;
    const result = simnet.callPublicFn('protocol-registry', 'register-protocol', [
      Cl.uint(1), Cl.stringAscii('BitPay'), Cl.stringAscii('streaming-payments'),
      Cl.principal(contractPrincipal), Cl.uint(1), Cl.buffer(new Uint8Array(32)),
    ], deployer);
    expect(result.result).toBeOk(Cl.bool(true));
  });
});
