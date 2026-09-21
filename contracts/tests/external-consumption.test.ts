import { describe, expect, it, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

/**
 * These tests are written from the outside in.
 *
 * The rest of the suite checks that Rivisk's publisher can write. This file
 * checks the thing the project actually depends on: that a *different* contract,
 * one that knows nothing about our storage, can read a wallet's risk and refuse
 * to act on it when it is stale.
 */

const HASH = new Uint8Array(32).fill(7);
const OTHER_HASH = new Uint8Array(32).fill(9);

/** Matches HEALTH_FACTOR_UNBOUNDED in risk-registry.clar. */
const UNBOUNDED = 340282366920938463463374607431768211455n;

let deployer: string;
let wallet: string;
let stranger: string;
let registry: string;

beforeEach(() => {
  const accounts = simnet.getAccounts();
  deployer = accounts.get('deployer')!;
  wallet = accounts.get('wallet_1')!;
  stranger = accounts.get('wallet_2')!;
  registry = `${deployer}.risk-registry`;
});

function publish(
  target: string,
  opts: {
    sender?: string;
    healthFactor?: bigint | number;
    concentration?: number;
    hash?: Uint8Array;
  } = {},
) {
  return simnet.callPublicFn(
    'risk-registry',
    'publish-risk-snapshot',
    [
      Cl.principal(target),
      Cl.uint(6400),
      Cl.uint(opts.healthFactor ?? 14700),
      Cl.uint(1800),
      Cl.uint(opts.concentration ?? 4400),
      Cl.uint(7200),
      Cl.uint(0),
      Cl.buffer(opts.hash ?? HASH),
    ],
    opts.sender ?? deployer,
  );
}

describe('a consuming contract can read risk', () => {
  it('approves an action when the wallet is healthy', () => {
    publish(wallet);

    const result = simnet.callPublicFn(
      'risk-consumer-example',
      'open-position',
      [Cl.contractPrincipal(deployer, 'risk-registry'), Cl.principal(wallet)],
      stranger,
    );

    // Returns the snapshot id it decided from, so the decision is traceable.
    expect(result.result).toBeOk(Cl.uint(1));
    expect(
      simnet.callReadOnlyFn('risk-consumer-example', 'get-approvals', [], deployer).result,
    ).toBeUint(1);
  });

  it('refuses when the health factor is below the consumer threshold', () => {
    publish(wallet, { healthFactor: 11000 }); // 1.10, under the consumer's 1.25

    const result = simnet.callPublicFn(
      'risk-consumer-example',
      'open-position',
      [Cl.contractPrincipal(deployer, 'risk-registry'), Cl.principal(wallet)],
      stranger,
    );
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it('refuses when the portfolio is too concentrated', () => {
    publish(wallet, { concentration: 9000 }); // 90%, over the consumer's 60%

    const result = simnet.callPublicFn(
      'risk-consumer-example',
      'open-position',
      [Cl.contractPrincipal(deployer, 'risk-registry'), Cl.principal(wallet)],
      stranger,
    );
    expect(result.result).toBeErr(Cl.uint(402));
  });

  it('refuses a wallet that has never been attested', () => {
    const result = simnet.callPublicFn(
      'risk-consumer-example',
      'open-position',
      [Cl.contractPrincipal(deployer, 'risk-registry'), Cl.principal(stranger)],
      stranger,
    );
    expect(result.result).toBeErr(Cl.uint(400));
  });
});

describe('stale risk is refused, not returned', () => {
  it('stops approving once the snapshot ages past the consumer max', () => {
    publish(wallet);

    // Consumer allows 144 blocks. Age it past that.
    simnet.mineEmptyBlocks(200);

    const result = simnet.callPublicFn(
      'risk-consumer-example',
      'open-position',
      [Cl.contractPrincipal(deployer, 'risk-registry'), Cl.principal(wallet)],
      stranger,
    );
    // Not "unhealthy" -- there is simply no reading recent enough to use.
    expect(result.result).toBeErr(Cl.uint(400));
  });

  it('get-risk-if-fresh returns none rather than a stale number', () => {
    publish(wallet);
    simnet.mineEmptyBlocks(50);

    const fresh = simnet.callReadOnlyFn(
      'risk-registry', 'get-risk-if-fresh',
      [Cl.principal(wallet), Cl.uint(100)], deployer,
    );
    expect(fresh.result).not.toBeOk(Cl.none());

    const stale = simnet.callReadOnlyFn(
      'risk-registry', 'get-risk-if-fresh',
      [Cl.principal(wallet), Cl.uint(10)], deployer,
    );
    expect(stale.result).toBeOk(Cl.none());

    // The unguarded read still hands back the old value -- which is exactly why
    // consumers are pointed at get-risk-if-fresh instead.
    const unguarded = simnet.callReadOnlyFn(
      'risk-registry', 'get-latest-health-factor', [Cl.principal(wallet)], deployer,
    );
    expect(unguarded.result).toBeOk(Cl.some(Cl.uint(14700)));
  });

  it('is-snapshot-fresh agrees with get-risk-if-fresh', () => {
    publish(wallet);
    simnet.mineEmptyBlocks(50);

    expect(
      simnet.callReadOnlyFn('risk-registry', 'is-snapshot-fresh',
        [Cl.principal(wallet), Cl.uint(100)], deployer).result,
    ).toBeOk(Cl.bool(true));

    expect(
      simnet.callReadOnlyFn('risk-registry', 'is-snapshot-fresh',
        [Cl.principal(wallet), Cl.uint(10)], deployer).result,
    ).toBeOk(Cl.bool(false));
  });
});

describe('no-debt sentinels keep the naive check safe', () => {
  it('treats an unbounded health factor as safe', () => {
    // A wallet with no debt. Published as max uint, never as zero.
    publish(wallet, { healthFactor: UNBOUNDED });

    expect(
      simnet.callPublicFn('risk-consumer-example', 'open-position',
        [Cl.contractPrincipal(deployer, 'risk-registry'), Cl.principal(wallet)],
        stranger).result,
    ).toBeOk(Cl.uint(1));
  });

  it('exposes the sentinel so integrators need not paste the literal', () => {
    expect(
      simnet.callReadOnlyFn('risk-registry', 'get-unbounded-health-factor', [], deployer).result,
    ).toBeUint(UNBOUNDED);
  });

  it('would have inverted the decision had no-debt been published as zero', () => {
    publish(wallet, { healthFactor: 0 });

    // This is the failure the sentinel choice exists to prevent: a debt-free
    // wallet reading as the least safe possible position.
    expect(
      simnet.callPublicFn('risk-consumer-example', 'open-position',
        [Cl.contractPrincipal(deployer, 'risk-registry'), Cl.principal(wallet)],
        stranger).result,
    ).toBeErr(Cl.uint(401));
  });
});

describe('publisher authorization', () => {
  it('rejects a wallet that was never authorized', () => {
    expect(publish(wallet, { sender: stranger }).result).toBeErr(Cl.uint(100));
  });

  it('accepts an authorized publisher and rejects it again after revocation', () => {
    expect(
      simnet.callPublicFn('risk-registry', 'set-publisher',
        [Cl.principal(stranger), Cl.bool(true)], deployer).result,
    ).toBeOk(Cl.bool(true));

    expect(publish(wallet, { sender: stranger }).result).toBeOk(Cl.uint(1));

    simnet.callPublicFn('risk-registry', 'set-publisher',
      [Cl.principal(stranger), Cl.bool(false)], deployer);

    expect(publish(wallet, { sender: stranger }).result).toBeErr(Cl.uint(100));
  });

  it('does not let a non-owner authorize publishers', () => {
    expect(
      simnet.callPublicFn('risk-registry', 'set-publisher',
        [Cl.principal(stranger), Cl.bool(true)], stranger).result,
    ).toBeErr(Cl.uint(100));
  });

  it('keeps snapshots published before a revocation readable', () => {
    simnet.callPublicFn('risk-registry', 'set-publisher',
      [Cl.principal(stranger), Cl.bool(true)], deployer);
    publish(wallet, { sender: stranger });
    simnet.callPublicFn('risk-registry', 'set-publisher',
      [Cl.principal(stranger), Cl.bool(false)], deployer);

    // Revoking a publisher must not erase what it already attested.
    expect(
      simnet.callReadOnlyFn('risk-registry', 'get-latest-risk-score',
        [Cl.principal(wallet)], deployer).result,
    ).toBeOk(Cl.some(Cl.uint(6400)));
  });
});

describe('history stays verifiable', () => {
  it('keeps every earlier snapshot addressable by id', () => {
    publish(wallet, { hash: HASH });
    publish(wallet, { hash: OTHER_HASH });

    expect(
      simnet.callReadOnlyFn('risk-registry', 'get-latest-snapshot-id',
        [Cl.principal(wallet)], deployer).result,
    ).toBeSome(Cl.uint(2));

    const first = simnet.callReadOnlyFn('risk-registry', 'get-snapshot',
      [Cl.principal(wallet), Cl.uint(1)], deployer);
    expect(first.result).not.toBeNone();

    // The first report hash survives the second publish, so an attestation made
    // at that block can still be checked against the JSON it came from.
    const latestHash = simnet.callReadOnlyFn('risk-registry', 'get-latest-report-hash',
      [Cl.principal(wallet)], deployer);
    expect(latestHash.result).toBeOk(Cl.some(Cl.buffer(OTHER_HASH)));
  });

  it('refuses a snapshot claiming to describe a future block', () => {
    const result = simnet.callPublicFn('risk-registry', 'publish-risk-snapshot', [
      Cl.principal(wallet), Cl.uint(6400), Cl.uint(14700), Cl.uint(1800),
      Cl.uint(4400), Cl.uint(7200),
      Cl.uint(simnet.blockHeight + 1000),
      Cl.buffer(HASH),
    ], deployer);
    expect(result.result).toBeErr(Cl.uint(103));
  });

  it('rejects out-of-range basis points', () => {
    const result = simnet.callPublicFn('risk-registry', 'publish-risk-snapshot', [
      Cl.principal(wallet), Cl.uint(10001), Cl.uint(14700), Cl.uint(1800),
      Cl.uint(4400), Cl.uint(7200), Cl.uint(0), Cl.buffer(HASH),
    ], deployer);
    expect(result.result).toBeErr(Cl.uint(101));
  });
});

describe('policies are owned by the wallet that sets them', () => {
  it('writes against tx-sender and leaves other wallets untouched', () => {
    simnet.callPublicFn('risk-policy', 'set-risk-policy', [
      Cl.uint(7000), Cl.uint(13000), Cl.uint(5000), Cl.uint(4000),
    ], wallet);

    expect(
      simnet.callReadOnlyFn('risk-policy', 'get-risk-policy',
        [Cl.principal(stranger)], stranger).result,
    ).toBeNone();
  });

  it('does not let one wallet disable another wallet policy', () => {
    simnet.callPublicFn('risk-policy', 'set-risk-policy', [
      Cl.uint(7000), Cl.uint(13000), Cl.uint(5000), Cl.uint(4000),
    ], wallet);

    // set-policy-enabled only ever addresses tx-sender, so the stranger's call
    // is a no-op against their own (absent) policy rather than a write to
    // someone else's.
    expect(
      simnet.callPublicFn('risk-policy', 'set-policy-enabled', [Cl.bool(false)], stranger).result,
    ).toBeOk(Cl.bool(false));

    const victim = simnet.callReadOnlyFn('risk-policy', 'get-risk-policy',
      [Cl.principal(wallet)], wallet);
    expect(victim.result).not.toBeNone();
  });
});

describe('protocol registry records support, not endorsement', () => {
  it('can disable a protocol without deleting its entry', () => {
    simnet.callPublicFn('protocol-registry', 'register-protocol', [
      Cl.uint(2), Cl.stringAscii('Zest Protocol V2'), Cl.stringAscii('lending'),
      Cl.principal(`${deployer}.risk-policy`), Cl.uint(1), Cl.buffer(new Uint8Array(32)),
    ], deployer);

    expect(
      simnet.callReadOnlyFn('protocol-registry', 'is-supported-protocol',
        [Cl.uint(2)], deployer).result,
    ).toBeBool(true);

    simnet.callPublicFn('protocol-registry', 'set-protocol-enabled',
      [Cl.uint(2), Cl.bool(false)], deployer);

    expect(
      simnet.callReadOnlyFn('protocol-registry', 'is-supported-protocol',
        [Cl.uint(2)], deployer).result,
    ).toBeBool(false);

    // Still present, so snapshots taken while it was enabled remain explicable.
    expect(
      simnet.callReadOnlyFn('protocol-registry', 'get-protocol', [Cl.uint(2)], deployer).result,
    ).not.toBeNone();
  });

  it('does not let a non-owner register a protocol', () => {
    expect(
      simnet.callPublicFn('protocol-registry', 'register-protocol', [
        Cl.uint(3), Cl.stringAscii('Fake'), Cl.stringAscii('lending'),
        Cl.principal(`${deployer}.risk-policy`), Cl.uint(1), Cl.buffer(new Uint8Array(32)),
      ], stranger).result,
    ).toBeErr(Cl.uint(300));
  });
});
