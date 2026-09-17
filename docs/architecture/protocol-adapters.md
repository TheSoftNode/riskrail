# Protocol adapters

Every integration implements the `ProtocolAdapter` contract from `@riskrail/adapter-core`.

An adapter is responsible for protocol-specific reads and mapping only. It does not calculate portfolio-wide risk.

Required responsibilities:

1. Identify protocol metadata and canonical contracts.
2. Discover positions for a Stacks principal.
3. Map protocol values into `NormalizedPosition`.
4. Preserve block height and source metadata for auditability.
5. Mark exact vs estimated fields explicitly.

The first adapters are `native-stacks` and `bitpay`. The first external DeFi adapter should be a lending/collateral protocol because it unlocks liquidation and health-factor analytics.
