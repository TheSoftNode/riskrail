# Smart Contract Design

RiskRail uses Clarity where the blockchain adds something real: verifiability, user-owned policy state and composability. The contracts are not there simply so the product can say it has smart contracts.

## Contract suite

The Clarinet project contains four pieces:

```text
contracts/contracts/
├── traits/risk-provider-trait.clar
├── risk-registry.clar
├── risk-policy.clar
└── protocol-registry.clar
```

## `risk-provider-trait.clar`

The trait defines the smallest useful interface that an external Clarity application can depend on for risk data.

The intention is to make the registry replaceable at the interface level. A future protocol should not need to know every internal detail of RiskRail to request the latest supported risk output.

The trait should remain small. Once an interface is used by other contracts, unnecessary changes become expensive.

## `risk-registry.clar`

This is the main attestation contract.

### Responsibilities

- maintain an owner;
- authorize/revoke publisher principals;
- append risk snapshots for wallet principals;
- track the latest snapshot id for each wallet;
- store compact summary metrics;
- store the source block;
- store a 32-byte report hash;
- expose read-only accessors;
- expose snapshot freshness;
- emit print events for indexing.

### What it does not do

- hold user funds;
- fetch prices;
- discover positions;
- run the cross-protocol risk engine;
- send alerts;
- decide what a user should do.

### Current snapshot fields

```text
risk-score-bps
health-factor-e4
liquidation-distance-bps
protocol-concentration-bps
liquidity-score-bps
source-block
report-hash
published-at
```

Snapshots are keyed by wallet + monotonically increasing id, which gives us history rather than overwriting the last value.

### Publisher model

The contract owner can call `set-publisher` to enable or disable a publisher principal.

In production, the application API should not hold the publisher secret. Publication should happen from an isolated worker/signer path.

## `risk-policy.clar`

This contract lets a wallet define a small policy in its own on-chain state.

Current fields:

- maximum risk score;
- minimum health factor;
- maximum protocol concentration;
- minimum liquidity score;
- enabled flag;
- update block.

The policy belongs to `tx-sender`. Another wallet cannot write somebody else's threshold.

### Why this is useful

A normal database alert is practical, but an on-chain policy has two extra properties:

1. the user can prove the threshold they configured;
2. another Stacks application can read the same policy without asking RiskRail's private database.

The off-chain worker still evaluates and delivers notifications.

## `protocol-registry.clar`

This contract records canonical metadata for protocol integrations:

- protocol id;
- name;
- protocol type;
- contract principal;
- adapter version;
- metadata hash;
- enabled state;
- update block.

The metadata hash can commit to richer off-chain adapter/protocol metadata while keeping the on-chain row small.

This registry is useful for transparency, but it should not be treated as a magical security guarantee. A bad adapter can still interpret a valid contract incorrectly, which is why adapter tests and reviews remain necessary.

## Fixed-point values

Clarity uses integers for these metrics.

RiskRail conventions:

```text
basis points:
10,000 = 100.00%

health factor E4:
14,700 = 1.4700
```

The UI and SDK must convert these carefully and always document units.

## Contract events

Contracts use `print` for events such as:

```text
publisher-updated
risk-snapshot-published
risk-policy-updated
risk-policy-enabled
protocol-registered
protocol-enabled
protocol-adapter-updated
```

Chainhook can listen to these events and keep the off-chain database synchronized with published state.

## Contract upgrade strategy

Clarity contracts are not casually mutable. We should assume a deployed version may need a successor rather than hidden in-place upgrades.

A practical strategy is:

- version contract deployments explicitly;
- keep the public trait as stable as possible;
- publish migration/registry metadata;
- let application configuration point to the active contract per network;
- preserve the ability to verify old report hashes against old registries.

## Testing expectations

Contract tests should cover authorization, validation boundaries, snapshot history, ownership changes, policy ownership, enable/disable behavior and registry administration.

The happy path alone is not enough for a contract that will become a public verification surface.
