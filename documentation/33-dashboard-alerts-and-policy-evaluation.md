# Dashboard, realtime alerts and on-chain policy evaluation

This pass turns RiskRail from a backend-heavy proof of architecture into something that can actually be used and demonstrated from the browser. The important point is that the interface is not a separate mock. It is wired to the same portfolio, risk and simulation endpoints that the worker and indexer already use.

## What changed

The web application now has two clear modes.

The home page explains the product and lets somebody either connect a Stacks wallet or paste any public Stacks address. The dashboard then works with that address without asking for custody or a signature just to read public positions.

The dashboard shows:

- latest indexed portfolio value and valuation coverage;
- current risk level and the underlying metrics rather than only a single score;
- protocol and asset exposure;
- normalized positions from the wallet and enabled adapters;
- deterministic stress scenarios and custom price shocks;
- address-scoped in-app alert rules;
- the wallet's policy from `risk-policy.clar` when the contract is configured;
- report hash and on-chain attestation state when available.

The interface deliberately does not tell somebody to buy, sell or rebalance. It shows what RiskRail can observe and what happens under a requested scenario.

## Wallet connection is convenience, not custody

The wallet button uses the same modern `@stacks/connect` connection style already used in earlier Stacks work. Connecting the wallet gives RiskRail the public Stacks address to inspect. It does not give the application a seed phrase or private key.

A public address can also be entered manually. This matters because the core risk product should remain useful to treasuries, analysts and developers who are monitoring an address they do not control.

## The realtime path

The original Socket.IO process existed, but it did not have a real event source. That is now wired through Redis pub/sub.

The path is:

```text
Indexer / risk worker / alert worker
             |
             v
      Redis pub/sub channel
        riskrail.realtime
             |
             v
       realtime service
             |
             v
 portfolio:{address} room
             |
             v
     connected dashboard
```

The dashboard subscribes only to the address it is currently displaying. When the indexer publishes `portfolio.updated`, React Query invalidates the portfolio query. When the risk worker publishes `risk.updated`, the risk query is refreshed. Alert and policy events refresh the alert history.

This keeps Socket.IO as a delivery layer rather than a source of truth. PostgreSQL remains the source of truth for persisted portfolio, risk and alert data.

## Local alert rules

The API now exposes a small address-scoped alert surface for the beta:

```text
GET   /api/v1/alerts/{address}
POST  /api/v1/alerts/{address}
PATCH /api/v1/alerts/{alertId}
```

The first supported metrics are:

- risk score;
- health factor;
- liquidation distance;
- protocol concentration;
- asset concentration;
- liquidity score;
- capital accessibility.

The worker evaluates these rules only after a new risk snapshot exists. An alert is edge-triggered: it fires when a metric moves from the safe side of a rule to the breached side. It does not create a new notification for every subsequent snapshot while the same condition remains breached.

For the current public beta, only the `in_app` channel is accepted. This is intentional. Email and webhooks should be tied to authenticated accounts rather than allowing an unauthenticated address lookup page to send messages to arbitrary destinations.

## On-chain policy evaluation

The existing `risk-policy.clar` contract stores four wallet-owned guardrails:

- maximum RiskRail score;
- minimum health factor;
- maximum protocol concentration;
- minimum liquidity score.

The TypeScript contract package now includes a read-only `RiskPolicyReader`. Both the API and worker use the same reader instead of each reimplementing Clarity decoding.

When `RISK_POLICY_CONTRACT` is configured, the API can return the current wallet policy:

```text
GET /api/v1/policies/{address}
```

After a new risk snapshot is created, the alert worker also reads the policy and compares the new metrics against it. A breach is persisted as a `PolicyBreachEvent` and broadcast through the realtime channel.

The policy evaluator uses the same edge-trigger rule as local alerts. For example, if a wallet's minimum health factor is `1.30`, a move from `1.42` to `1.27` creates a breach event. A later snapshot at `1.25` does not create another breach until the position first recovers above the threshold and then crosses it again.

This is a useful separation of responsibilities:

```text
risk-policy.clar
    stores user-owned limits

risk engine
    calculates deterministic metrics

alert worker
    compares metrics with limits

realtime service
    delivers the event to the dashboard
```

The Clarity contract does not try to send email or push notifications.

## Why the policy UI is read-only in this pass

The dashboard displays the configured on-chain policy, but it does not yet submit `set-risk-policy` transactions from the browser.

That is deliberate. Reading the policy and proving that the worker evaluates it correctly is the important backend milestone. Contract-write UX should be added after the testnet contract deployment is fixed in configuration and the transaction flow is tested with supported wallets. It is better to have a truthful read/evaluate path than a button that looks complete but has not been validated across wallet providers.

## Database change

A `PolicyBreachEvent` model was added. It records:

- wallet;
- source;
- metric;
- operator;
- threshold;
- observed value;
- source block;
- policy metadata;
- trigger time.

A Prisma migration still needs to be generated in a dependency-installed clone if migrations have not already been committed.

## Methodology version

The risk report methodology version is now `riskrail-v1.2` because the report lifecycle now has a defined downstream policy/alert evaluation step. The risk formulas themselves did not suddenly become predictive; this version mainly records the product-level behavior around how new snapshots are consumed.

## What is still intentionally unfinished

This pass does not claim the alert system is production-complete. The following work remains:

- authenticated users and wallet-signature login;
- email and signed webhook delivery;
- notification preferences and cooldown windows beyond edge-triggering;
- browser transaction flow for writing `risk-policy.clar`;
- policy transaction confirmation tracking;
- Chainhook-driven incremental protocol updates rather than explicit full refresh only;
- market-depth liquidity analysis;
- full hosted beta observability.

The product now has a usable frontend and a real alert/policy event loop. The next useful work should be validation and hardening rather than adding another large protocol integration immediately.
