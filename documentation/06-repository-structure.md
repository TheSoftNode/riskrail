# Repository Structure

RiskRail is a pnpm/Turborepo monorepo. The structure is meant to answer a simple question quickly: "where should this code live?"

## Top level

```text
riskrail/
├── apps/                 Deployable application processes
├── packages/             Shared domain and infrastructure libraries
├── contracts/            Clarinet project and Clarity contracts
├── chainhook/            Chainhook predicates and integration notes
├── docs/                 Short architecture notes and ADRs
├── documentation/        Long-form product and engineering documentation
├── infrastructure/       Docker/Terraform infrastructure material
├── scripts/              Developer and operational scripts
├── .github/              CI, security and contributor automation
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## `apps/web`

The browser application. It should contain presentation, client-side state, wallet connection and API consumption, not copies of the risk formulas.

Planned feature areas include:

```text
src/app/
  dashboard/
  portfolio/
  positions/
  risk/
  simulations/
  alerts/
  protocols/
  developers/
  settings/
```

Shared UI belongs under components/hooks/providers rather than being embedded into route files when it is reusable.

## `apps/api`

The NestJS REST API. It is the public server boundary for clients and Chainhook callbacks.

The current scaffold includes health, portfolio and Chainhook modules. The intended module layout is broader:

```text
modules/
  auth/
  users/
  wallets/
  portfolios/
  positions/
  protocols/
  risk/
  simulations/
  alerts/
  notifications/
  webhooks/
  api-keys/
  chainhook/
  health/
  metrics/
```

A module can orchestrate packages and persistence, but reusable business rules should still live in domain packages.

## `apps/indexer`

The indexer owns blockchain ingestion and refresh scheduling. This is where Stacks-specific operational concerns belong:

- latest block/tip tracking;
- address refreshes;
- event parsing;
- backfills;
- handling duplicate/replayed callbacks;
- protocol discovery;
- index lag metrics.

It should delegate protocol interpretation to adapters rather than implementing protocol rules itself.

## `apps/worker`

The worker runs BullMQ jobs that can be retried independently of an HTTP request. Planned processors include:

- portfolio refresh;
- risk recalculation;
- stress scenario execution when asynchronous;
- alert evaluation;
- email notification;
- webhook delivery;
- report canonicalization/hashing;
- on-chain attestation publication;
- historical snapshot maintenance.

## `apps/realtime`

Socket.IO delivery for clients that need live portfolio/risk updates. A useful room convention is:

```text
wallet:{address}
portfolio:{address}
risk:{address}
protocol:{protocolId}
```

Authentication and room authorization must be enforced before private account data is added to realtime channels.

## `packages/adapter-core`

This package defines the contract that every protocol integration follows. It is one of the most important boundaries in the repository.

It currently defines:

- `PositionType`;
- `ProtocolMetadata`;
- `PositionAsset`;
- `NormalizedPosition`;
- `AdapterContext`;
- `ProtocolAdapter`.

Changing these types should be treated as a deliberate domain change because several packages depend on them.

## `packages/adapter-native-stacks`

The native wallet adapter. It already fetches STX/fungible token balances through `@riskrail/stacks` and converts them into a normalized wallet position.

The next important work here is token metadata resolution so decimals and symbols for arbitrary SIP-010 assets are not guessed.

## `packages/adapter-bitpay`

The BitPay stream adapter. Instead of copying the BitPay application, this package defines a small `BitPayReader` interface and maps streams into normalized positions.

That separation lets the reader implementation change without changing the portfolio model.

## `packages/portfolio-engine`

Protocol-agnostic portfolio aggregation. It combines normalized positions and builds totals/exposure views.

Over time it should handle:

- per-protocol totals;
- per-asset totals;
- known/unknown valuation coverage;
- accessibility totals;
- duplicate exposure rules when needed.

## `packages/risk-engine`

Pure deterministic calculations. The current scaffold already contains:

- protocol concentration;
- health factor classification;
- capital accessibility;
- generic price shocks;
- portfolio risk summary.

This package should remain free of network and database calls.

## `packages/stacks`

A typed Stacks data client. At the moment it supports address balances, current block height and principal validation.

Future chain reads belong here if they are generic to Stacks rather than tied to one protocol.

## `packages/database`

Prisma schema and database client. This is the persistence model for users, wallets, positions, snapshots, alerts, developer credentials and audit records.

## `packages/events`

Domain event names and payload contracts. The purpose is to avoid free-form string/event payloads drifting between the indexer, worker and realtime service.

## `packages/queue`

Shared BullMQ connection and queue helpers.

## `packages/oracle`

Price-provider abstractions, aggregation and source metadata. Price reliability matters enough that this logic should not be hidden inside an adapter.

## `packages/riskrail-contracts`

The TypeScript client for RiskRail's own Clarity contracts. This is separate from `contracts/`, which contains the Clarity source code.

Application code should use this package rather than recreating Stacks transaction arguments in several services.

## `packages/sdk`

The public developer SDK. It should mirror the API resources and remain thin.

## `packages/shared-types` and `packages/validation`

Cross-package types and Zod schemas that are genuinely shared. Avoid turning `shared-types` into a dumping ground for everything that does not have a home.

## `contracts/`

A complete Clarinet project containing:

- `risk-provider-trait.clar`;
- `risk-registry.clar`;
- `risk-policy.clar`;
- `protocol-registry.clar`;
- tests and configuration.

The contract project can be tested independently from the Node applications.

## `docs/` versus `documentation/`

`docs/` is intentionally concise: architecture notes, ADRs and a short roadmap.

`documentation/` is the narrative reference. It is the folder to send to a new contributor, a grant reviewer who wants implementation depth, or a future maintainer trying to understand why the system exists.
