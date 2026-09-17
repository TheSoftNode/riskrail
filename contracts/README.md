# RiskRail contracts

These contracts never custody user assets.

- Risk calculations happen off-chain.
- `risk-registry` stores compact bounded metrics and a `(buff 32)` SHA-256 report hash.
- `risk-policy` stores a user's own thresholds.
- `protocol-registry` stores canonical supported contract principals and adapter versions.
- `risk-provider-trait` exposes a minimal interface for other Clarity contracts.

The current manifest targets Clarity 5 / epoch 3.4, the mainnet-era default in 2026. Validate with the exact Clarinet version used for deployment before testnet/mainnet release.
