# System Architecture

## The architecture in one sentence

RiskRail is a modular TypeScript monorepo where indexing, protocol interpretation, portfolio aggregation, risk calculation, delivery and on-chain attestation are separate responsibilities connected by typed domain contracts and asynchronous events.

## High-level view

```mermaid
flowchart TB
    subgraph Chain[Stacks network]
        S1[Stacks API]
        S2[Protocol contracts]
        S3[RiskRail Clarity contracts]
    end

    subgraph Ingest[Ingestion]
        I1[Chainhook]
        I2[Indexer]
        I3[Protocol adapters]
    end

    subgraph Domain[Domain layer]
        D1[Position normalizer]
        D2[Portfolio engine]
        D3[Risk engine]
        D4[Stress engine]
    end

    subgraph Data[Persistence and queues]
        P1[(PostgreSQL)]
        P2[(Redis)]
        P3[BullMQ]
    end

    subgraph Delivery[Delivery]
        A1[NestJS API]
        A2[Worker]
        A3[Socket.IO]
        A4[Webhooks / email]
        A5[Next.js web]
        A6[TypeScript SDK]
    end

    S1 --> I2
    S2 --> I1
    I1 --> I2
    I2 --> I3
    I3 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> D4
    D1 --> P1
    D2 --> P1
    D3 --> P1
    I2 --> P3
    P3 --> A2
    A2 --> D3
    A2 --> A4
    A2 --> S3
    P1 --> A1
    A1 --> A5
    A1 --> A6
    A2 --> A3
    A3 --> A5
    P2 --> P3
```

## Why the boundaries are arranged this way

The easiest way for a blockchain analytics project to become hard to maintain is to let chain calls, protocol parsing, business rules and API formatting leak into the same files.

RiskRail avoids that by using a few firm boundaries.

### The indexer understands the chain, not risk

The indexer knows how to fetch blocks, balances, transactions and contract events. It knows when something changed and which wallet or protocol needs to be refreshed.

It should not decide whether 44% protocol concentration is "high." That belongs to the risk layer.

### Adapters understand protocols, not the application

An adapter knows how BitPay represents a stream or how a lending protocol represents collateral. It converts that protocol-native representation into `NormalizedPosition`.

The adapter should not send email, create API responses or render UI labels.

### The portfolio engine understands positions, not protocols

Once a position is normalized, the portfolio engine should not need a BitPay-specific branch. It aggregates values and exposures from a shared model.

### The risk engine is a pure calculation library

The risk engine accepts explicit inputs and returns explicit outputs. It does not query Prisma, call Hiro, send transactions or read environment variables.

That purity matters because risk logic needs exact unit tests and should be reusable from the API, worker and simulation code.

### The API is a delivery boundary

The API validates requests, applies auth/rate limits, loads domain data and returns versioned responses. It should not become the only place where business logic exists.

### Workers own asynchronous side effects

Publishing an attestation, delivering a webhook, evaluating thousands of alert rules or retrying a failed upstream operation are worker jobs rather than long-running HTTP requests.

## Main data path

A normal wallet refresh looks like this:

```mermaid
sequenceDiagram
    participant U as User/API client
    participant API as RiskRail API
    participant Q as Queue
    participant IDX as Indexer
    participant AD as Adapters
    participant DB as PostgreSQL
    participant RE as Risk Engine

    U->>API: Request portfolio for SP...
    API->>DB: Read latest portfolio + freshness
    alt fresh enough
        DB-->>API: Cached portfolio/risk
        API-->>U: Response
    else stale or missing
        API->>Q: Enqueue wallet refresh
        API-->>U: Current state + refresh status
        Q->>IDX: Process refresh
        IDX->>AD: Discover protocol positions
        AD-->>IDX: Normalized positions
        IDX->>DB: Upsert positions + snapshots
        IDX->>Q: Enqueue risk recalculation
        Q->>RE: Calculate portfolio risk
        RE-->>Q: Deterministic result
        Q->>DB: Save risk snapshot
    end
```

The exact HTTP behavior can evolve, but the important point is that a slow upstream chain query should not force every client request to wait synchronously.

## Event-driven updates

Chainhook gives us a second path. Instead of waiting for a user to request a refresh, an event from a supported contract can tell us that a known position changed.

```mermaid
sequenceDiagram
    participant C as Stacks contract
    participant CH as Chainhook
    participant API as Chainhook endpoint
    participant Q as BullMQ
    participant W as Worker/Indexer
    participant DB as PostgreSQL
    participant RT as Realtime gateway

    C-->>CH: Contract event
    CH->>API: Signed callback
    API->>Q: normalized blockchain event
    Q->>W: refresh affected wallet/position
    W->>DB: write new snapshot
    W->>Q: risk.recalculation.requested
    Q->>W: calculate and save risk
    W->>RT: publish risk.updated
    RT-->>RT: emit to wallet room
```

## Smart-contract path

RiskRail does not publish every calculation on-chain. An attestation is an explicit side effect that can run when the snapshot is meaningful enough to preserve.

```mermaid
flowchart LR
    R[Canonical risk report] --> H[SHA-256]
    H --> Q[Attestation job]
    Q --> P[Isolated publisher]
    P --> C[risk-registry.clar]
    C --> E[Clarity print event]
    E --> CH[Chainhook]
    CH --> DB[Record tx + snapshot id]
```

This is intentionally one-way. The reporting system can survive a temporary failure to publish on-chain; the database remains the working source for rich reports while the contract is the verifiable anchor.

## Deployment shape

The repository has five deployable application processes:

- `web`;
- `api`;
- `indexer`;
- `worker`;
- `realtime`.

The packages under `packages/` are libraries, not separately deployed services.

This gives us enough isolation to scale the indexer and worker independently without turning every module into its own network service.
