# RiskRail

**Risk intelligence, portfolio observability and verifiable risk attestations for Bitcoin capital on Stacks.**

RiskRail is a non-custodial platform for understanding how capital is deployed across Stacks applications. It indexes wallet and protocol positions, converts them into a common portfolio model, calculates deterministic risk metrics, runs stress scenarios, evaluates alerts, and can anchor compact risk attestations on-chain through Clarity contracts.

The project is being built for users who need more than a balance screen. A wallet may hold sBTC directly while also having capital in a streaming contract, a lending market, a liquidity position or another protocol. RiskRail is designed to answer portfolio-level questions across those boundaries.

> RiskRail observes and explains risk. It does not hold user funds, execute trades, or make investment decisions for the user.

---

## Why RiskRail exists

As more Bitcoin-linked capital becomes usable on Stacks, a single address can have several different kinds of exposure at the same time. Each protocol naturally shows its own state, but the user owns the combined portfolio.

That creates questions that are difficult to answer from one protocol interface:

- Where is my sBTC actually deployed?
- How much capital is liquid now, and how much is locked or committed?
- Which protocol represents my largest concentration?
- How healthy are my collateralized positions?
- How far is a supported position from liquidation?
- What happens to the portfolio under a 10%, 20% or 30% BTC decline?
- Is the displayed value realistically exit-able without large price impact?
- Can another wallet, treasury tool or application consume the same risk data without rebuilding the entire indexing stack?

RiskRail is being built as the shared layer between protocol-specific state and those portfolio-level questions.

---

## What the product does

At a high level, RiskRail follows this flow:

```mermaid
flowchart LR
    A[Stacks address] --> B[Index native + protocol positions]
    B --> C[Normalize positions]
    C --> D[Build portfolio]
    D --> E[Calculate deterministic risk]
    E --> F[Run stress scenarios]
    F --> G[Dashboard / API / alerts]
    E --> H[Canonical risk report]
    H --> I[SHA-256 report hash]
    I --> J[Optional on-chain attestation]
```

The same normalized portfolio drives the web application, API, SDK, alerts and risk reports. That is intentional: there should not be one set of calculations for the dashboard and another hidden implementation for developers.

### Core capabilities

The grant/MVP work is centered on:

- Stacks wallet indexing;
- sBTC and SIP-010 position discovery;
- protocol adapters;
- normalized cross-protocol positions;
- portfolio aggregation;
- protocol and asset concentration;
- capital accessibility/locked-capital analysis;
- collateral health and liquidation metrics for supported protocols;
- liquidity analysis where reliable market data exists;
- BTC and custom stress scenarios;
- threshold alerts;
- realtime updates;
- developer API and TypeScript SDK;
- signed developer webhooks;
- on-chain risk attestations;
- user-owned on-chain risk policies;
- on-chain protocol registry metadata.

---

## Project principles

### Non-custodial

RiskRail does not need custody of user assets to analyze them. The normal product path never asks for a seed phrase or raw private key.

### Deterministic before intelligent

Risk calculations live in ordinary, testable code. An AI explanation layer may translate structured results into plain language later, but it does not invent or calculate the underlying risk metrics.

### Explain the number

Important risk values should be traceable to:

- source protocol;
- source block;
- observed position state;
- pricing source/time;
- methodology/engine version.

### Prefer missing data to false precision

If RiskRail cannot calculate a value reliably, the product should return `unavailable`, `stale` or a warning rather than a confident-looking guess.

### Protocols plug in; the risk engine stays protocol-agnostic

Protocol-specific logic belongs in adapters. Once a position is normalized, portfolio and risk code should not need special BitPay/lending/DEX branches spread throughout the application.

### Keep the first system operationally sane

RiskRail is enterprise-shaped without intentionally over-engineering the grant MVP. We use strong package boundaries, queues, observability, tests and containerized services, but we are not starting with Kafka, Kubernetes or a service mesh simply for appearance.

---

## Architecture

RiskRail is a TypeScript monorepo with five deployable application processes and shared domain packages.

```mermaid
flowchart TB
    subgraph Stacks[Stacks network]
        SA[Stacks API]
        SC[Protocol contracts]
        RC[RiskRail contracts]
    end

    subgraph Ingestion[Ingestion]
        CH[Chainhook]
        IX[Indexer]
        PA[Protocol adapters]
    end

    subgraph Domain[Domain]
        PN[Position normalization]
        PE[Portfolio engine]
        RE[Risk engine]
        SE[Stress engine]
    end

    subgraph Storage[Storage / async]
        PG[(PostgreSQL)]
        RD[(Redis)]
        BQ[BullMQ]
    end

    subgraph Delivery[Delivery]
        API[NestJS API]
        WK[Worker]
        RT[Socket.IO]
        WEB[Next.js web]
        SDK[TypeScript SDK]
    end

    SA --> IX
    SC --> CH
    CH --> IX
    IX --> PA
    PA --> PN
    PN --> PE
    PE --> RE
    RE --> SE
    PN --> PG
    PE --> PG
    RE --> PG
    IX --> BQ
    RD --> BQ
    BQ --> WK
    WK --> PG
    WK --> RC
    PG --> API
    API --> WEB
    API --> SDK
    WK --> RT
    RT --> WEB
```

### Separation of responsibilities

- **Indexer:** understands Stacks data, blocks, events and refreshes.
- **Protocol adapters:** understand individual protocol state.
- **Portfolio engine:** understands normalized positions and aggregation.
- **Risk engine:** understands deterministic risk calculations.
- **Worker:** owns retryable asynchronous side effects and calculations.
- **API:** understands HTTP clients, validation, auth and public contracts.
- **Realtime service:** delivers live update signals.
- **Clarity contracts:** provide verifiability, user-owned policies and composability.

The risk engine should not query the database. The adapter should not send email. The API should not contain the only implementation of a financial formula. Those boundaries are intentional.

---

## Repository layout

```text
riskrail/
├── apps/
│   ├── web/                    Next.js dashboard
│   ├── api/                    NestJS REST API
│   ├── indexer/                Stacks + Chainhook indexing process
│   ├── worker/                 BullMQ jobs and asynchronous processors
│   └── realtime/               Socket.IO gateway
│
├── packages/
│   ├── adapter-core/           ProtocolAdapter + NormalizedPosition contract
│   ├── adapter-native-stacks/  Native STX/SIP-010 wallet positions
│   ├── adapter-bitpay/         BitPay streaming positions
│   ├── portfolio-engine/       Protocol-independent portfolio aggregation
│   ├── risk-engine/            Deterministic risk and stress primitives
│   ├── stacks/                 Typed Stacks API/read helpers
│   ├── oracle/                 Price-source abstraction
│   ├── database/               Prisma schema/client
│   ├── events/                 Typed domain events
│   ├── queue/                  BullMQ/Redis helpers
│   ├── riskrail-contracts/     TypeScript client for RiskRail Clarity contracts
│   ├── sdk/                    Public TypeScript SDK
│   ├── shared-types/           Shared domain types
│   ├── validation/             Shared validation helpers
│   └── logger/                 Structured logging
│
├── contracts/                  Clarinet project + Clarity contracts/tests
├── chainhook/                  Chainhook predicates and notes
├── docs/                       Short architecture notes and ADRs
├── documentation/              Full product + engineering documentation
├── infrastructure/             Docker/Terraform infrastructure
├── scripts/                    Developer/operational scripts
└── .github/                    CI, security and contribution automation
```

For a full explanation of what belongs where, see [Repository structure](./documentation/06-repository-structure.md).

---

## Technology stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js 22+ |
| Language | TypeScript 5.9 |
| Monorepo | pnpm 10 + Turborepo |
| Web | Next.js 16, React 19, TanStack Query, Stacks Connect |
| API | NestJS 11, REST, OpenAPI/Swagger |
| Database | PostgreSQL 16, Prisma 6 |
| Queue/cache | Redis 7.4, BullMQ |
| Blockchain | Stacks API, Stacks.js, Chainhook |
| Contracts | Clarity, Clarinet SDK |
| Numeric math | `bigint`, decimal strings, Decimal.js |
| Realtime | Socket.IO |
| Tests | Vitest, Jest/Supertest, Clarinet SDK, Playwright-ready |
| CI/CD | GitHub Actions |
| Infrastructure | Docker Compose, Terraform scaffold |
| Observability | structured logging, OpenTelemetry/Sentry-ready |

Why these choices were made is documented in [Technology stack](./documentation/07-technology-stack.md) and [Architecture decisions](./documentation/30-decisions-and-tradeoffs.md).

---

## Protocol adapter model

Every protocol integration implements a shared interface.

```ts
export interface ProtocolAdapter {
  metadata(): ProtocolMetadata;
  supports(address: string, context: AdapterContext): Promise<boolean>;
  getPositions(
    address: string,
    context: AdapterContext,
  ): Promise<NormalizedPosition[]>;
}
```

A normalized position can represent wallet balances, streams, lending/borrowing positions, LP positions, staking positions or vault exposure without forcing the risk engine to know how the original protocol stores its data.

Current adapter work:

- native Stacks adapter: initial implementation present;
- BitPay stream adapter: normalization logic present, live reader wiring pending;
- external lending/collateral adapter: milestone work.

See [Protocol adapter design](./documentation/09-protocol-adapter-design.md).

---

## Risk engine

The deterministic risk engine is a pure package. It does not fetch HTTP data, call Prisma or sign Stacks transactions.

The initial code already includes:

- protocol concentration;
- capital accessibility;
- health-factor classification;
- generic price shocks;
- a basic portfolio risk summary.

Planned grant work expands this with:

- asset concentration;
- protocol-specific collateral health;
- liquidation distance/price;
- liquidity/exit analysis;
- richer stress scenarios;
- methodology/report versioning;
- optional transparent composite score.

### Numeric conventions

RiskRail avoids JavaScript floating-point values for token quantities and money where precision matters.

- atomic token values: strings / `bigint`;
- USD math: Decimal.js / PostgreSQL Decimal;
- percentages in contracts/events: basis points (`10,000 = 100%`);
- health factor: E4 fixed point (`14,700 = 1.4700`).

See [Risk engine methodology](./documentation/10-risk-engine-methodology.md).

---

## Stress testing

The first user-facing scenarios are:

```text
BTC -10%
BTC -20%
BTC -30%
```

Custom multi-asset shocks are part of the architecture as well.

A stress scenario is a what-if calculation. It does not predict market direction and it never executes a real transaction.

See [Stress testing](./documentation/11-stress-testing.md).

---

## Smart contracts

RiskRail keeps financial analysis off-chain and uses Clarity for the parts that benefit from public state and verification.

### `risk-provider-trait.clar`

Defines the minimal composable risk-provider interface.

### `risk-registry.clar`

Stores historical wallet risk snapshots containing compact metrics, source block and a SHA-256 report hash. Only authorized publishers can create snapshots.

### `risk-policy.clar`

Lets a wallet store its own small risk-threshold policy on-chain. The off-chain worker evaluates that policy and handles notifications.

### `protocol-registry.clar`

Records supported protocol contract principals, adapter versions and metadata hashes.

The contracts do **not** hold user funds.

```text
Full risk report
      │
      ▼
Canonical serialization
      │
      ▼
SHA-256
      │
      ├──────────────> full report stored off-chain
      │
      ▼
risk-registry.clar
(summary + source block + hash)
```

See [Smart contract design](./documentation/12-smart-contract-design.md) and [On-chain attestations](./documentation/13-onchain-attestations.md).

---

## Existing Stacks work we can leverage

RiskRail deliberately builds on lessons and reusable patterns from earlier Stacks projects instead of rewriting infrastructure for no reason.

### StacksPay patterns

Useful patterns include:

- Stacks API integration;
- Chainhook/event processing;
- API key architecture;
- outbound webhooks;
- SDK organization;
- Swagger/OpenAPI;
- security middleware.

### BitPay patterns

Useful pieces include:

- sBTC/Clarity reads;
- contract-event indexing;
- realtime update patterns;
- stream state;
- Clarity administration patterns.

BitPay can also be a real RiskRail adapter: a stream is a protocol position whose remaining sBTC may be partly accessible and partly locked/vesting.

We do **not** copy merchant checkout, payment-link, marketplace, custody or unrelated treasury execution logic into RiskRail.

See [Existing code reuse](./documentation/21-existing-code-reuse.md).

---

## Data model

The PostgreSQL/Prisma model is snapshot-oriented rather than current-state-only.

Key entities include:

- `User`;
- `Wallet`;
- `Protocol`;
- `Position`;
- `PositionAsset`;
- `PositionSnapshot`;
- `PortfolioSnapshot`;
- `RiskSnapshot`;
- `AlertRule`;
- `AlertEvent`;
- `ApiKey`;
- `WebhookEndpoint`;
- `WebhookDelivery`;
- `IndexedBlock`;
- `AuditLog`.

Historical snapshots matter because an old on-chain report hash needs to remain connected to the exact state that produced it.

See [Data model](./documentation/08-data-model.md).

---

## API and SDK direction

Public API resources are versioned under `/api/v1`.

Planned resource shape:

```text
GET  /api/v1/wallets/{address}
GET  /api/v1/portfolios/{address}
GET  /api/v1/portfolios/{address}/positions
GET  /api/v1/portfolios/{address}/risk
GET  /api/v1/protocols
POST /api/v1/simulations
GET  /api/v1/simulations/{id}
POST /api/v1/alerts
GET  /api/v1/alerts
POST /api/v1/webhooks
POST /api/v1/api-keys
```

The SDK should remain a thin typed client over these resources rather than reimplementing business logic.

Developer webhooks will be signed, retried and stored with delivery history.

See [API, SDK and webhooks](./documentation/15-api-sdk-and-webhooks.md).

---

## Realtime and alerts

Socket.IO is used to tell connected clients that portfolio/risk state changed. Alert rules are evaluated separately after new risk snapshots.

Initial alert examples:

```text
healthFactor < 1.30
protocolConcentrationBps > 5000
liquidityScoreBps < 4000
riskScoreBps > 7000
```

The alert system should be edge-triggered/cooldown-aware so a user is not notified on every block while the same condition remains true.

See [Realtime updates and alerts](./documentation/16-realtime-and-alerts.md).

---

## Current implementation status

This repository is an enterprise-shaped **foundation**, not a claim that every product feature is already shipped.

### Present now

- monorepo/application/package structure;
- Next.js, NestJS, indexer, worker and realtime application boundaries;
- PostgreSQL/Prisma schema with current positions, historical snapshots, indexing runs and risk reports;
- Redis/BullMQ job infrastructure;
- current Hiro v3 STX/FT balance reads with a compatibility fallback;
- SIP-010 token metadata resolution through Hiro's metadata API;
- native Stacks wallet adapter with STX lock/accessibility information;
- concrete BitPay contract reader for sender/recipient streams;
- BitPay stream normalization into RiskRail positions;
- BTC/STX/sBTC USD valuation through a price-oracle abstraction;
- normalized portfolio totals by protocol and asset;
- persistent wallet indexing and position snapshots;
- queue-backed `POST /api/v1/portfolios/:address/refresh` flow;
- database-backed portfolio and risk API responses;
- deterministic protocol/asset concentration, capital-accessibility and health-factor risk metrics;
- canonical SHA-256 risk reports persisted with methodology versioning;
- four Clarity contract components;
- testnet-capable `risk-registry.clar` attestation publisher worker;
- initial unit/contract tests and CI/security scaffolding;
- full long-form documentation set.

### Still being implemented

- external lending/collateral adapter;
- protocol-specific liquidation formulas;
- market-depth liquidity model (the current MVP score uses capital accessibility as a clearly-labelled proxy);
- complete multi-asset stress scenario engine;
- production dashboard screens;
- authentication/API keys;
- production webhooks/notifications and alert evaluation;
- Chainhook-driven incremental position updates and reorg handling;
- on-chain attestation confirmation tracking/snapshot-id reconciliation;
- public SDK methods;
- hosted beta and production observability.

See [Current implementation status](./documentation/29-current-status.md) for the detailed breakdown.

---

## Local development

### Prerequisites

- Node.js 22+
- Docker
- Clarinet for smart-contract development
- Git

### Install

```bash
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
```

### Configure

```bash
cp .env.example .env
```

Do not use real production secrets in the local `.env` file.

### Start PostgreSQL and Redis

```bash
pnpm infra:up
```

### Prisma

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### Run the workspace

```bash
pnpm dev
```

Default local endpoints:

| Service | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| Swagger | `http://localhost:4000/docs` |
| Realtime | `http://localhost:4001` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

### Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Contracts

```bash
cd contracts
pnpm install
pnpm test
clarinet check
```

See [Local development](./documentation/24-local-development.md) for troubleshooting and targeted commands.

---

## Environment variables

The root `.env.example` documents the current configuration surface.

Main groups:

```text
Core                 NODE_ENV, ports, URLs
Persistence          DATABASE_URL, REDIS_URL
Stacks               network, API URL/key, Chainhook auth
Contracts            deployed RiskRail contract principals
Publisher            enable flag + publisher secret
Auth                  JWT secret + API-key pepper
Notifications         SMTP configuration
Observability         Sentry / OTLP endpoints
```

The publisher private key must use a secret manager in production and should not live in the API process.

---

## Security model

The baseline security posture includes:

- non-custodial architecture;
- no seed/private-key collection from users;
- wallet challenge authentication for saved account actions;
- hashed developer API keys;
- signed webhooks;
- authenticated Chainhook ingress;
- input validation at boundaries;
- Helmet/CORS/rate limiting;
- idempotent blockchain event processing;
- isolated attestation publisher;
- structured audit logs;
- dependency/static analysis in CI;
- explicit stale/missing-data behavior.

See [Security model](./documentation/17-security-model.md).

---

## Testing

RiskRail uses different test layers for different failure modes:

- pure risk/portfolio unit tests;
- adapter fixture tests;
- Clarinet contract tests;
- PostgreSQL/Redis integration tests;
- NestJS/Supertest API tests;
- worker/idempotency/retry tests;
- Playwright end-to-end user flows;
- controlled Stacks testnet/mainnet smoke tests.

Financial formula boundaries, auth checks, event idempotency and report-hash reproducibility deserve more attention than a superficial coverage percentage.

See [Testing strategy](./documentation/18-testing-strategy.md).

---

## Observability

Production services should expose health/readiness and structured metrics. Important signals include:

```text
indexer_lag_blocks
wallet_refresh_duration_ms
adapter_failures_total
risk_calculation_duration_ms
queue_depth
queue_job_failures_total
alerts_triggered_total
webhook_delivery_failures_total
attestation_publish_failures_total
```

Data freshness is itself an operational metric. An API can be technically "up" while serving stale portfolio state, so source block and freshness need first-class monitoring.

See [Observability and operations](./documentation/19-observability-and-operations.md).

---

## Grant delivery plan

### Milestone 1 — Cross-protocol portfolio + contract foundation (Weeks 1–3)

Deliver native Stacks/sBTC indexing, BitPay adapter, normalized position/portfolio foundation, initial risk metrics, risk/protocol contracts, and a verifiable testnet report-hash attestation.

### Milestone 2 — Risk product + user policies (Weeks 4–7)

Deliver a lending/collateral integration, health/liquidation analytics, BTC stress scenarios, dashboard, alerting, realtime updates and `risk-policy.clar` integration.

### Milestone 3 — Public beta + developer infrastructure (Weeks 8–10)

Deliver hosted beta, versioned API, OpenAPI docs, SDK, API keys, signed webhooks, external developer testing and one integration proof of concept.

Full deliverables and acceptance criteria are in [Grant milestones](./documentation/22-grant-milestones.md).

---

## Documentation

The long-form documentation is intentionally comprehensive and written so a new contributor can understand the project without needing the original design conversation.

Start at [documentation/README.md](./documentation/README.md).

| Topic | Document |
| --- | --- |
| Product overview | [01-product-overview.md](./documentation/01-product-overview.md) |
| Full PRD | [02-product-requirements.md](./documentation/02-product-requirements.md) |
| Users/use cases | [03-users-and-use-cases.md](./documentation/03-users-and-use-cases.md) |
| Scope/non-goals | [04-scope-and-non-goals.md](./documentation/04-scope-and-non-goals.md) |
| System architecture | [05-system-architecture.md](./documentation/05-system-architecture.md) |
| Repository layout | [06-repository-structure.md](./documentation/06-repository-structure.md) |
| Technology choices | [07-technology-stack.md](./documentation/07-technology-stack.md) |
| Data model | [08-data-model.md](./documentation/08-data-model.md) |
| Protocol adapters | [09-protocol-adapter-design.md](./documentation/09-protocol-adapter-design.md) |
| Risk methodology | [10-risk-engine-methodology.md](./documentation/10-risk-engine-methodology.md) |
| Stress testing | [11-stress-testing.md](./documentation/11-stress-testing.md) |
| Smart contracts | [12-smart-contract-design.md](./documentation/12-smart-contract-design.md) |
| Attestations | [13-onchain-attestations.md](./documentation/13-onchain-attestations.md) |
| Chainhook/indexing | [14-chainhook-and-indexing.md](./documentation/14-chainhook-and-indexing.md) |
| API/SDK/webhooks | [15-api-sdk-and-webhooks.md](./documentation/15-api-sdk-and-webhooks.md) |
| Realtime/alerts | [16-realtime-and-alerts.md](./documentation/16-realtime-and-alerts.md) |
| Security | [17-security-model.md](./documentation/17-security-model.md) |
| Testing | [18-testing-strategy.md](./documentation/18-testing-strategy.md) |
| Operations | [19-observability-and-operations.md](./documentation/19-observability-and-operations.md) |
| Deployment | [20-deployment-and-infrastructure.md](./documentation/20-deployment-and-infrastructure.md) |
| Existing-code reuse | [21-existing-code-reuse.md](./documentation/21-existing-code-reuse.md) |
| Grant milestones | [22-grant-milestones.md](./documentation/22-grant-milestones.md) |
| Roadmap | [23-roadmap.md](./documentation/23-roadmap.md) |
| Local setup | [24-local-development.md](./documentation/24-local-development.md) |
| Engineering workflow | [25-engineering-workflow.md](./documentation/25-engineering-workflow.md) |
| Project risks | [26-risks-and-mitigations.md](./documentation/26-risks-and-mitigations.md) |
| Demo/acceptance plan | [27-demo-and-acceptance-plan.md](./documentation/27-demo-and-acceptance-plan.md) |
| Glossary | [28-glossary.md](./documentation/28-glossary.md) |
| Current status | [29-current-status.md](./documentation/29-current-status.md) |
| Milestone 1 implementation | [31-milestone-1-implementation.md](./documentation/31-milestone-1-implementation.md) |
| Decisions/trade-offs | [30-decisions-and-tradeoffs.md](./documentation/30-decisions-and-tradeoffs.md) |

The shorter `docs/` directory remains available for concise architecture notes and ADRs.

---

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and [Engineering workflow](./documentation/25-engineering-workflow.md).

A normal change should pass:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Contract changes also need:

```bash
cd contracts
pnpm test
clarinet check
```

Protocol adapter changes should include fixtures and document how values are derived from protocol state.

---

## Security

Please read [SECURITY.md](./SECURITY.md) and the full [Security model](./documentation/17-security-model.md).

Do not open a public issue containing credentials, exploitable private details or a live publisher secret.

---

## License

See [LICENSE](./LICENSE).

---

## Project status

RiskRail is under active development. The repository currently provides the architecture, contract foundation and first domain primitives needed for the grant milestones. Public beta/mainnet readiness should be judged by the explicit status and acceptance criteria in the documentation rather than by the presence of folders alone.
