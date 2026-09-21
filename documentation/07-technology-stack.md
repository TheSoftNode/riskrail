# Technology Stack

The stack was chosen to keep the first version fast to build while leaving clean paths to scale. "Enterprise" here means maintainable boundaries, security, tests, observability and deployment discipline. It does not mean adding infrastructure that the product does not need yet.

## Runtime and monorepo

### Node.js 22+

Rivisk is TypeScript-first. Node 22 gives the services a modern runtime and lets us share types and domain libraries across the API, indexer, worker, realtime service and SDK.

### TypeScript 5.9

The main benefit is not syntax. It is the ability to make protocol adapters, event payloads, risk inputs and API contracts explicit across package boundaries.

### pnpm workspaces

pnpm keeps monorepo installs efficient and makes internal package dependencies straightforward.

### Turborepo

Turborepo coordinates build, lint, test, typecheck and development tasks across applications and packages. It also gives us a clean route to caching in CI later.

## Frontend

### Next.js 16 and React 19

The web application uses Next.js for routing, rendering and a production-ready React deployment model.

### TanStack Query

Server state such as portfolio, risk, protocol and simulation data should use query caching rather than being duplicated in hand-written global stores.

### Stacks Connect

Wallet connection and user-approved Stacks actions belong in the browser through the Stacks wallet ecosystem.

### Zod

Useful for validating client-facing payloads and shared runtime schemas.

The initial scaffold does not yet include every planned UI dependency. Tailwind, shadcn/ui and a chart library can be added when the actual dashboard work begins rather than being installed just to sit unused.

## Backend

### NestJS 11

NestJS gives the API a clear module boundary, dependency injection, guards/interceptors and a mature OpenAPI story. It is a good fit for a codebase expected to grow beyond a handful of endpoints.

### REST + OpenAPI

REST is deliberately the first public interface. Rivisk resources map naturally to wallets, portfolios, positions, risk snapshots, simulations and alerts. OpenAPI also gives us a stable path to SDK generation and external integration.

GraphQL is not prohibited; it is simply not necessary for the first release.

## Persistence

### PostgreSQL 16

Rivisk data is relational and historical. Wallets have positions, positions have assets and snapshots, alerts have events, users have API keys and webhook endpoints. PostgreSQL fits these relationships and gives us strong querying for historical analytics later.

### Prisma 6

Prisma gives typed access, migrations and a readable schema. Financial fields that need decimal precision are stored with high-precision decimal columns rather than JavaScript `number` values.

### Redis 7.4

Redis supports cache and queue workloads. It should not become the source of truth for portfolio history.

### BullMQ

BullMQ is enough for the first asynchronous workload:

- retries;
- backoff;
- delayed jobs;
- concurrency;
- queue separation;
- job visibility.

Kafka can be introduced later if sustained event volume or independent consumer groups actually require it.

## Blockchain integration

### Stacks API / Hiro endpoints

Used to fetch chain state such as balances and tip information.

### Stacks.js

Used for Clarity serialization, read-only calls and transaction construction/signing flows where appropriate.

### Chainhook

Used for event-driven contract monitoring. Chainhook reduces the need to repeatedly scan every supported contract when we can react to specific events.

### Clarity + Clarinet

Rivisk's own on-chain components are Clarity contracts. Clarinet is the local development/test environment.

## Numeric handling

### BigInt and decimal strings for token quantities

Atomic token quantities should stay exact.

### Decimal.js for monetary math

USD valuation, concentration weighting and other decimal calculations should not use binary floating-point arithmetic.

### Basis points and fixed precision integers

Where smart contracts or event payloads need integer representations:

- percentage-like values use basis points (`10,000 = 100%`);
- health factor can use E4 (`14,700 = 1.4700`).

The exact convention must be documented in every public schema.

## Realtime

### Socket.IO

Socket.IO is used for user-facing live updates. It is not the event backbone for internal business logic; queues/domain events remain separate.

## Testing

- Vitest for pure packages and Clarity integration tests where configured;
- Jest/Supertest for NestJS API tests;
- Playwright for browser E2E once the user flows are implemented;
- Clarinet SDK for contract tests.

## Logging and observability

### Pino

The planned structured logger. Logs should be JSON in hosted environments with request/job correlation ids.

### OpenTelemetry

Used to trace requests and jobs across process boundaries without hard-coding the project to one vendor.

### Sentry

Useful for application error reporting, especially the web/API layers.

## Deployment

The preferred early production shape is:

- Vercel for the Next.js web application;
- containerized API/indexer/worker/realtime services on Cloud Run or an equivalent container platform;
- managed PostgreSQL;
- managed Redis;
- cloud secret manager;
- Artifact Registry/container registry;
- GitHub Actions for CI/CD.

Terraform is included so infrastructure can become reproducible as deployments stabilize.

## Technologies intentionally deferred

### Kafka

Useful later, unnecessary now.

### Kubernetes

Useful when service count, traffic or operational requirements justify it. Cloud Run/container deployments are simpler for the grant phase.

### Python risk service

Python becomes attractive if Rivisk adds Monte Carlo analysis, statistical time-series work, machine learning or heavy numerical workloads. The deterministic MVP does not require an extra language/runtime boundary.

### Elasticsearch / ClickHouse

Historical analytics may eventually benefit from specialized stores. PostgreSQL should be pushed far enough to prove that need first.
