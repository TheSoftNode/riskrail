# Local Development

## Prerequisites

Install:

- Node.js 22 or newer;
- Corepack/pnpm;
- Docker Desktop or compatible Docker engine;
- Git;
- Clarinet CLI for contract development.

Optional but useful:

- VS Code with repository-recommended extensions;
- PostgreSQL client;
- Redis CLI;
- a Stacks wallet for testnet interaction.

## Install

From the repository root:

```bash
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
```

## Environment

```bash
cp .env.example .env
```

For local development, the example database/Redis credentials work with the included Docker Compose file.

Review these values before starting:

```env
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so
CHAINHOOK_AUTH_TOKEN=change-me
RISK_PUBLISHER_ENABLED=false
```

Do not enable the publisher with a real secret in a casually shared `.env` file.

## Start dependencies

```bash
pnpm infra:up
```

This starts:

- PostgreSQL on 5432;
- Redis on 6379.

Check:

```bash
docker compose ps
```

## Prisma

Generate the client:

```bash
pnpm db:generate
```

Create/apply a development migration:

```bash
pnpm db:migrate
```

Seed if needed:

```bash
pnpm db:seed
```

## Run applications

```bash
pnpm dev
```

Expected local endpoints:

```text
Web       http://localhost:3000
API       http://localhost:4000/api/v1
Swagger   http://localhost:4000/docs
Realtime  http://localhost:4001
```

Some apps are still scaffold-level. A successful process start does not mean every product route is fully wired to live indexing yet. See `29-current-status.md`.

## Run quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If a workspace has placeholder tests, replace them as the corresponding feature is implemented rather than accepting permanent `echo tests pending` scripts.

## Contracts

```bash
cd contracts
pnpm install
pnpm test
clarinet check
```

The exact Clarinet commands can evolve with the installed CLI version, but both TypeScript/Clarinet tests and static contract checks should pass before deployment.

## Useful targeted commands

Run a workspace directly:

```bash
pnpm --filter @rivisk/api dev
pnpm --filter @rivisk/web dev
pnpm --filter @rivisk/risk-engine test
pnpm --filter @rivisk/contracts test
```

## Reset local infrastructure

To stop:

```bash
pnpm infra:down
```

To delete local database/Redis volumes as well:

```bash
docker compose down -v
```

That destroys local data; do not use it against production infrastructure.

## Common setup issues

### Port already in use

Check 3000, 4000, 4001, 5432 and 6379.

### Prisma cannot connect

Make sure Docker PostgreSQL is healthy and `DATABASE_URL` matches the Compose credentials.

### Stacks calls fail

Check `STACKS_API_URL`, network, API-key requirements and internet access.

### Contract tests fail after a Clarinet upgrade

Check the `@stacks/clarinet-sdk`, `vitest-environment-clarinet` and CLI versions together. Avoid upgrading only one piece without running the full contract suite.
