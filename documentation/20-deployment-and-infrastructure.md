# Deployment and Infrastructure

## Early production target

The first hosted version should be boring to operate.

A sensible shape is:

```text
Next.js web        -> Vercel
NestJS API         -> Cloud Run/container platform
Indexer            -> Cloud Run/container platform
Worker             -> Cloud Run worker/service/container platform
Realtime           -> Cloud Run/container platform with websocket support
PostgreSQL         -> managed PostgreSQL
Redis              -> managed Redis
Secrets            -> cloud secret manager
Images             -> managed container registry
CI/CD              -> GitHub Actions
```

The exact provider can change. The application is containerized so the architecture is not tied to one cloud vendor.

## Development environment

Docker Compose currently starts PostgreSQL and Redis locally. Application processes run through pnpm/Turborepo.

That makes local feedback fast without requiring every developer to run a local Kubernetes cluster.

## Environments

Use at least:

```text
development
staging
production
```

For blockchain work, network configuration is another dimension:

```text
devnet / testnet / mainnet
```

Do not reuse production database/keys for testnet experiments.

## Configuration

Environment variables are validated at process startup. Important categories:

- core ports/URLs;
- database/Redis;
- Stacks network/API;
- Chainhook auth;
- deployed contract principals;
- publisher configuration;
- auth/API-key secrets;
- SMTP;
- observability.

Production credentials belong in the secret manager, not `.env` files committed to Git.

## Container images

Use small multi-stage builds and run as a non-root user where practical.

Each deployable app can eventually have a dedicated image target so the API image does not need the web application's build artifacts, for example.

## Database migrations

Production deploy flow should apply reviewed migrations before/with the application rollout using a controlled migration job.

Avoid every API replica automatically racing to run migrations at startup.

## Terraform

The repository currently includes a Terraform skeleton. Once the first hosted environment stabilizes, Terraform should define:

- database;
- Redis;
- container services;
- service accounts;
- secret references;
- network rules;
- logging/monitoring resources;
- domain/DNS pieces where appropriate.

Start by codifying the infrastructure we actually use, not an imaginary future platform.

## CI/CD stages

A healthy pipeline:

```text
Pull request
  -> install
  -> format/lint
  -> typecheck
  -> tests
  -> contract checks
  -> build
  -> security scan

Merge main
  -> build immutable images
  -> deploy staging
  -> smoke test
  -> promote/deploy production with approval
```

The grant phase may initially deploy manually after CI passes; the repository should still keep deployment repeatable.

## Rollback

Every service deployment should be versioned by commit/image digest.

Rollback planning includes both application and schema compatibility. A code rollback is not safe if the database migration removed data the old code expects.

Favor additive migrations during rapid development.

## Scaling

Scale pressure will probably arrive unevenly:

- API scales on HTTP traffic;
- realtime scales on connected sockets;
- indexer scales on watched protocols/wallet refresh volume;
- workers scale on queue depth;
- PostgreSQL scales on historical snapshot volume.

That is one reason these processes are separate apps even though the business logic stays in shared packages.
