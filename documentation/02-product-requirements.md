# Product Requirements Document

## Document purpose

This is the working PRD for the first production-shaped version of Rivisk. It is intentionally more detailed than the grant application will be. The grant form should contain a focused version of these requirements; the repository should contain the full thinking so implementation decisions remain consistent after the application is submitted.

## Product statement

Rivisk gives Stacks users, treasuries and applications a unified view of financial exposure across supported protocols. It discovers positions from a Stacks address, normalizes them into a common model, calculates explainable risk metrics, runs market stress scenarios, supports configurable alerts, and optionally publishes verifiable risk attestations on-chain.

## Objectives

The MVP has six practical objectives:

1. discover native and protocol positions for a Stacks address;
2. normalize those positions so the rest of the system is protocol-agnostic;
3. calculate deterministic portfolio and position risk;
4. let a user explore adverse market scenarios without executing a transaction;
5. notify a user or integration when a configured threshold is crossed;
6. make the resulting data useful outside the Rivisk web application through an API, SDK, webhooks and Clarity read-only functions.

## Functional requirements

### FR-01 — Public address analysis

A user must be able to submit a valid Stacks principal for analysis without giving Rivisk a private key or seed phrase.

For public read-only analysis, a wallet connection is optional. A connected wallet becomes useful when the user wants to save preferences, sign an on-chain risk policy, or associate multiple monitored addresses with an account.

### FR-02 — Native balance discovery

Rivisk must retrieve the address's STX balance and fungible token balances from a supported Stacks data source. The native adapter must preserve atomic values rather than converting everything to JavaScript floating-point numbers.

Token metadata resolution is required before a non-known token can be valued reliably. Unknown decimals must not be silently guessed.

### FR-03 — Protocol position discovery

For every supported protocol, an adapter must be able to answer whether the address has relevant exposure and return normalized positions.

Initial sources are:

- native wallet positions;
- BitPay stream positions;
- at least one external Stacks lending/collateral protocol during the grant period.

### FR-04 — Position normalization

Every adapter must return the shared `NormalizedPosition` structure. The structure needs enough information to represent:

- ownership;
- protocol identity;
- position type;
- assets and their role in the position;
- USD value where known;
- collateral and debt values where applicable;
- liquidation data where applicable;
- liquidity/exit information where applicable;
- accessibility or lock information;
- the source block and observation time;
- whether the source value is exact or estimated;
- protocol-specific metadata that should not leak into the risk engine's core interface.

### FR-05 — Portfolio aggregation

Rivisk must aggregate normalized positions into one portfolio view for an address.

At minimum, the portfolio must expose:

- total known USD value;
- value by protocol;
- value by asset when valuation is available;
- immediately accessible versus locked/committed capital;
- list of underlying positions;
- timestamp and block context.

### FR-06 — Protocol concentration

The engine must calculate the share of known portfolio value exposed to each supported protocol and identify the largest exposure.

Concentration should be stored and transported as basis points where an integer representation is needed. A value of `4400` means 44.00%.

### FR-07 — Asset concentration

The engine should calculate exposure by asset when reliable valuation data exists. It should be possible to answer questions such as "what share of this portfolio is economically exposed to sBTC?"

### FR-08 — Capital accessibility

Rivisk must distinguish between capital that is visible in the portfolio and capital that is currently available to move.

For example, a BitPay stream can contain value that belongs to the user economically but has not fully vested. The normalized model already includes an `accessibility.liquidBps` field for this purpose.

### FR-09 — Collateral health

For protocols that expose enough information, Rivisk must calculate or faithfully map:

- collateral value;
- debt value;
- health factor;
- liquidation threshold;
- estimated liquidation price or liquidation distance where the protocol rules allow it.

The implementation must use protocol-specific rules rather than applying one generic liquidation formula to every lending market.

### FR-10 — Liquidation classification

The initial engine may classify a supported health factor using transparent thresholds, but the UI must make clear that these categories are Rivisk presentation labels rather than protocol guarantees.

The scaffold currently uses the following starting categories:

- below 1.20: critical;
- 1.20 to below 1.50: elevated;
- 1.50 to below 2.00: moderate;
- 2.00 and above: healthy;
- unavailable health factor: unknown.

These values are configurable methodology, not universal financial truths.

### FR-11 — Stress testing

Users must be able to run predefined BTC price shocks of -10%, -20% and -30% against supported positions.

The architecture must also support custom shocks and multiple asset shocks. A scenario never changes real on-chain state; it creates a simulated portfolio and risk result.

### FR-12 — Liquidity analysis

When sufficient pool and market data exists, Rivisk should estimate:

- available market depth;
- position size relative to market liquidity;
- expected price impact or slippage for an exit;
- a normalized liquidity score.

The system should return `unavailable` when the required data is not trustworthy enough.

### FR-13 — User alerts

A user must be able to configure threshold-based alerts for supported metrics. Initial useful rules include:

- health factor below a chosen value;
- risk score above a chosen value;
- protocol concentration above a chosen percentage;
- liquidity score below a chosen value;
- material change in capital accessibility.

### FR-14 — On-chain risk policy

A user should be able to store a small set of personal thresholds in `risk-policy.clar` using their own wallet. The policy belongs to the wallet and can be enabled or disabled by that wallet.

The contract does not send notifications. Rivisk's off-chain workers read/evaluate the policy and deliver email, realtime or webhook alerts.

### FR-15 — Risk report creation

The engine must be able to produce a canonical report containing the inputs and outputs needed to reproduce or audit a risk snapshot.

The report should include at least:

- wallet address;
- report/schema version;
- engine version;
- source block;
- observation time;
- normalized positions or position references;
- price observations and sources;
- calculated metrics;
- scenario results;
- any warnings about estimated or unavailable fields.

### FR-16 — On-chain attestation

When publishing is enabled, Rivisk should hash the canonical report and submit a compact snapshot to `risk-registry.clar`.

The contract stores important summary metrics, source block, report hash and publication block. The full report stays off-chain.

### FR-17 — Protocol registry

Supported protocol contracts and adapter versions can be represented by `protocol-registry.clar`. The registry provides a public reference for which contract principal and adapter version Rivisk recognizes for an integration.

### FR-18 — Versioned REST API

Rivisk must expose a stable `/api/v1` API. Initial resources should include:

- wallets;
- portfolios;
- positions;
- risk;
- simulations;
- alerts;
- protocols;
- webhooks;
- developer API keys.

### FR-19 — TypeScript SDK

The SDK should wrap the public API with typed methods. It should not contain a second copy of business logic that can drift away from the server.

### FR-20 — Developer webhooks

External applications should be able to register signed webhook endpoints for events such as:

- `portfolio.updated`;
- `risk.updated`;
- `risk.threshold_crossed`;
- `position.updated`;
- `attestation.published`.

Delivery attempts need retries, signatures, timestamps and an audit trail.

### FR-21 — Realtime user updates

The web application should receive relevant portfolio and risk updates over Socket.IO rather than requiring aggressive polling.

### FR-22 — Historical snapshots

Rivisk should retain portfolio, position and risk snapshots so a user can see how exposure changed over time and so published attestations can be connected back to the underlying report state.

## Non-functional requirements

### Reliability

The beta should target at least 99% availability for the public API and dashboard, excluding planned maintenance. The architecture should recover cleanly from Redis or upstream API interruptions without corrupting portfolio history.

### Performance

Cached portfolio/risk reads should normally respond within roughly three seconds and preferably much faster. Indexing is allowed to be asynchronous as long as the API clearly exposes freshness.

### Determinism

Risk calculations must avoid binary floating-point arithmetic for monetary values. The repository uses `Decimal.js` for decimal math and strings/bigints for atomic token quantities.

### Security

Rivisk must never request, log or store seed phrases or raw private keys from end users. A service publisher key, if used for attestations, must be isolated from the general API process and stored in a proper secret manager in production.

### Explainability

A risk classification should be traceable to the metrics and thresholds that produced it. The system should not return an opaque score with no methodology.

### Observability

Every deployable service needs structured logs and health endpoints. Production should expose useful metrics around indexer lag, queue depth, risk calculation time, webhook failures and upstream provider errors.

### Extensibility

Adding a new protocol should mainly involve writing a new adapter and tests rather than editing every application.

## Product constraints

The grant MVP is deliberately constrained:

- no automated trading;
- no automatic deleveraging;
- no custody;
- no attempt to support every Stacks protocol immediately;
- no requirement to publish every small risk change on-chain;
- no large language model in the calculation path;
- no heavy infrastructure such as Kafka or Kubernetes unless the system actually reaches the scale that requires it.

## Success metrics for the first public beta

The initial targets are deliberately modest and measurable:

- 2–3 useful protocol/position sources;
- at least 100 wallet analyses during the beta period;
- at least 25 recurring monitored wallets;
- at least 50 stress-test runs;
- at least 10 configured alerts;
- at least 3 external developers trying the API or SDK;
- one external wallet/protocol/application integration proof of concept;
- deterministic calculation tests covering the supported risk formulas;
- a publicly verifiable testnet risk attestation flow.
