# Rivisk Documentation

This folder is the long-form guide to Rivisk. The shorter files under `docs/` are useful when somebody already understands the project and just needs an architecture note or an ADR. The material here is different: it explains the product from the beginning, records why the system is being built the way it is, and gives a new engineer enough context to work on the code without relying on conversations that happened before the repository existed.

Rivisk is still early. Some parts of the repository are working foundations, some are scaffolding, and some are planned work for the grant milestones. The documentation calls that out deliberately. We do not want a README that makes the project look more complete than it is.

## Start here

If you are new to the project, read these in order:

1. [Product overview](./01-product-overview.md)
2. [Product requirements](./02-product-requirements.md)
3. [Users and use cases](./03-users-and-use-cases.md)
4. [Scope and non-goals](./04-scope-and-non-goals.md)
5. [System architecture](./05-system-architecture.md)
6. [Repository structure](./06-repository-structure.md)
7. [Technology stack](./07-technology-stack.md)
8. [Data model](./08-data-model.md)
9. [Protocol adapter design](./09-protocol-adapter-design.md)
10. [Risk engine methodology](./10-risk-engine-methodology.md)
11. [Stress testing](./11-stress-testing.md)
12. [Smart contract design](./12-smart-contract-design.md)
13. [On-chain attestations](./13-onchain-attestations.md)
14. [Chainhook and indexing](./14-chainhook-and-indexing.md)
15. [API, SDK and webhooks](./15-api-sdk-and-webhooks.md)
16. [Realtime updates and alerts](./16-realtime-and-alerts.md)
17. [Security model](./17-security-model.md)
18. [Testing strategy](./18-testing-strategy.md)
19. [Observability and operations](./19-observability-and-operations.md)
20. [Deployment and infrastructure](./20-deployment-and-infrastructure.md)
21. [What we are reusing from earlier Stacks projects](./21-existing-code-reuse.md)
22. [Grant milestones](./22-grant-milestones.md)
23. [Product roadmap](./23-roadmap.md)
24. [Local development](./24-local-development.md)
25. [Engineering workflow](./25-engineering-workflow.md)
26. [Project risks and mitigations](./26-risks-and-mitigations.md)
27. [Demo and acceptance plan](./27-demo-and-acceptance-plan.md)
28. [Glossary](./28-glossary.md)
29. [Current implementation status](./29-current-status.md)
30. [Architecture decisions and trade-offs](./30-decisions-and-tradeoffs.md)
31. [Milestone 1 implementation](./31-milestone-1-implementation.md)
32. [Zest V2 lending integration and stress engine](./32-zest-v2-lending-and-stress-engine.md)
33. [Dashboard, realtime alerts and on-chain policy evaluation](./33-dashboard-alerts-and-policy-evaluation.md)

## A note on language

Rivisk deals with financial risk, but it is not an investment adviser and it should not pretend to be one. The product describes observable positions, deterministic calculations, user-configured thresholds, and simulated scenarios. It does not tell a user what to buy or sell, and it does not call a position "safe" in an absolute sense.

Similarly, the AI explanation layer is intentionally downstream of the deterministic engine. The model can explain a result in plain language, but it does not invent the result.

## What is already in the repository

The current scaffold already contains the main application boundaries:

- `apps/web` for the Next.js interface;
- `apps/api` for the NestJS REST API;
- `apps/indexer` for Stacks and protocol indexing;
- `apps/worker` for background jobs;
- `apps/realtime` for Socket.IO delivery;
- `packages/adapter-*` for protocol-specific position discovery;
- `packages/portfolio-engine` for normalized portfolio aggregation;
- `packages/risk-engine` for deterministic calculations;
- `contracts/` for the Clarity contracts and Clarinet tests;
- PostgreSQL/Prisma, Redis/BullMQ, Docker Compose, GitHub Actions, and infrastructure placeholders.

The repository is intentionally a modular monorepo rather than a collection of independent microservices. We keep deployment boundaries where they are useful, but we keep business logic in reusable packages so the system can grow without forcing distributed-system complexity into the first grant milestone.

## Implementation handoff

- [31 — Milestone 1 implementation](./31-milestone-1-implementation.md) — how the first refresh/index/risk/attestation path was wired.
- [32 — Zest V2 lending and stress engine](./32-zest-v2-lending-and-stress-engine.md) — how the first external lending adapter, health/liquidation math and scenario engine work.
- [33 — Dashboard, realtime alerts and policy evaluation](./33-dashboard-alerts-and-policy-evaluation.md) — how the usable web product, Redis-to-Socket.IO event path and wallet-owned policy checks are wired.
