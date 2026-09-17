# Current Implementation Status

This page is intentionally conservative. It says what is in the repository today, what is usable now, and what still needs work. The project is moving beyond a scaffold, but it is not being presented as production-complete before it is.

Last reviewed during the first Milestone 1 implementation pass.

## Repository foundation — present

The workspace foundation is in place:

- pnpm workspaces and Turborepo;
- TypeScript shared configuration;
- separate web, API, indexer, worker and realtime applications;
- reusable domain packages;
- Docker Compose for PostgreSQL and Redis;
- Prisma data model;
- GitHub Actions/security scaffolding;
- Terraform structure;
- contributor and security documentation.

## Stacks data access — working foundation

The Stacks package now has a real data path rather than only a placeholder client.

It currently supports:

- current Stacks block height;
- STX balances through the v3 principal-balance endpoint;
- fungible-token balances through the v3 principal FT endpoint, including pagination;
- a compatibility fallback for providers that still expose the older balance endpoint;
- SIP-010 metadata lookup through Hiro's token metadata API;
- direct Clarity read-only calls through Stacks.js;
- contract-ID and asset-identifier parsing;
- principal validation.

The native wallet adapter uses this information to create a normalized wallet position. It records STX total, available and locked amounts, and resolves token symbols/decimals before the valuation layer sees them.

## BitPay adapter — direct contract reader present

RiskRail no longer has only an abstract `BitPayReader` interface.

`StacksBitPayReader` reads the existing BitPay core contract directly. It queries sender and recipient stream IDs, loads the stream state and current vested amount, and then passes that data through the existing BitPay adapter.

The adapter produces RiskRail positions containing:

- outstanding sBTC;
- withdrawn sBTC;
- vested sBTC;
- currently withdrawable sBTC;
- start/end block;
- sender/recipient;
- cancellation state;
- capital-accessibility ratio.

Direct contract reads are the first implementation. Chainhook-backed cached state is still planned because it is a better long-term path for high-volume indexing.

## Price and valuation layer — implemented for the MVP path

The oracle package now defines a real `PriceOracle` interface and includes:

- `CoinGeckoPriceOracle` for BTC/STX/sBTC USD quotes;
- `StaticPriceOracle` for deterministic local testing;
- Decimal.js-based valuation to avoid JavaScript floating-point arithmetic in financial calculations.

The portfolio engine can now value normalized assets, compute position values, aggregate totals by protocol and by asset, and report valuation coverage. Unknown tokens are left unvalued rather than guessed.

## Database persistence — wired

The Prisma schema now covers the current indexing path, including:

- active/closed positions;
- position assets;
- historical position snapshots;
- portfolio snapshots;
- risk snapshots with full JSON reports;
- methodology versions and report hashes;
- indexing runs/correlation IDs;
- price observations for later persistence;
- existing alert/API-key/webhook/audit models.

The database package includes helpers to persist an indexed portfolio, close positions that disappear from the latest index, create historical snapshots, record failed indexing runs, load the current portfolio and persist risk snapshots.

A migration still needs to be generated/committed after dependencies are installed locally. The schema is the source of truth for that migration.

## Indexer — queue-backed wallet indexing implemented

The indexer now consumes `portfolio.refresh` jobs from BullMQ.

For each wallet it:

1. validates the Stacks principal;
2. reads the current block height;
3. runs the configured protocol adapters;
4. resolves price data when available;
5. values and normalizes the positions;
6. persists positions and a portfolio snapshot;
7. records an indexing run with a correlation ID;
8. queues deterministic risk calculation.

The native Stacks adapter is always enabled. The BitPay adapter becomes active when `BITPAY_CORE_CONTRACT` is configured.

If the external price source is unavailable, RiskRail still persists exact on-chain balances and exposes reduced valuation coverage instead of failing the entire wallet index.

## API — connected to the indexer/database path

The portfolio API is no longer returning hard-coded `indexing-not-configured` responses.

Current endpoints include:

- `GET /api/v1/portfolios/:address` — current persisted portfolio;
- `POST /api/v1/portfolios/:address/refresh` — enqueue a fresh index;
- `GET /api/v1/portfolios/:address/risk` — latest persisted risk report;
- health/readiness endpoints;
- protected Chainhook receiver endpoints from the initial scaffold.

The refresh endpoint returns a correlation ID so this can later be exposed as a first-class indexing-status resource.

## Risk engine — real MVP metrics present

The deterministic risk engine now includes:

- protocol concentration;
- asset concentration;
- capital accessibility;
- health-factor classification;
- generic price-shock primitive;
- a transparent MVP composite score;
- a labelled liquidity proxy based on capital accessibility.

The composite score is deliberately secondary. The report keeps the underlying metrics visible because RiskRail should not hide financial evidence behind a single number.

Still required for Milestone 2:

- a real lending adapter;
- protocol-specific health/liquidation formulas;
- market-depth liquidity measurement;
- full scenario recalculation after BTC/STX shocks.

## Risk reports and hashing — implemented

The worker builds a deterministic risk report after each successful wallet index. The report contains the source block, methodology version, valuation coverage, position summary and calculated metrics.

The report is canonicalized by sorting object keys before hashing and is committed to SHA-256. Both the full report and hash are stored in PostgreSQL.

This is the bridge between the off-chain risk engine and the on-chain attestation contract.

## Smart contracts and publisher — first end-to-end path present

The repository still contains the four original Clarity components:

- risk provider trait;
- risk registry;
- risk policy;
- protocol registry.

The TypeScript contracts package now also contains a `RiskRegistryPublisher` that can construct and broadcast `publish-risk-snapshot` transactions with Stacks.js.

When `RISK_PUBLISHER_ENABLED=true`, a persisted risk snapshot is queued for publication. The publisher process is deliberately separated from the API request path.

Before enabling this against testnet, the registry must be deployed and the publisher principal must be authorized in `risk-registry.clar`.

The remaining on-chain work is confirmation tracking and reading the confirmed snapshot ID back into PostgreSQL. At the moment, a successful broadcast records the transaction ID.

## Testing — improved but not complete

Package-level tests now cover several important pure functions and mappings, including:

- Stacks identifier parsing/network inference;
- portfolio atomic-unit conversion and valuation;
- BitPay outstanding/withdrawable stream calculations;
- concentration and health-factor risk logic;
- existing Clarinet contract tests.

The next testing step is a Docker-backed integration test suite that runs PostgreSQL/Redis and exercises the full refresh -> index -> risk pipeline.

## Web application — scaffold

The Next.js application is still mostly the application shell. Production-quality portfolio, risk, stress and alert screens are Milestone 2 work.

## Realtime, alerts and webhooks — scaffold / later milestone

The realtime service and event boundaries exist, but live position/risk publishing, alert state machines and signed outgoing webhooks are not complete yet.

## What "enterprise-ready" means right now

The codebase now has a working Milestone 1 data path and strong boundaries, but enterprise-ready is not being used as a synonym for "finished".

Before a public/mainnet launch we still need at least:

- dependency install + full workspace build verification on a developer machine/CI;
- committed Prisma migration;
- Docker-backed integration tests;
- Chainhook incremental indexing and reorg strategy;
- lending/collateral adapter validation;
- production authentication/API-key handling;
- signed webhook delivery;
- alert delivery/cooldowns;
- observability and SLOs;
- secret-manager-backed publisher key;
- contract testnet deployment and soak testing;
- threat review/security testing;
- hosted beta validation.

The detailed implementation notes for this pass are in [31-milestone-1-implementation.md](./31-milestone-1-implementation.md).
