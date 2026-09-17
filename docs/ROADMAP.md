# RiskRail grant delivery roadmap

## Milestone 1 — Cross-protocol portfolio + contract foundation (Weeks 1–3)

Deliver:
- Native Stacks/sBTC balance adapter.
- BitPay protocol adapter.
- External adapter interface and normalized position schema.
- Portfolio aggregation and concentration metrics.
- `risk-provider-trait`, `risk-registry`, and `protocol-registry` contracts.
- Testnet risk-attestation flow: report -> canonical hash -> on-chain snapshot.

Status: the repository now contains the working Milestone 1 data path. Testnet deployment/confirmation tracking still needs environment-level validation.

## Milestone 2 — Risk product + user policies (Weeks 4–7)

Deliver:
- Lending/collateral integration.
- Collateral health and liquidation-distance analytics.
- BTC -10/-20/-30 stress scenarios and custom shock input.
- Risk dashboard and realtime updates.
- `risk-policy.clar` with Chainhook-driven alert evaluation.

Current progress:
- Zest V2 adapter foundation is implemented against the public V2 contract model.
- Shared lending LTV/health/liquidation calculations are implemented.
- Built-in and custom deterministic stress scenarios are implemented.
- Simulation API endpoints are implemented.
- Default stress results are included in versioned risk reports.

Still required for Milestone 2 completion:
- live Zest mainnet validation against known obligations;
- dashboard screens;
- risk-policy evaluation;
- Chainhook-driven incremental refresh;
- realtime/cooldown-aware alert delivery;
- market-depth liquidity analysis.

## Milestone 3 — Public beta + developer infrastructure (Weeks 8–10)

Deliver:
- Public beta deployment.
- Versioned REST API and OpenAPI docs.
- TypeScript SDK.
- Signed developer webhooks and API-key infrastructure.
- External developer testing and one integration proof of concept.

Acceptance:
- Public API/SDK documentation exists.
- External developers can retrieve portfolio/risk data and on-chain attestation metadata.
- Usage and tester feedback are documented for the next roadmap.
