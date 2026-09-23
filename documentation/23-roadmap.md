# Product Roadmap

The roadmap separates what the beta already delivers from what the grant would fund. Amounts and acceptance criteria live in [22-grant-milestones.md](./22-grant-milestones.md).

## Delivered — the beta (self-funded, as of 23 September 2026)

Everything below runs in public today and is **not** grant scope. Evidence per
capability is in [29-current-status.md](./29-current-status.md).

- monorepo, app boundaries, Prisma schema, Redis/BullMQ, CI;
- native Stacks/sBTC indexing, portfolio persistence and valuation;
- Zest V2 lending adapter, validated against a real mainnet obligation;
- risk engine, stress engine, canonical reports and report hashing;
- five Clarity contracts deployed to testnet, with live attestations, the
  external-consumer path proven, and Chainhook confirming snapshot ids;
- REST API, wallet-signature auth, API keys, signed webhooks, realtime updates;
- dashboard, documentation site and `@rivisk/sdk` on npm;
- hosted beta: web app on Vercel, backend on AWS (currently on temporary credits).

## Grant Milestone 1 — Beta hardening and infrastructure review

- architecture review of the single-server beta;
- sustainable paid hosting to replace the expiring credits;
- persistent database with tested backups **and restores**;
- monitoring, alerting and an exercised recovery procedure;
- attestation-path reliability: retries, nonce handling, publisher key in a
  secret manager, low-balance alerting;
- threat model, dependency and secret scanning, and the independent contract
  review commissioned.

## Grant Milestone 2 — Advanced risk intelligence and AI explanations

- market-depth and exit-risk modelling to replace the accessibility proxy;
- the **optional AI explanation layer**: it turns a completed deterministic risk
  report into plain language, and never calculates risk, changes a score or
  contributes anything to an attestation;
- explanations exposed through the API and SDK, cached by report hash, with the
  product fully functional when the explainer is disabled.

## Grant Milestone 3 — Ecosystem integration and production readiness

- one real external Stacks project integrating against the API, SDK or trait;
- the independent contract review delivered, findings fixed, and any revised
  contract redeployed and revalidated **on testnet** first;
- **mainnet deployment of the reviewed contracts** if no blocking finding remains;
- published API terms, versioning, usage metrics and a status page.

Amounts, targets and acceptance criteria: [22-grant-milestones.md](./22-grant-milestones.md).

## After the grant — broader protocol coverage

After the grant, add integrations based on actual user capital and demand rather than integration count.

Potential categories:

- DEX/liquidity;
- additional lending markets;
- yield/vault protocols;
- treasury contracts;
- staking products;
- additional payment/streaming contracts.

## Later — treasury workspace

- multi-address portfolios;
- organization/team roles;
- treasury policies;
- scheduled reports;
- export/API support;
- stronger historical analysis.

## Later — market-wide risk intelligence

If enough wallets/protocols are indexed and privacy considerations are handled well, Rivisk can publish aggregate ecosystem health metrics.

Examples:

- total monitored sBTC deployed;
- aggregate protocol concentration;
- collateral health distribution;
- liquidity depth trends;
- amount of capital immediately accessible vs committed;
- historical stress sensitivity.

This should be built from aggregated data, not by exposing individual user behavior unnecessarily.

## Later — advanced quantitative models

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
