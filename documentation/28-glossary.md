# Glossary

## Adapter

A package that understands one protocol and converts its native state into RiskRail's normalized position format.

## Attestation

A compact on-chain record containing summary risk metrics, source block and a hash of a full off-chain RiskRail report.

## Basis points (bps)

Integer percentage representation. 10,000 bps = 100%, 100 bps = 1%.

## BitPay

An earlier Stacks/sBTC project used by RiskRail as a source of reusable engineering patterns and as an initial protocol adapter for streaming positions.

## Capital accessibility

The share of a position or portfolio that is immediately available versus locked, vesting or otherwise committed.

## Chainhook

Stacks event-monitoring infrastructure used to deliver selected blockchain/contract events to RiskRail.

## Clarity

The smart contract language used on Stacks and by RiskRail's on-chain registry/policy contracts.

## Health factor E4

Fixed-point representation of a health factor with four decimal places. Example: 14,700 = 1.4700.

## Indexer

The process responsible for observing Stacks state/events and refreshing normalized positions.

## Liquidation distance

A measure of how far a supported collateralized position is from the protocol's liquidation condition. Exact meaning depends on the protocol methodology.

## Normalized position

RiskRail's protocol-independent representation of one wallet/protocol position.

## Oracle / price source

The system/source used to associate a market price with an asset. RiskRail records source and freshness because risk calculations depend on it.

## Portfolio

The set of normalized positions associated with the monitored wallet (and, later, potentially several addresses).

## Protocol concentration

Share of known valued portfolio exposure associated with one protocol.

## Publisher

An authorized Stacks principal allowed to write snapshots to `risk-registry.clar`.

## Risk policy

User-configured thresholds stored either off-chain as alert rules or, for a small standardized subset, in `risk-policy.clar`.

## Risk report

The complete versioned off-chain document containing source positions, price observations, metrics, scenarios, warnings and methodology references for a calculation.

## Risk snapshot

A persisted summary of risk metrics at a particular source state. It may or may not also have an on-chain attestation.

## sBTC

Bitcoin-backed asset used in the Stacks ecosystem. RiskRail treats it as a key asset exposure but still identifies it by configured contract/network metadata rather than name alone in production.

## Source block

The Stacks block height associated with the source data used for a report/snapshot.

## Stress scenario

A deterministic what-if change to prices or other supported inputs. It is a simulation, not a prediction.

## Valuation coverage

The share of discovered portfolio positions/assets for which RiskRail has reliable valuation data.

## Webhook

An HTTP callback RiskRail sends to an external developer endpoint when selected events occur. RiskRail webhooks are signed and retried.
