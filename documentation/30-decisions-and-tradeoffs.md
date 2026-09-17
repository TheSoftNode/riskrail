# Architecture Decisions and Trade-offs

This is a human-readable summary of the decisions behind the current shape of RiskRail. Formal ADRs live under `docs/adr/` when a decision needs a durable record.

## TypeScript first

### Decision

Use TypeScript for web, API, indexer, worker, adapters, SDK and the deterministic risk engine.

### Why

Most of the work is orchestration, typed protocol data and deterministic arithmetic rather than scientific computing. One language lets the project share types and move faster.

### Trade-off

Python has a stronger ecosystem for advanced quantitative analysis. If that need appears later, add a dedicated quant service rather than forcing Python into the first milestone.

## Modular monorepo before microservices

### Decision

Keep domain logic in packages and only five deployable application processes.

### Why

We get clear boundaries without network calls between every feature.

### Trade-off

A very large team might eventually want independently versioned services. The package boundaries make that split possible later.

## PostgreSQL over MongoDB

### Decision

Use PostgreSQL as the main durable store.

### Why

RiskRail has strong relationships, historical snapshots and a need for reliable querying/transactions.

### Trade-off

Raw protocol payloads are irregular. Those can live in JSON columns/object storage while the important domain fields remain relational.

## Redis/BullMQ before Kafka

### Decision

Use Redis-backed queues for grant-stage asynchronous work.

### Why

The workload needs retries, concurrency and delayed jobs but not yet a large distributed event platform.

### Trade-off

If many independent consumers and high event throughput arrive later, Kafka or another broker may become justified.

## Off-chain calculations, on-chain attestations

### Decision

Run portfolio/risk computation off-chain and commit small verified outputs/hashes through Clarity.

### Why

Cross-protocol data, market data and scenario math do not belong inside a smart contract. The chain is valuable for integrity and composability, not for doing every calculation.

### Trade-off

Consumers still trust the RiskRail methodology/publisher. The report hash proves integrity, not universal correctness.

## No custody in the MVP

### Decision

RiskRail observes and alerts; it does not move user funds.

### Why

This keeps the product focused and drastically reduces attack surface.

### Trade-off

RiskRail cannot automatically protect a position by repaying debt or moving collateral. That can be considered later as a separate security/product decision.

## REST before GraphQL

### Decision

Versioned REST API with OpenAPI.

### Why

Resources are straightforward, documentation/tooling is strong, and external integrations can start quickly.

### Trade-off

A complex analytics UI may later want flexible query shapes. That is not enough reason to start with two public API paradigms.

## Snapshot history instead of overwriting state

### Decision

Persist historical position, portfolio and risk snapshots.

### Why

Risk reporting needs auditability and trends. On-chain attestations need an off-chain report state that can be recovered later.

### Trade-off

Storage grows faster. Retention/rollups can be added once usage is measured.

## Adapter-specific exactness

### Decision

Carry source/exactness metadata and allow fields to be unavailable.

### Why

A financial risk tool should not hide uncertainty.

### Trade-off

The UI is harder to design because not every portfolio has every metric. That is a better problem than showing fabricated precision.

## Smart contract registry + database registry

### Decision

Keep operational protocol metadata in PostgreSQL while optionally anchoring canonical protocol/adapter metadata on-chain.

### Why

The application needs fast, rich configuration; the chain adds transparency for public integrations.

### Trade-off

Two representations require synchronization. Chainhook and explicit versioning are used to keep them aligned.
