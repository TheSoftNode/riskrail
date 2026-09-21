import { describe, expect, it, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

/**
 * Ownership moves in two steps in both registries.
 *
 * A single-step transfer is one typo away from permanently removing the ability
 * to authorise or revoke publishers, or to register an adapter -- there is no
 * recovery path on chain. `protocol-registry` was worse than that: it had an
 * owner variable and no transfer function at all, so a rotated deployer key
 * would have frozen it forever.
 */

const REGISTRIES = ['risk-registry', 'protocol-registry'] as const;
const UNAUTHORIZED: Record<(typeof REGISTRIES)[number], number> = {
  'risk-registry': 100,
  'protocol-registry': 300,
};

let deployer: string;
let next: string;
let stranger: string;

beforeEach(() => {
  const accounts = simnet.getAccounts();
  deployer = accounts.get('deployer')!;
  next = accounts.get('wallet_1')!;
  stranger = accounts.get('wallet_2')!;
});

describe.each(REGISTRIES)('%s ownership', (contract) => {
  const err = () => Cl.uint(UNAUTHORIZED[contract]);

  it('starts owned by the deployer with nothing pending', () => {
    expect(
      simnet.callReadOnlyFn(contract, 'get-owner', [], deployer).result,
    ).toBePrincipal(deployer);
    expect(
      simnet.callReadOnlyFn(contract, 'get-pending-owner', [], deployer).result,
    ).toBeNone();
  });

  it('nominating does not transfer anything yet', () => {
    expect(
      simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(next)], deployer).result,
    ).toBeOk(Cl.bool(true));

    // Still the deployer: this is the whole point of the two-step.
    expect(
      simnet.callReadOnlyFn(contract, 'get-owner', [], deployer).result,
    ).toBePrincipal(deployer);
    expect(
      simnet.callReadOnlyFn(contract, 'get-pending-owner', [], deployer).result,
    ).toBeSome(Cl.principal(next));
  });

  it('transfers once the nominee accepts', () => {
    simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(next)], deployer);
    expect(
      simnet.callPublicFn(contract, 'accept-ownership', [], next).result,
    ).toBeOk(Cl.bool(true));

    expect(simnet.callReadOnlyFn(contract, 'get-owner', [], next).result).toBePrincipal(next);
    expect(simnet.callReadOnlyFn(contract, 'get-pending-owner', [], next).result).toBeNone();
  });

  it('only the nominee can accept', () => {
    simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(next)], deployer);
    expect(
      simnet.callPublicFn(contract, 'accept-ownership', [], stranger).result,
    ).toBeErr(err());
    expect(simnet.callReadOnlyFn(contract, 'get-owner', [], deployer).result).toBePrincipal(deployer);
  });

  it('nobody can accept when nothing is pending', () => {
    expect(
      simnet.callPublicFn(contract, 'accept-ownership', [], stranger).result,
    ).toBeErr(err());
  });

  it('a stranger cannot nominate', () => {
    expect(
      simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(stranger)], stranger).result,
    ).toBeErr(err());
  });

  it('the owner can cancel a pending nomination', () => {
    simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(next)], deployer);
    expect(
      simnet.callPublicFn(contract, 'cancel-ownership-transfer', [], deployer).result,
    ).toBeOk(Cl.bool(true));
    expect(simnet.callReadOnlyFn(contract, 'get-pending-owner', [], deployer).result).toBeNone();

    // The cancelled nominee can no longer claim it.
    expect(simnet.callPublicFn(contract, 'accept-ownership', [], next).result).toBeErr(err());
  });

  it('a stranger cannot cancel a pending nomination', () => {
    simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(next)], deployer);
    expect(
      simnet.callPublicFn(contract, 'cancel-ownership-transfer', [], stranger).result,
    ).toBeErr(err());
    expect(
      simnet.callReadOnlyFn(contract, 'get-pending-owner', [], deployer).result,
    ).toBeSome(Cl.principal(next));
  });

  it('the old owner loses its powers after the handover', () => {
    simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(next)], deployer);
    simnet.callPublicFn(contract, 'accept-ownership', [], next);
    expect(
      simnet.callPublicFn(contract, 'transfer-ownership', [Cl.principal(stranger)], deployer).result,
    ).toBeErr(err());
  });
});

describe('risk-registry admin after handover', () => {
  it('the new owner can authorise publishers and the old one cannot', () => {
    simnet.callPublicFn('risk-registry', 'transfer-ownership', [Cl.principal(next)], deployer);
    simnet.callPublicFn('risk-registry', 'accept-ownership', [], next);

    expect(
      simnet.callPublicFn('risk-registry', 'set-publisher',
        [Cl.principal(stranger), Cl.bool(true)], next).result,
    ).toBeOk(Cl.bool(true));

    expect(
      simnet.callPublicFn('risk-registry', 'set-publisher',
        [Cl.principal(stranger), Cl.bool(false)], deployer).result,
    ).toBeErr(Cl.uint(100));
  });
});

describe('sentinel readers', () => {
  it('exposes both no-debt sentinels by name', () => {
    expect(
      simnet.callReadOnlyFn('risk-registry', 'get-unbounded-health-factor', [], deployer).result,
    ).toBeUint(340282366920938463463374607431768211455n);
    expect(
      simnet.callReadOnlyFn('risk-registry', 'get-max-liquidation-distance', [], deployer).result,
    ).toBeUint(10000);
  });
});
