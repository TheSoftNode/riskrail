# Protocol adapters

Every integration implements the `ProtocolAdapter` contract from `@riskrail/adapter-core`.

An adapter is responsible for protocol-specific reads and mapping only. It does not calculate portfolio-wide risk.

Required responsibilities:

1. Identify protocol metadata and canonical contracts.
2. Discover positions for a Stacks principal.
3. Map protocol values into `NormalizedPosition`.
4. Preserve block height and source metadata for auditability.
5. Mark exact vs estimated fields explicitly.
6. Attach protocol facts such as lending thresholds when the protocol exposes them.

Current adapters:

- `adapter-native-stacks` — wallet STX/SIP-010 balances and capital accessibility.
- `adapter-bitpay` — BitPay stream positions and locked/withdrawable sBTC.
- `adapter-zest-v2` — Zest V2 collateral/debt obligations, zToken normalization, scaled-debt normalization and protocol LTV/liquidation parameters.

The Zest integration is the first external lending adapter. It deliberately stops at protocol-specific state extraction. Common LTV, health-factor, liquidation-distance and stress arithmetic lives in the portfolio/risk packages so a future lending adapter can reuse the same calculation path.

See `documentation/32-zest-v2-lending-and-stress-engine.md` for the detailed implementation notes and current limitations.
