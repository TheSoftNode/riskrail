# Zest V2 lending integration and the first real stress engine

This note records the first external lending integration in RiskRail and the reasoning behind it. It is deliberately more practical than the general architecture documents. The goal is to leave enough context that somebody can open the repository months from now and understand what the Zest adapter is doing, which parts are protocol facts, which parts are RiskRail calculations, and where the implementation still needs live-network validation.

## Why Zest V2 is the first lending integration

RiskRail became useful as soon as it could combine a native wallet position with BitPay stream positions, but that still did not exercise the part of the product that matters most for market-risk monitoring: collateral and debt.

A lending market gives us the data needed to answer questions such as:

- how much collateral does this account have;
- how much debt is outstanding after interest accrual;
- what is the account's current loan-to-value ratio;
- how much room remains before a protocol liquidation threshold is reached;
- what happens to the account if BTC or another collateral asset falls sharply.

Zest V2 is a good first target because its current Stacks contracts are public, its position storage is readable on-chain, and its risk parameters are part of the protocol state rather than numbers RiskRail has to invent.

The adapter lives at `packages/adapter-zest-v2`.

## The protocol state we read

The integration is based on the current Zest V2 contract layout. The key contracts are:

- `v0-market-vault` for account obligations, collateral and scaled debt;
- `v0-assets` for asset registry information and decimals;
- `v0-egroup` for the LTV and liquidation parameters that apply to an obligation mask;
- the asset-specific vaults for share conversion and current borrow indexes;
- `v0-8-market` as the current market/orchestration contract in the published mainnet deployment.

The mainnet deployment address and contract names are kept in one place in the adapter. They can all be overridden through environment variables. This matters because protocol contracts can be upgraded. We do not want a contract address scattered through API controllers, workers and UI code.

When Zest support is enabled on mainnet, the adapter can use the currently published contract set. On testnet or another network, the contracts must be supplied explicitly.

## How an account becomes a RiskRail position

The read starts with `get-position` on the Zest market vault. Zest stores a user's lending state as an obligation. The returned state contains a mask, collateral entries and scaled debt entries.

RiskRail does not persist that shape directly as its public portfolio format. Instead, the Zest adapter translates it into a `NormalizedPosition`.

The flow is:

```text
Stacks address
    |
    v
Zest market-vault.get-position
    |
    +--> collateral asset ids + amounts
    +--> debt asset ids + scaled amounts
    +--> obligation mask
    |
    v
Zest asset registry + vault reads
    |
    +--> decimals / token contract
    +--> zToken -> underlying conversion
    +--> scaled debt -> current debt conversion
    |
    v
Zest egroup.resolve(mask)
    |
    +--> borrow LTV
    +--> partial-liquidation LTV
    +--> full-liquidation LTV
    +--> liquidation penalty bounds
    |
    v
RiskRail NormalizedPosition
```

At this point the portfolio engine no longer needs Zest-specific branches. It sees collateral assets, debt assets and protocol-supplied lending parameters through the same domain model that another lending adapter can use later.

## zTokens and underlying exposure

Zest supports both underlying collateral and yield-bearing zTokens. A zToken amount is not treated as if it were the same number of underlying tokens.

When a position contains a zToken, the adapter calls the corresponding vault's `convert-to-assets` read-only function and normalizes the position to its underlying exposure. The original protocol token and protocol amount are still preserved in metadata so we do not lose auditability.

For example, a zsBTC collateral entry is represented to the risk engine as sBTC exposure after conversion, while metadata records that the source position was zsBTC.

This distinction matters because the portfolio engine should calculate exposure from the economic asset, not from a share token whose exchange rate changes over time.

## Scaled debt and interest

Zest stores debt in scaled form. The scaled amount is deliberately stable while the borrow index changes as interest accrues.

RiskRail therefore does not treat the stored scaled number as the user's current debt. The adapter reads the vault's next borrow index and computes the current amount using Zest's index precision:

```text
actual debt = ceil(scaled debt * next borrow index / 1e12)
```

The use of upward rounding is intentional for a risk view. It also follows the conservative direction used by lending accounting when converting debt.

The original scaled amount is retained in adapter metadata alongside the normalized debt amount.

## Where the LTV thresholds come from

RiskRail does not hard-code a generic 75% or 80% liquidation threshold for Zest.

The adapter resolves the account's obligation mask through the Zest egroup registry and reads the parameters that apply to that combination of assets. Those values include:

- `LTV-BORROW`;
- `LTV-LIQ-PARTIAL`;
- `LTV-LIQ-FULL`;
- minimum and maximum liquidation penalties.

Those values are protocol facts. They are attached to the normalized position as `LendingRiskParameters`.

The portfolio engine then performs the protocol-independent arithmetic.

## RiskRail's lending calculations

Once collateral and debt have USD values, RiskRail derives a few common metrics.

### Current LTV

```text
current LTV = debt USD / collateral USD
```

The value is exposed in basis points. `5,000` therefore means 50%.

### Health factor

For the first lending implementation, health is measured against the protocol's partial-liquidation LTV:

```text
health factor = partial liquidation LTV / current LTV
```

It is stored as E4 fixed point. A health factor of `1.2500` is stored as `12500`.

A value above 1 means the current debt/collateral relationship is still on the non-liquidatable side of that threshold. A value below 1 means the position has crossed it under the prices used by RiskRail.

This number is a RiskRail representation of protocol parameters; it should not be described as an official Zest UI metric unless the protocol itself exposes the same label and formula.

### Distance to liquidation

The first implementation estimates the percentage collateral-price decline required to reach the partial-liquidation threshold:

```text
distance = 1 - (current LTV / partial liquidation LTV)
```

For a single-collateral position, the same relationship can be used to estimate a liquidation price. For multi-collateral positions, RiskRail labels the result as a portfolio approximation rather than pretending there is one exact liquidation price for every asset.

### Borrow headroom

When a borrow LTV is available, the engine also exposes the difference between the current LTV and that borrow threshold. This is a useful operational metric, but it is not a recommendation to borrow more.

## Pricing: an important distinction

Zest's protocol contracts use their own on-chain oracle system for protocol health and liquidation decisions. RiskRail's current MVP valuation layer uses its own external mark-to-market price abstraction for portfolio analytics.

That means two things:

1. the LTV and liquidation *thresholds* are read from Zest contract state;
2. the USD prices used by the current RiskRail portfolio calculation are not being claimed as the exact oracle values Zest would use in a transaction at the same instant.

This is intentional for the first external adapter, but it must remain visible in the UI and documentation. A later Zest-specific price source can read or reconstruct the protocol's own oracle marks when we need closer execution-level parity.

If a required asset does not have a supported RiskRail price, the engine leaves it unvalued and lowers valuation coverage. It does not guess a USD value.

## The stress engine

The risk engine now has a deterministic scenario runner. A scenario contains one or more asset shocks expressed in basis points.

Built-in scenarios currently include:

```text
BTC -10%
BTC -20%
BTC -30%
STX -20%
```

The engine can also accept a custom combination such as:

```text
sBTC -18%
STX  -12%
USDC  -2%
```

For each scenario, RiskRail:

1. copies the current normalized positions;
2. applies the requested price shock to matching assets;
3. recalculates the USD value of those assets;
4. recalculates position equity;
5. recomputes lending metrics from the stressed collateral/debt values;
6. compares the before/after health factor and liquidation distance;
7. records warnings when a position crosses a liquidation threshold under the scenario.

Nothing is sent to the blockchain and no position is changed. A stress scenario is only a deterministic what-if calculation over the latest indexed state.

## API surface

The API now exposes two simulation routes.

`GET /api/v1/simulations/presets` returns the built-in scenarios.

`POST /api/v1/simulations` accepts a wallet and custom shocks. A typical request is:

```json
{
  "address": "SP...",
  "name": "BTC drawdown",
  "shocks": [
    { "symbol": "sBTC", "changeBps": -2000 }
  ]
}
```

The endpoint uses the latest persisted portfolio snapshot. It does not silently trigger a fresh index. This keeps simulations reproducible against a known source block. The response therefore includes the source block and valuation coverage alongside the scenario result.

## Default stress results are now part of the risk report

The background risk worker runs the default scenarios after each successful portfolio refresh. The results are included in the canonical risk report before the report is hashed.

That has two useful consequences:

- the API has a historical record of what the standard scenarios looked like at each risk snapshot;
- an on-chain report hash commits to the same stress results that were shown off-chain for that snapshot.

The methodology version was moved to `riskrail-v1.1` because adding lending normalization and scenario recalculation changes the content and interpretation of the risk report.

## Enabling the adapter

The adapter is disabled by default.

```env
ZEST_V2_ENABLED=false
```

For mainnet testing, set:

```env
STACKS_NETWORK=mainnet
ZEST_V2_ENABLED=true
```

The adapter contains defaults for the currently published Zest V2 mainnet deployment. If Zest upgrades a contract, update the configuration rather than changing calculation code.

For non-mainnet environments, supply the contract variables shown in `.env.example`. This prevents a test environment from accidentally reading mainnet contracts simply because a default exists.

## What has been tested in this pass

The repository includes unit tests for:

- Zest position normalization with mocked contract-reader output;
- collateral/debt valuation and net equity;
- LTV, health factor, liquidation distance and single-collateral liquidation price;
- a BTC drawdown that moves a lending position from healthy to below the partial-liquidation threshold.

A syntax parse was also run across the TypeScript/TSX source tree.

The remaining validation is important: the adapter still needs to be exercised against a real Zest mainnet address with a known obligation and compared field-by-field with protocol state. That live comparison should happen before we call the integration production-ready.

## What comes next

This implementation gets RiskRail over an important line: the platform can now represent a real lending obligation and recompute its risk under price shocks.

The next work should focus on productization rather than adding a second lending protocol immediately:

- validate the Zest reader against live positions;
- persist scenario runs if we want user-created simulation history;
- expose the lending metrics cleanly in the dashboard;
- add Chainhook-driven refreshes for Zest position changes;
- implement risk-policy evaluation against the new health/liquidation metrics;
- add realtime alerts and cooldown handling;
- improve liquidity risk with market-depth data rather than the current accessibility proxy.

Once those pieces are stable, adding another lending adapter becomes a useful proof that the normalization boundary is truly protocol-independent.

## Protocol references used for this integration

The implementation was checked against the public Zest V2 contract repository, especially:

- `mainnet/README.md` for the current published deployment;
- `docs/market.md` for the position/health model;
- `mainnet/contracts/market/v0-market-vault.clar` for `get-position` and scaled debt storage;
- `mainnet/contracts/registry/v0-assets.clar` for asset metadata;
- `mainnet/contracts/registry/v0-egroup.clar` for the risk thresholds;
- the asset vault contracts for share conversion and borrow indexes.

The source repository is `Zest-Protocol/zest-v2-contracts` on GitHub.
