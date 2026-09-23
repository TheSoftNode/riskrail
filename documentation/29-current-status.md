# Current Implementation Status

This page is intentionally conservative. It says what is in the repository today, what is usable now, and what still needs work. Rivisk has moved beyond the original scaffold and now has a real indexing/risk path, but the project is not being presented as production-complete before it has been validated in a hosted environment.

Last reviewed **2026-09-23**, after the public beta went live: hosted API,
realtime gateway, testnet contracts publishing attestations, and Chainhooks 2.0
confirming them back. What is still to come, and what the grant would fund, is in
[22-grant-milestones.md](./22-grant-milestones.md) and on the site's
[Grant scope](https://rivisk-lilac.vercel.app/docs/grant-scope) page.

**Live beta:** app `https://rivisk-lilac.vercel.app` · API
`https://api.13.49.129.179.sslip.io/api/v1` · realtime
`wss://ws.13.49.129.179.sslip.io`. Deployment record:
[37-aws-beta-deployment.md](./37-aws-beta-deployment.md).

## Status at a glance

Five labels, applied strictly:

| Label | Means |
| --- | --- |
| **IMPLEMENTED** | The code exists and typechecks. Nothing more is claimed. |
| **TESTED** | Covered by automated tests that run in CI. |
| **DEPLOYED** | Running somewhere other than a developer machine. |
| **LIVE-VALIDATED** | Checked against real chain or protocol state, with the comparison written down. |
| **PLANNED** | Not built. |

| Capability | Status |
| --- | --- |
| Stacks data access (balances, FT, read-only calls) | LIVE-VALIDATED |
| Native wallet adapter | TESTED |
| BitPay stream adapter | TESTED — no `bitpay-core` contract exists on the current testnet (checked 2026-09-23), so it is disabled in the beta |
| Zest V2 lending adapter | LIVE-VALIDATED — see [validation/zest-v2](../docs/validation/zest-v2.md) |
| Clarity value decoding | TESTED · LIVE-VALIDATED |
| Portfolio engine and normalization | LIVE-VALIDATED (indexed a real mainnet wallet end to end) |
| Risk engine (LTV, health factor, liquidation distance, concentration) | LIVE-VALIDATED (health factor matched Zest's own threshold maths) |
| Stress engine | TESTED |
| Risk report canonicalization and SHA-256 | TESTED |
| Wallet-signature authentication (challenge, nonce, JWT) | LIVE-VALIDATED (real challenge, signature and verification against the hosted beta) |
| API keys | DEPLOYED (accepted for alerts and webhooks, refused for key management, checked against the beta) |
| Signed webhooks (encrypt at rest, HMAC, retry) | TESTED |
| Email notifications | TESTED |
| Alert evaluation (edge-triggered) | TESTED |
| Alert ownership enforcement | DEPLOYED (403 on another wallet's rules, checked against the beta) |
| Rate limiting on public refresh | DEPLOYED (429 with `Retry-After`, checked live) |
| Chainhook incremental indexing | LIVE-VALIDATED — Chainhooks 2.0 hooks registered on testnet; a new attestation's on-chain snapshot id was recorded 11 s after the refresh |
| Chainhook Zest predicate | LIVE-VALIDATED (contract and events verified on mainnet) |
| Database schema | TESTED (migrations apply and drift-check in CI) |
| SDK | PUBLISHED — `@rivisk/sdk@0.1.0` on npm, verified by a clean install from the public registry |
| SDK webhook signature verification | TESTED (WebCrypto, runs on edge runtimes) |
| Dashboard, landing page, developer surface | DEPLOYED — `rivisk-lilac.vercel.app`, a page per dashboard section |
| On-chain policy write from the browser | IMPLEMENTED — not yet exercised with a real wallet |
| Clarity contracts (v1 external interface) | DEPLOYED — testnet, 51 simnet tests, `clarinet check` clean |
| On-chain consumer integration path | LIVE-VALIDATED — example consumer approved from snapshot #1 on testnet (tx `0xb4bb63a6…`) |
| Contract deployment to testnet | DEPLOYED — block 451066, deployer `ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7`; see `contracts/deployments/testnet.json` |
| On-chain risk attestations end to end | LIVE-VALIDATED — worker published snapshot #1 to testnet (tx `0x0877e7b2…`), report hash matches the API |
| Hosted beta (web, API, realtime, workers) | DEPLOYED — one small EC2 server plus Vercel; see [37-aws-beta-deployment.md](./37-aws-beta-deployment.md) |
| Realtime gateway | DEPLOYED — live over WSS; a refresh reached a subscribed browser in 2.3 s |
| Attestation throttle | DEPLOYED — `ATTESTATION_MIN_INTERVAL_BLOCKS` (default 120); three rapid refreshes produced one transaction |
| Email notification delivery in the beta | PLANNED — implemented, but no SMTP server is configured |
| Production API, availability commitment, managed database | PLANNED — grant work; the beta is deliberately small and low-cost |
| Market-depth liquidity analysis | PLANNED |
| AI risk explanations (explains an existing report; never computes risk) | PLANNED — grant work |
| Email address verification | PLANNED |
| Usage metrics and evidence capture | PLANNED |

The whole stack now runs in public: a wallet lookup indexes, scores, pushes the
update to the browser over WSS, publishes an attestation when the risk actually
changed, and records the on-chain snapshot id when Chainhook confirms it. The
authenticated paths (sign-in, API keys, webhooks, alerts and their permission
boundaries) are exercised against the hosted beta by `apps/api/scripts/smoke.mjs`.

Two user paths have still never been run with a real browser wallet: signing in
from the dashboard, and writing a risk policy on chain.

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

The Stacks package has a real data path rather than only a placeholder client.

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

Rivisk has a concrete `StacksBitPayReader` rather than only an abstract interface.

It reads the existing BitPay core contract directly, queries sender and recipient stream IDs, loads stream state and current vested amounts, and passes the results through the BitPay adapter.

The normalized stream positions contain outstanding, withdrawn, vested and currently withdrawable sBTC along with the block range and cancellation state. This gives Rivisk a real example of capital that belongs to a wallet economically but is not simply sitting in the wallet balance.

Direct contract reads are the first implementation. Chainhook-backed cached state is still the better long-term path for high-volume indexing.

**Not live (checked 2026-09-22).** The adapter's four reads (`get-sender-streams`, `get-recipient-streams`, `get-stream`, `get-vested-amount`) match the `bitpay-core` source in `github.com/TheSoftNode/bitpay`. But the Stacks testnet node answers `NoSuchContract` for every `bitpay-core` version (v1–v5) under the documented deployer `ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7`; that deployer's history holds only Rivisk's contracts, and the testnet sBTC token BitPay depends on (`ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token`) is also absent. The BitPay contracts were deployed in 2025; the evidence points to a testnet reset since. The beta therefore runs with `BITPAY_CORE_CONTRACT` unset. Enabling it needs BitPay redeployed against a token that exists on the current testnet.

## Zest V2 lending adapter — first external lending integration present

Rivisk now contains `packages/adapter-zest-v2`, the first external lending/collateral adapter.

The adapter is built around the current public Zest V2 contract model. It reads a wallet's obligation from the market vault, resolves collateral/debt asset information, converts zToken collateral to underlying exposure, converts scaled debt using the relevant vault borrow index, and reads the egroup risk parameters that apply to the position.

Those protocol parameters are normalized into shared `LendingRiskParameters`, including the borrow LTV, partial/full liquidation LTVs and liquidation-penalty bounds.

The adapter is disabled by default and must be enabled explicitly. Mainnet defaults exist for the currently published Zest V2 deployment; non-mainnet environments require contract overrides.

The adapter has now been run against a live mainnet obligation and compared
field-by-field with Zest's own on-chain figures. Rivisk reproduces the
protocol's debt accounting to eight significant figures once the USDC oracle
price is accounted for, and reads the position's risk parameters rather than
assuming them. The full comparison, including the decoding bug that first run
exposed, is in [docs/validation/zest-v2.md](../docs/validation/zest-v2.md).

That is one position with one asset pair. Multi-collateral positions, other
assets and positions in liquidation have not been checked against live data, and
Rivisk marks to its own oracle rather than Zest's, so USD figures and
liquidation distances will not match Zest's screen exactly.

## Price and valuation layer — implemented for the current MVP path

The oracle package defines a `PriceOracle` interface and includes:

- `CoinGeckoPriceOracle` for supported BTC/STX/sBTC/USDC marks;
- `StaticPriceOracle` for deterministic local testing;
- Decimal.js-based valuation to avoid JavaScript floating-point arithmetic in financial calculations.

The portfolio engine values normalized assets, computes position equity, aggregates totals by protocol and by asset, and reports valuation coverage. Debt is treated as negative equity rather than positive portfolio value.

Unknown tokens are left unvalued rather than guessed.

One important limitation remains: Zest itself uses its protocol oracle system for execution-time health/liquidation checks, while the current Rivisk MVP uses its own mark-to-market price source for portfolio analytics. Zest thresholds come from contract state, but Rivisk does not yet claim exact oracle-price parity with a Zest transaction at the same instant.

## Lending metrics — shared calculation path present

The portfolio engine now derives lending metrics after valuation rather than making the Zest adapter calculate everything itself.

For supported lending positions it can calculate:

- collateral value;
- debt value;
- current LTV;
- borrow headroom;
- health factor against the protocol's partial-liquidation threshold;
- estimated distance to partial liquidation;
- estimated single-collateral liquidation price where the input is sufficient.

This separation is intentional. A future lending adapter should only need to produce normalized collateral/debt assets and protocol thresholds, then reuse the same arithmetic.

## Stress engine — deterministic scenarios implemented

The risk engine now has a full scenario runner for the current lending model.

Built-in presets include:

- BTC -10%;
- BTC -20%;
- BTC -30%;
- STX -20%.

Custom scenarios can contain multiple asset shocks. The engine applies shocks to a copy of the latest normalized positions, recalculates USD values and lending metrics, and reports before/after health and liquidation distance. It flags a position when a scenario moves it across the partial-liquidation threshold.

The background worker includes the standard scenarios in each canonical risk report. The methodology version is now `rivisk-v1.2`.

## Simulation API — implemented

The API now includes:

- `GET /api/v1/simulations/presets`;
- `POST /api/v1/simulations`.

A custom simulation runs against the latest persisted wallet state rather than silently reindexing the wallet. The response includes the portfolio source block and valuation coverage so the caller knows what snapshot was used.

## Database persistence — wired

The Prisma schema covers the current indexing path, including:

- active/closed positions;
- position assets;
- historical position snapshots;
- portfolio snapshots;
- risk snapshots with full JSON reports;
- methodology versions and report hashes;
- indexing runs/correlation IDs;
- price observations for later persistence;
- alert/API-key/webhook/audit models.

The database package persists an indexed portfolio, closes positions that disappear from the latest index, creates historical snapshots, records failed indexing runs, loads the current portfolio and persists risk snapshots.

A migration still needs to be generated/committed after dependencies are installed locally if that has not already been done in the working clone.

## Indexer — queue-backed multi-adapter indexing implemented

The indexer consumes `portfolio.refresh` jobs from BullMQ.

For each wallet it validates the principal, reads the current block height, runs configured adapters, resolves prices, values and normalizes positions, persists the result, records an indexing run and queues deterministic risk calculation.

The native Stacks adapter is always enabled. BitPay is enabled when its core contract is configured. Zest V2 is enabled when `ZEST_V2_ENABLED=true` and the network/contract configuration is valid.

If the external price source is unavailable, Rivisk still preserves exact on-chain quantities and lowers valuation coverage instead of failing the whole index.

## API — connected to indexed data

Current portfolio/risk routes include:

- `GET /api/v1/portfolios/:address`;
- `POST /api/v1/portfolios/:address/refresh`;
- `GET /api/v1/portfolios/:address/risk`;
- simulation routes described above;
- health/readiness routes;
- the protected Chainhook receiver from the initial scaffold.

The refresh endpoint returns a correlation ID so indexing status can become a first-class API resource later.

## Risk engine — real MVP metrics present

The deterministic risk engine now includes:

- protocol concentration based on gross exposure;
- asset concentration;
- capital accessibility;
- lending health-factor classification;
- liquidation-distance aggregation;
- generic and multi-asset price shocks;
- default stress scenarios;
- a transparent MVP composite score;
- a labelled liquidity proxy based on capital accessibility.

The composite score remains secondary. Individual metrics and scenario results are the primary evidence.

Still required for a fuller market-risk product:

- market-depth based liquidity/exit impact;
- protocol-native oracle parity where execution-level precision is needed;
- additional risk dimensions such as protocol-level exposure metadata and stale-data policies;
- scenario persistence/history if we want user-created simulations to be auditable over time.

## Risk reports and hashing — implemented

The worker builds a deterministic report after each successful wallet index. The report includes source block, methodology version, valuation coverage, current metrics, default stress results and summarized position data.

The report is canonicalized before hashing and committed to SHA-256. The full report and hash are persisted in PostgreSQL.

This remains the bridge between the off-chain risk engine and the on-chain attestation contract.

## Smart contracts and publisher — first end-to-end path present

The repository contains the four original Clarity components:

- risk provider trait;
- risk registry;
- risk policy;
- protocol registry.

The TypeScript contract package also contains a `RiskRegistryPublisher` that can construct and broadcast `publish-risk-snapshot` transactions with Stacks.js.

When `RISK_PUBLISHER_ENABLED=true`, a persisted risk snapshot can be queued for publication. The publisher is deliberately separated from the API request path.

Before enabling this against testnet, the registry must be deployed and the publisher principal authorized. Confirmation tracking and snapshot-ID reconciliation remain unfinished.

## Testing — better coverage, live integration validation still required

Package-level tests now cover important pure calculations and mappings, including:

- Stacks identifier parsing/network inference;
- portfolio atomic-unit conversion and valuation;
- BitPay stream calculations;
- Zest V2 normalization with a mocked reader;
- lending LTV, health factor, liquidation distance and liquidation-price calculation;
- concentration logic;
- a BTC drawdown that crosses a liquidation threshold;
- existing Clarinet contract tests.

The TypeScript/TSX source tree has also been syntax-parsed successfully in the generation environment.

The important next tests are not just more unit tests. We need:

- a dependency-resolved workspace typecheck/build in CI or a developer machine;
- Docker-backed integration tests with PostgreSQL/Redis;
- live read-only Zest validation against a known position;
- controlled testnet attestation publication;
- end-to-end refresh -> risk -> simulation -> alert tests.

## Web application — first usable product surface implemented

The Next.js application now has a real landing page and dashboard rather than the original placeholder cards. A user can connect a Stacks wallet or enter a public address, refresh indexing, inspect portfolio/risk state, review normalized positions, run built-in or custom stress scenarios, create in-app alert rules and view the configured on-chain risk policy.

The dashboard is wired to the same API used by the rest of the system. It is not populated with demo-only state. When a wallet has not been indexed yet, the UI makes that explicit and lets the user queue the first scan.

## Realtime, policies and alerts — working beta path

The realtime service now subscribes to the Redis `rivisk.realtime` channel and broadcasts events into address-scoped Socket.IO rooms. The indexer publishes portfolio updates; the risk worker publishes risk updates; the alert worker publishes local-alert and on-chain-policy breach events. The web client invalidates only the relevant React Query data when those events arrive.

The API now exposes address-scoped in-app alert rules and read-only on-chain policy lookup. Alert evaluation is edge-triggered: a rule fires when a metric crosses into the breached side rather than on every subsequent snapshot while the breach remains active.

`risk-policy.clar` is now part of the live application path through a shared `RiskPolicyReader`. When `RISK_POLICY_CONTRACT` is configured, the worker evaluates the wallet-owned maximum risk score, minimum health factor, maximum protocol concentration and minimum liquidity score after each risk snapshot. Policy breaches are persisted separately and sent to connected dashboards.

Still remaining:

- authenticated users and wallet-signature login;
- email and signed developer-webhook delivery;
- browser transaction flow for writing/updating `risk-policy.clar`;
- notification preference/cooldown controls beyond edge-triggering;
- Chainhook-driven incremental refresh for lending position changes;
- production notification retries/observability.

## What "enterprise-ready" means right now

Rivisk now has a real multi-adapter data path and the first lending stress model. Enterprise-ready still does not mean "finished".

Before a public/mainnet launch we still need at least:

- clean install/typecheck/test/build in CI;
- committed Prisma migration;
- Docker-backed integration tests;
- Zest live-position validation;
- Chainhook incremental indexing and reorg handling;
- production authentication/API-key handling;
- signed webhook delivery;
- authenticated alert delivery, preferences and cooldown controls;
- production observability and SLOs;
- secret-manager-backed publisher key;
- contract testnet deployment and soak testing;
- threat review/security testing;
- hosted beta validation.

The Milestone 1 handoff is in [31-milestone-1-implementation.md](./31-milestone-1-implementation.md). The lending/stress implementation is documented in [32-zest-v2-lending-and-stress-engine.md](./32-zest-v2-lending-and-stress-engine.md).


The dashboard/realtime/policy implementation is documented in [33-dashboard-alerts-and-policy-evaluation.md](./33-dashboard-alerts-and-policy-evaluation.md).

## Production deployment path — tested locally (2026-09-21)

`infrastructure/deploy/` (one image, Docker Compose, Caddy for HTTPS) was run end to end on a local Docker host with the production compose file:

- all eight services healthy; migrations applied by the one-off `migrate` step, and a second `up` applied nothing and kept the data;
- only ports 80/443 published; Postgres and Redis unreachable from the host;
- HTTPS through Caddy, HTTP → HTTPS redirect, CORS allows only `WEB_URL`, Chainhook routes reject a missing token;
- the full smoke test (sign-in, API keys, webhooks, alerts, permission boundaries) passed through the proxy;
- **realtime verified for the first time:** a WSS subscriber received `portfolio.updated` 2.9 s after a refresh of a real testnet wallet, followed by `risk.updated`.

**Deployed 2026-09-22** to AWS EC2 (eu-north-1, t3.small) with the web app on Vercel (`rivisk-lilac.vercel.app`). Attestation publishing is on, and the Chainhooks 2.0 hooks for `risk-registry` and `risk-policy` are registered on testnet: a fresh attestation had its on-chain snapshot id recorded 11 s after the refresh.
