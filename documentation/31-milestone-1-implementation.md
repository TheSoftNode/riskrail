# Milestone 1 Implementation Notes

This document explains what changed in the first real implementation pass after the initial RiskRail scaffold. It is written as a handoff note for anyone opening the repository and asking, "what actually works now?"

The short version is that RiskRail now has a complete first data path:

```text
wallet address
    ↓
portfolio refresh job
    ↓
Stacks + protocol reads
    ↓
normalized positions
    ↓
USD valuation
    ↓
PostgreSQL portfolio snapshot
    ↓
risk calculation job
    ↓
canonical risk report + SHA-256 hash
    ↓
PostgreSQL risk snapshot
    ↓
optional risk-registry transaction
```

It is still an MVP path. It is deliberately built so we can make each stage more sophisticated without changing the responsibilities of the stages around it.

## Why the first implementation starts with asynchronous refresh jobs

It would have been quicker to make the API call Hiro and every protocol directly whenever somebody opened a portfolio page. I chose not to structure it that way.

Blockchain reads, token metadata, protocol calls and market prices can all be slow independently. If the API owns all of that work, one slow provider turns into a slow HTTP request and eventually a timeout. It also makes retries difficult and creates duplicate work when multiple clients request the same address.

Instead, the API accepts a refresh request and puts it onto Redis/BullMQ:

```http
POST /api/v1/portfolios/ST.../refresh
```

The response is `202 Accepted` and contains a correlation ID. The indexer does the expensive work separately. Clients read the latest successfully persisted state through the normal GET endpoint.

This gives us a clean place for retries, backoff, concurrency limits and later deduplication.

## Stacks balances moved to the current v3 API

The first scaffold used the older combined v1 address-balance endpoint because it made the example small. For the real implementation, the Stacks client now prefers the newer principal endpoints:

- STX balance: `/extended/v3/principals/:principal/balances/stx`
- FT balances: `/extended/v3/principals/:principal/balances/ft`

FT results are cursor-paginated, so the client follows the cursor until the full wallet token list is available.

There is still a v1 fallback. This is not the primary path; it only keeps RiskRail usable with an infrastructure provider that has not exposed v3 yet.

## Token metadata is resolved before valuation

A raw Stacks FT balance gives an asset identifier and atomic balance. That is not enough to correctly display or value the token because decimals are token-specific.

RiskRail now looks up SIP-010 metadata using Hiro's token metadata API. The normalized asset contains the resolved symbol and decimal precision.

sBTC has a safe fallback to eight decimals if the metadata endpoint is temporarily unavailable. For an arbitrary unknown token, RiskRail does not invent precision. It marks the metadata/position as not fully exact and does not pretend an incorrect value is trustworthy.

That rule is important throughout this project: missing data is better than false precision.

## The BitPay adapter now reads the actual contract interface

The first adapter already knew how to turn a BitPay stream into a RiskRail position, but it needed a `BitPayReader` implementation.

`StacksBitPayReader` now implements that interface with Stacks read-only contract calls.

For a wallet it reads both:

- `get-sender-streams`
- `get-recipient-streams`

The IDs are deduplicated, then each stream is loaded using:

- `get-stream`
- `get-vested-amount`

From that state RiskRail calculates:

```text
outstanding = total amount - already withdrawn
withdrawable now = vested amount - already withdrawn
accessibility = withdrawable now / outstanding
```

This gives BitPay a useful risk meaning instead of treating a stream as a generic token balance. A user may own economic value that is not completely accessible today, and RiskRail exposes that distinction.

The next improvement is to cache these stream updates from Chainhook events rather than making all read-only calls during every refresh.

## Valuation is separate from protocol adapters

The adapters report positions in protocol-native units. They do not know the current dollar price of BTC or STX.

That separation is intentional.

The oracle package now exposes a small `PriceOracle` interface. The first live implementation uses CoinGecko for BTC/STX/sBTC, and a static implementation exists for deterministic tests and local demos.

The portfolio engine applies those prices with Decimal.js. It produces:

- per-asset USD values;
- per-position USD values;
- portfolio total;
- totals by protocol;
- totals by asset;
- valuation coverage.

Valuation coverage matters because a wallet may hold a SIP-010 token for which RiskRail has no trustworthy price source yet. The API should say that clearly instead of silently treating the portfolio as fully valued.

## Current-position state and history are both kept

The database now treats the `Position` table as the latest state and `PositionSnapshot` as historical observations.

On every wallet refresh:

- positions that still exist are updated;
- newly discovered positions are created;
- positions that disappeared are marked inactive/closed rather than deleted;
- a historical snapshot is added;
- a portfolio snapshot is added.

That is important for future charts and risk history. Deleting a closed lending position would make the present view simpler but destroy the evidence required to explain past risk.

## Correlation IDs tie the pipeline together

Every refresh starts with a UUID correlation ID. It is stored in the `IndexingRun` table and passed into the risk calculation job.

This gives us a useful trace across:

```text
API request -> queue job -> indexer -> database -> risk worker
```

The next observability pass can put the same correlation ID into traces/logs and expose a `/indexing-runs/:id` API.

## Risk calculation is deterministic

The worker reads the normalized positions that were persisted by the indexer and runs the risk package over them.

The current calculations include:

- protocol concentration;
- asset concentration;
- capital accessibility;
- health-factor classification when an adapter provides a health factor;
- an MVP composite score.

The score is deliberately documented and secondary. It currently weights:

- collateral/health risk at 40%;
- protocol concentration risk at 30%;
- capital accessibility risk at 30%.

If there is no collateral position, RiskRail does not invent a health factor. The health component contributes no penalty and the report retains the underlying metrics so a consumer can see exactly what data existed.

The current liquidity score is a capital-accessibility proxy. It is labelled that way in the risk report. It should be replaced/augmented by market-depth and expected-price-impact calculations when DEX/liquidity adapters are introduced.

## Risk reports are canonicalized before hashing

A risk report contains:

- methodology version;
- wallet;
- source block;
- generation time;
- valuation coverage;
- calculated metrics;
- position summary;
- notes describing provisional methodology.

Before hashing, object keys are sorted recursively. This gives RiskRail one repeatable JSON representation rather than relying on whatever object-property insertion order happened to occur in a process.

The canonical JSON is SHA-256 hashed and both the full report and the hash are saved.

This is the evidence that the on-chain attestation commits to.

## On-chain publishing is isolated from the API

The API never receives the RiskRail publisher private key.

When publishing is enabled, the risk worker queues a separate attestation job after the report is persisted. The contracts package constructs the `publish-risk-snapshot` call to `risk-registry.clar` and broadcasts it with Stacks.js.

The publisher is disabled by default:

```env
RISK_PUBLISHER_ENABLED=false
```

To enable it on testnet we still need to:

1. deploy the RiskRail contracts;
2. set `RISK_REGISTRY_CONTRACT`;
3. create/fund a dedicated publisher principal;
4. authorize that principal using `set-publisher` from the contract owner;
5. place the private key in a development secret locally, and a real secret manager in hosted environments;
6. enable the publisher flag.

The current worker stores the broadcast transaction ID. The next version should watch confirmation, read the returned snapshot ID from the event/contract state, and only then mark the attestation confirmed.

## Environment additions

The implementation adds these useful settings:

```env
BITPAY_CORE_CONTRACT=
MONITORED_WALLETS=
INDEXER_CONCURRENCY=4
RISK_WORKER_CONCURRENCY=4
COINGECKO_API_URL=https://api.coingecko.com/api/v3
COINGECKO_API_KEY=
RISK_PUBLISHER_ENABLED=false
RISK_PUBLISHER_SECRET_KEY=
```

`MONITORED_WALLETS` is mainly for a local demo. Normal usage should request wallet refresh through the API.

## What to test locally after applying this update

After installing dependencies and starting PostgreSQL/Redis, generate the Prisma client and migration first:

```bash
pnpm install
pnpm db:generate
pnpm --filter @riskrail/database exec prisma migrate dev --schema prisma/schema.prisma --name milestone1_indexing
```

Then start the workspace:

```bash
pnpm dev
```

Request an index for a valid Stacks testnet address:

```bash
curl -X POST http://localhost:4000/api/v1/portfolios/ST.../refresh
```

Then read the latest portfolio:

```bash
curl http://localhost:4000/api/v1/portfolios/ST...
```

and risk snapshot:

```bash
curl http://localhost:4000/api/v1/portfolios/ST.../risk
```

If `BITPAY_CORE_CONTRACT` points at the deployed BitPay contract, the same refresh will also attempt to discover BitPay streams for that wallet.

## What I would implement next

The next meaningful unit of work is not another generic infrastructure package. It should be the first external lending/collateral adapter because that unlocks the core grant story around liquidation and collateral health.

That pass should add:

1. one real Stacks lending protocol adapter;
2. collateral/debt normalization;
3. health-factor and liquidation-distance formulas validated against the protocol itself;
4. BTC -10/-20/-30% scenario recalculation;
5. API endpoints for simulations;
6. dashboard views for the portfolio and risk report;
7. Chainhook events for incremental updates instead of full reads only.

Once that is working, RiskRail stops being primarily an indexing/attestation foundation and starts demonstrating the full market-risk use case described in the grant proposal.
