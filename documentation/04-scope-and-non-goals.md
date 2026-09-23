# Scope and Non-Goals

Good scope protects this project from becoming five products at once.

## In scope for the first grant release

### Portfolio indexing

- validate Stacks principals;
- read native balances;
- discover selected protocol positions;
- retain source block and observation metadata;
- re-index affected wallets when relevant events occur.

### Normalization

- standard `ProtocolAdapter` interface;
- shared normalized position types;
- mapping for native Stacks positions;
- BitPay stream positions;
- at least one lending/collateral integration.

### Risk calculations

- protocol concentration;
- asset concentration where valuation exists;
- capital accessibility;
- health factor mapping/calculation for supported lending positions;
- liquidation distance/price where the protocol model supports it;
- basic liquidity metrics where reliable source data exists;
- deterministic risk classification.

### Stress testing

- BTC -10%, -20%, -30%;
- custom asset shocks;
- before/after portfolio and position risk metrics.

### Alerts

- off-chain threshold rules;
- email and in-app/realtime delivery;
- developer webhooks;
- user-owned on-chain policy for the small subset of metrics represented by `risk-policy.clar`.

### Developer infrastructure

- versioned REST API;
- OpenAPI documentation;
- TypeScript SDK;
- API keys;
- signed webhooks;
- clear freshness metadata.

### Clarity contracts

- risk provider trait;
- risk registry;
- risk policy;
- protocol registry;
- Clarinet tests;
- testnet deployment and verification flow.

## Not in scope for the MVP

### Custody

Rivisk does not receive deposits and does not hold user funds.

### Automated position management

The MVP does not automatically repay debt, move collateral, rebalance a treasury or exit a liquidity position.

This is important both for security and product clarity. Monitoring infrastructure should earn trust before it gains transaction authority.

### Trading recommendations

Rivisk describes risk conditions and scenarios. It does not issue buy/sell recommendations.

### Predictive price models

The first version is scenario-based, not a forecasting product. A -20% BTC stress test means "show me the portfolio if this input changes by -20%," not "Rivisk predicts BTC will fall 20%."

### One universal risk score as the whole product

A composite score may be useful as a summary, but the underlying metrics remain visible. We do not want a 72/100 badge that cannot be explained.

### Every Stacks protocol

The adapter architecture is built for growth, but the first release should integrate a small number of meaningful protocols well rather than many protocols poorly.

### Full risk calculation inside Clarity

Cross-protocol risk needs data and computation that are better handled off-chain. The contracts store compact attestations, user policies and protocol references; they do not try to reproduce the entire engine on-chain.

### Kafka and Kubernetes on day one

The event model is designed so the platform can move to heavier infrastructure later. Redis/BullMQ and containerized services are enough for the grant stage.

### AI deciding risk

The planned explanation layer ([Milestone 2](./22-grant-milestones.md)) receives structured deterministic results and turns them into plain language. It does not set health factors, invent liquidity values or decide whether a user is at risk. Model calls happen only when a user asks for an explanation, are cached by report hash, and are never part of indexing, scoring or attestation — so the core product works, and costs nothing extra, with the explainer disabled.

## Later possibilities, not promises

The architecture can support future work such as:

- multi-wallet treasury workspaces;
- team permissions and approval workflows;
- richer historical analytics;
- Telegram/Discord/push alerts;
- advanced exit-liquidity modelling;
- market-wide Stacks risk dashboards;
- institutional reporting;
- signed risk feeds or additional attestation publishers;
- quantitative models in a separate Python service if justified by actual use cases;
- optional transaction simulation before a user signs a supported protocol action.

These are directions, not commitments in the current milestone plan.
