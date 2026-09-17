# Product Roadmap

The roadmap is written in phases so the team can keep the current milestone focused without losing the longer product direction.

## Phase 0 — Repository and engineering foundation

Status: started.

- monorepo structure;
- deployable app boundaries;
- Prisma schema;
- Redis/BullMQ structure;
- adapter interfaces;
- initial native/BitPay adapter code;
- initial risk functions;
- Clarity contracts;
- CI/security scaffolding;
- long-form documentation.

Exit condition: repository installs/builds/tests cleanly and the baseline architecture is stable enough for feature work.

## Phase 1 — Grant Milestone 1

- native Stacks/sBTC indexing;
- live BitPay adapter;
- portfolio persistence;
- valuation source integration;
- report schema/canonicalization;
- risk registry testnet publication;
- initial API responses backed by the database rather than placeholders.

## Phase 2 — Grant Milestone 2

- lending/collateral adapter;
- liquidation/health methodology;
- stress engine;
- dashboard;
- alerts;
- on-chain user policy;
- realtime updates.

## Phase 3 — Grant Milestone 3

- public beta;
- API keys;
- SDK;
- OpenAPI documentation;
- signed webhooks;
- external developer testing;
- integration proof of concept;
- beta metrics and feedback.

## Phase 4 — Broader protocol coverage

After the grant, add integrations based on actual user capital and demand rather than integration count.

Potential categories:

- DEX/liquidity;
- additional lending markets;
- yield/vault protocols;
- treasury contracts;
- staking products;
- additional payment/streaming contracts.

## Phase 5 — Treasury workspace

- multi-address portfolios;
- organization/team roles;
- treasury policies;
- scheduled reports;
- export/API support;
- stronger historical analysis.

## Phase 6 — Market-wide risk intelligence

If enough wallets/protocols are indexed and privacy considerations are handled well, RiskRail can publish aggregate ecosystem health metrics.

Examples:

- total monitored sBTC deployed;
- aggregate protocol concentration;
- collateral health distribution;
- liquidity depth trends;
- amount of capital immediately accessible vs committed;
- historical stress sensitivity.

This should be built from aggregated data, not by exposing individual user behavior unnecessarily.

## Phase 7 — Advanced quantitative models

Only after the deterministic foundation is trusted:

- historical volatility scenarios;
- Monte Carlo simulation;
- VaR-like measures where appropriate;
- correlation-aware stress tests;
- liquidity/market impact models;
- separate Python quantitative service if justified.

The deterministic engine remains available even if these models are added.

## Things deliberately not scheduled

The roadmap does not promise automated trading, custody or autonomous deleveraging. Those features would materially change the security and regulatory profile of the product and should be treated as separate product decisions, not natural extensions of a dashboard.
