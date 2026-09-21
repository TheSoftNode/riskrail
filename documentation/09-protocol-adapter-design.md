# Protocol Adapter Design

Protocol adapters are the main extension point in Rivisk. The whole project depends on getting this boundary right.

## The problem adapters solve

Every protocol has its own contracts, read-only functions, events and economic model. If the API and risk engine knew about all of those details, adding a protocol would require changes throughout the system.

Instead, the adapter answers one narrow question:

> For this address and source context, what normalized positions does this protocol create?

## Shared interface

The current core interface is intentionally small:

```ts
interface ProtocolAdapter {
  metadata(): ProtocolMetadata;
  supports(address: string, context: AdapterContext): Promise<boolean>;
  getPositions(address: string, context: AdapterContext): Promise<NormalizedPosition[]>;
}
```

That is enough for the first implementation. Later additions should be justified by real cross-protocol needs rather than by one adapter requesting a special method.

## `NormalizedPosition`

The normalized model carries common economic fields:

- stable position id;
- owner;
- protocol metadata;
- position type;
- one or more assets;
- optional USD value;
- collateral information;
- debt information;
- liquidation information;
- liquidity information;
- accessibility information;
- source block/time/exactness;
- protocol-specific metadata.

A position should contain facts, not presentation labels.

For example, the adapter can provide a health factor, but it should not decide that the position is "critical." The risk engine owns that classification.

## Position identity

Position ids need to be stable across refreshes.

Examples:

```text
native:SP...
bitpay:42
lending:SP...:market-1
lp:SP...:pool-7
```

A stable id allows an update to create a historical snapshot while upserting the latest `Position` record.

## Native Stacks adapter

The native adapter already reads address balances and emits one wallet position containing STX and fungible tokens.

Two important caveats are deliberately documented in the code:

1. arbitrary SIP-010 token decimals require metadata resolution;
2. the adapter should not claim valuation until a token can be identified and priced reliably.

sBTC can be recognized explicitly with its known decimal precision once contract identity is configured per network.

## BitPay adapter

BitPay is useful as the first real protocol integration because it comes from an existing Stacks project and represents capital with a time/accessibility dimension.

The adapter uses a `BitPayReader` abstraction rather than importing the old BitPay backend.

For each stream it calculates:

```text
locked = total amount - withdrawn amount
withdrawable = vested amount - withdrawn amount
liquid share = withdrawable / locked
```

The position is represented as a `stream` with sBTC in the `locked` role and an `accessibility.liquidBps` value.

This lets the portfolio engine answer a question that normal wallet balance screens do not: how much economic value exists but cannot be accessed immediately?

## Zest V2 lending adapter

The first external lending adapter is now `packages/adapter-zest-v2`. It is the first integration that gives Rivisk real collateral and debt state rather than only wallet balances or time-locked streams.

The adapter reads the current Zest V2 obligation model and maps:

- collateral entries;
- scaled debt entries;
- zToken shares into underlying exposure;
- borrow indexes into current debt amounts;
- borrow LTV;
- partial/full liquidation LTVs;
- liquidation penalty bounds.

Those protocol facts are attached to the normalized position. Shared LTV, health-factor, liquidation-distance and stress arithmetic stays outside the adapter. That is an important boundary: if a second lending protocol can supply the same normalized inputs, it should be able to reuse the same portfolio/risk path.

The current adapter has mainnet defaults for the published Zest V2 deployment, but every contract is configurable. It is disabled unless `ZEST_V2_ENABLED=true`. Non-mainnet use requires explicit contract configuration.

The adapter still needs live validation against known mainnet obligations. Mocked unit tests prove the mapping and math boundary; they are not a substitute for comparing the reader output to real protocol state.

See [32 — Zest V2 lending and stress engine](./32-zest-v2-lending-and-stress-engine.md) for the full implementation note.

## Adapter implementation checklist

A new adapter is not finished when it can return a happy-path position. It should also define:

- supported network(s);
- contract ids;
- adapter version;
- source of token metadata;
- source block semantics;
- whether returned values are exact or estimated;
- behavior when a contract read fails;
- behavior when no position exists;
- event types that should trigger re-indexing;
- fixture data;
- unit/integration tests;
- documentation of the protocol formulas Rivisk relies on.

## Adapter versioning

A protocol can upgrade its contract or economic model. Rivisk therefore needs adapter versions.

The database `Protocol.adapterVersion` and on-chain protocol registry both leave room for this.

A version change should be explicit when it changes how positions are interpreted, not just when internal code is refactored.

## Failure handling

Adapters should fail in a way that preserves partial portfolio usefulness.

If one protocol is temporarily unavailable, Rivisk should be able to say:

> 2 of 3 integrations indexed successfully; Protocol X is stale as of block Y.

It should not silently return a lower total portfolio value as if the missing protocol had zero exposure.

## Adding a new adapter

The expected workflow is:

1. create `packages/adapter-{protocol}`;
2. implement `ProtocolAdapter`;
3. create protocol reader/client helpers;
4. add fixtures from testnet/mainnet state;
5. test normalization;
6. register protocol metadata;
7. connect relevant Chainhook predicates/events;
8. wire the adapter into the indexer registry;
9. add documentation;
10. verify portfolio/risk behavior with a known address.
