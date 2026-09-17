# Current Implementation Status

This page is deliberately conservative. It separates what is already present in the repository from what the architecture documents describe as planned work.

Last reviewed for the initial enterprise scaffold.

## Repository foundation — present

- pnpm workspace;
- Turborepo configuration;
- TypeScript base configuration;
- application/package boundaries;
- Docker Compose for PostgreSQL/Redis;
- Prisma schema;
- GitHub Actions/security scaffolding;
- Terraform placeholder structure;
- contributor/security documents.

## Web application — scaffold

Present:

- Next.js app;
- Stacks Connect dependency;
- TanStack Query dependency;
- basic application shell.

Not yet complete:

- production dashboard pages;
- wallet auth session flow;
- charts;
- portfolio/risk/stress UI;
- alert UI;
- developer console.

## API — scaffold with initial endpoints

Present:

- NestJS application;
- Swagger setup;
- Helmet/server foundation;
- health module;
- portfolio/risk controller/service shape;
- Chainhook module shape.

Important: the current portfolio service explicitly returns placeholder/indexing-not-configured responses. Database/indexer wiring is still Milestone 1 work.

## Stacks package — initial working client

Present:

- address balance call;
- tip height call;
- response validation;
- Stacks principal validation.

Next:

- token metadata/read-only contract helpers;
- network configuration helpers;
- better upstream error types;
- retry/timeout policy.

## Native Stacks adapter — initial implementation

Present:

- reads balances through `StacksClient`;
- emits normalized wallet position;
- STX handling;
- fungible token mapping;
- accessibility set to 100% for direct wallet assets.

Known limitation:

- non-sBTC arbitrary SIP-010 decimals/metadata need proper resolution before valuation.

## BitPay adapter — domain implementation present, reader wiring pending

Present:

- `BitPayReader` interface;
- stream mapping;
- locked amount calculation;
- withdrawable amount calculation;
- accessibility ratio;
- normalized stream position.

Next:

- concrete reader connected to deployed BitPay contracts/indexed state;
- real fixtures;
- Chainhook integration;
- valuation.

## Portfolio engine — initial implementation

Present:

- normalized position aggregation;
- total known USD value;
- totals by protocol.

Next:

- asset totals;
- valuation coverage;
- partial/stale integration metadata;
- snapshot persistence wiring.

## Risk engine — initial working calculations

Present:

- generic concentration calculation;
- protocol concentration;
- health-factor classification;
- capital accessibility weighting;
- generic price shocks;
- basic portfolio risk summary.

Next:

- asset concentration;
- lending protocol health formula;
- liquidation distance;
- liquidity model;
- full scenario recalculation;
- methodology/report versioning;
- optional composite score methodology.

## Database — schema present

Present:

- users;
- wallets;
- protocols;
- positions/assets;
- position/portfolio/risk snapshots;
- alert rules/events;
- API keys;
- webhook endpoints/deliveries;
- indexed blocks;
- audit log.

Next:

- migration baseline;
- repository/services;
- integration tests;
- report storage model;
- final webhook secret design.

## Smart contracts — initial implementation present

Present:

- risk provider trait;
- risk registry with authorized publishers and historical snapshots;
- risk policy;
- protocol registry;
- initial tests/configuration.

Next:

- complete negative/boundary test coverage;
- verify against current Clarinet toolchain;
- testnet deployment;
- TypeScript contract client wiring;
- canonical report verification flow;
- production administration design.

## Indexer/worker/realtime — scaffold

The app boundaries are present, but production processors are still to be implemented.

Priority order:

1. wallet refresh job;
2. adapter registry;
3. position persistence;
4. risk recalculation job;
5. Chainhook idempotency;
6. realtime risk update;
7. alert processor;
8. attestation publisher.

## SDK — scaffold

Package exists. Public resource client methods and stable API types still need implementation.

## Documentation — expanded

The `documentation/` folder is the long-form project reference. The shorter `docs/` folder remains useful for ADRs and concise architecture notes.

## What "enterprise-ready" means at this stage

The repository has enterprise-shaped boundaries, not a claim that a scaffold is production-complete.

Before a mainnet/public production launch, at minimum we still need:

- full install/build verification;
- migration/test coverage;
- real upstream integrations;
- authentication/API-key implementation;
- webhook security implementation;
- observability;
- production secret management;
- contract testnet validation;
- threat review;
- hosted beta soak testing.
