# RiskRail

**Risk intelligence and verifiable risk attestations for Bitcoin capital on Stacks.**

RiskRail indexes wallet and protocol positions, normalizes them into a common portfolio model, calculates deterministic risk metrics, runs market stress scenarios, and can publish compact risk attestations on-chain through Clarity contracts.

## Why this architecture

RiskRail deliberately separates responsibilities:

- **Protocol adapters understand protocols.**
- **The portfolio engine understands normalized positions.**
- **The risk engine understands deterministic risk.**
- **The indexer understands Stacks data and events.**
- **The API understands clients.**
- **Clarity contracts provide verifiability, user-owned policies, and composability.**

The MVP is non-custodial. RiskRail does not move user funds.

## Monorepo

```text
apps/
  web/        Next.js dashboard
  api/        NestJS REST API
  indexer/    Stacks + Chainhook indexing process
  worker/     BullMQ background processors
  realtime/   Socket.IO event gateway
contracts/    Clarinet / Clarity contracts and tests
packages/
  adapter-core/
  adapter-native-stacks/
  adapter-bitpay/
  database/
  events/
  logger/
  oracle/
  portfolio-engine/
  queue/
  risk-engine/
  riskrail-contracts/
  sdk/
  shared-types/
  stacks/
  validation/
infrastructure/
  docker/
  terraform/
chainhook/
  predicates/
docs/
```

## Tech stack

- Node.js 22 LTS, TypeScript 5.9, pnpm, Turborepo
- Next.js 16 / React 19
- NestJS 11
- PostgreSQL 16 + Prisma 6
- Redis 7 + BullMQ
- Stacks API / Stacks.js / Chainhook
- Clarity 5 + Clarinet SDK
- Socket.IO
- Decimal.js for deterministic decimal arithmetic
- Vitest + Playwright-ready structure
- Docker Compose, GitHub Actions, Terraform skeleton

The stack intentionally avoids Kafka and Kubernetes during the grant MVP. Event contracts are defined now so those can be introduced later without rewriting domain logic.

## Quick start

Prerequisites: Node.js 22+, Docker, and Clarinet for local smart-contract development.

```bash
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Default local endpoints:

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- Swagger: http://localhost:4000/docs
- Realtime: http://localhost:4001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Smart contracts

The initial contract suite lives under `contracts/`:

- `risk-provider-trait.clar` — minimal composable interface for risk providers.
- `risk-registry.clar` — immutable historical risk snapshots and report hashes.
- `risk-policy.clar` — user-owned on-chain risk thresholds.
- `protocol-registry.clar` — canonical registry of supported protocol contracts.

Risk calculations remain off-chain. RiskRail commits compact attestations and hashes on-chain instead of placing the full analytics engine in Clarity.

```bash
cd contracts
pnpm test
# with Clarinet CLI installed:
clarinet check
```

## Existing project leverage

RiskRail is designed to reuse proven engineering patterns from the owner's prior Stacks projects without rebranding payment logic as new work:

- StacksPay patterns: Stacks API access, Chainhook/event processing, API keys, webhook architecture, SDK organization, Swagger, security middleware.
- BitPay patterns: sBTC/Clarity reads, contract-event indexing, realtime events, and BitPay itself as an initial protocol adapter.

The new RiskRail work is the adapter standard, normalized position model, portfolio engine, deterministic risk engine, stress engine, alert evaluation, and on-chain risk attestation layer.

## First implementation sequence

1. Native Stacks wallet indexing.
2. BitPay adapter with real stream positions.
3. Portfolio normalization and valuation.
4. Deterministic concentration + accessibility metrics.
5. External lending adapter and collateral/liquidation metrics.
6. Stress engine.
7. Risk registry publishing on testnet.
8. User risk policies + alert evaluation.
9. Public API/SDK and external integration proof.

See `docs/ROADMAP.md` and `docs/architecture/overview.md`.
