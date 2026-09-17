# RiskRail grant delivery roadmap

## Milestone 1 — Cross-protocol portfolio + contract foundation (Weeks 1–3)

Deliver:
- Native Stacks/sBTC balance adapter.
- BitPay protocol adapter.
- External adapter interface and normalized position schema.
- Portfolio aggregation and concentration metrics.
- `risk-provider-trait`, `risk-registry`, and `protocol-registry` contracts.
- Testnet risk-attestation flow: report -> canonical hash -> on-chain snapshot.

Acceptance:
- A Stacks address can be indexed into a normalized portfolio.
- At least two position sources are aggregated.
- Exact unit tests cover initial risk calculations.
- A deterministic report hash can be verified against a testnet snapshot.

## Milestone 2 — Risk product + user policies (Weeks 4–7)

Deliver:
- Lending/collateral integration.
- Collateral health and liquidation-distance analytics.
- BTC -10/-20/-30 stress scenarios and custom shock input.
- Risk dashboard and realtime updates.
- `risk-policy.clar` with Chainhook-driven alert evaluation.

Acceptance:
- A user can run a stress scenario and see deterministic before/after metrics.
- A user can set an on-chain risk policy.
- A threshold crossing triggers an application alert without moving user funds.

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
