# Rivisk contracts

These contracts never custody user assets.

- Risk calculations happen off-chain.
- `risk-registry` stores compact bounded metrics and a `(buff 32)` SHA-256 report hash, append-only.
- `risk-policy` stores a wallet's own thresholds, written against `tx-sender`.
- `protocol-registry` records which protocols Rivisk has an adapter for -- support, not endorsement.
- `risk-provider-trait` is the stable interface other Clarity contracts integrate against.
- `examples/risk-consumer-example` is reference material showing how to consume the trait.

## Designed for external consumers

The trait is the product surface, not an afterthought for our own dashboard.
Two design choices exist specifically to stop a consuming contract reaching a
wrong conclusion, and both are easy to undo by accident:

1. **`get-risk-if-fresh` returns `none` rather than a stale reading.** The
   freshness check cannot be skipped because there is no way to get the value
   without passing a max age.
2. **A debt-free wallet publishes the safest values, not zero.**
   `health-factor-e4` is the maximum uint and `liquidation-distance-bps` is
   `u10000`. With zero, a consumer's natural `(>= health-factor threshold)`
   check would read "no debt" as "about to be liquidated" -- exactly backwards.
   The publisher in `packages/rivisk-contracts` mirrors these constants.

A trait cannot be changed after deployment, so the surface is meant to be the
one we keep. Adding to it later means a second trait and a migration for every
integrator.

Full integration guide: [documentation/35-consuming-rivisk-onchain.md](../documentation/35-consuming-rivisk-onchain.md).

## Deployment lifecycle

The contracts on Stacks testnet today are the **beta v1 deployment**
(`contracts/deployments/testnet.json`). They work: attestations are published
against them and `risk-consumer-example` has read one through the trait. That is
not the same as the design being final.

```text
testnet v1 (today)
      ↓
independent contract / security review
      ↓
fix findings, improve the design where needed
      ↓
redeploy the revised contracts to testnet if the code changed
      ↓
re-run contract and integration validation, including the consumer path
      ↓
mainnet deployment if no blocking finding remains
```

A Clarity contract cannot be edited in place, so any change the review calls for
means a **new deployment and a new validation pass on testnet** before mainnet.
The review and the mainnet release are
[Milestone 3 grant work](../documentation/22-grant-milestones.md); mainnet is
targeted only after the reviewed version has passed tests and testnet validation,
never simply because a beta deployment already exists.

## Tests

`tests/external-consumption.test.ts` is written from the outside in: it checks
that a different contract, one that knows nothing about our storage, can read a
wallet's risk, is refused when the reading is stale, and cannot be fooled by the
no-debt case. The rest of the suite covers publisher authorization and
revocation, history retention, policy ownership and protocol-registry
administration.

```bash
pnpm --filter @rivisk/contracts test
```

The current manifest targets Clarity 5 / epoch 3.4, the mainnet-era default in
2026. Validate with the exact Clarinet version used for deployment before
testnet/mainnet release. Note that `clarinet check` from an older CLI (2.x) will
reject `epoch = 3.4`; the SDK used by the tests accepts it.

> **Name in the deployed source.** The project was renamed from RiskRail to
> Rivisk on 2026-09-21, after the testnet deployment. The `.clar` files still say
> "RiskRail" in their comments because they must stay byte-for-byte identical to
> the contracts on chain. Contract names and behaviour carry no brand, so nothing
> functional depends on it; the comments change at the next deployment.
