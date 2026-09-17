# API, SDK and Webhooks

RiskRail is meant to be useful as infrastructure, not only as a website. The API and SDK therefore need to be treated as product surfaces from the beginning.

## Versioning

Public routes live under:

```text
/api/v1
```

Breaking response changes should not be slipped into v1 without a compatibility plan.

## Initial resource model

A clean REST shape looks like:

```text
GET  /api/v1/wallets/{address}
GET  /api/v1/portfolios/{address}
GET  /api/v1/portfolios/{address}/positions
GET  /api/v1/portfolios/{address}/risk
GET  /api/v1/protocols
POST /api/v1/simulations
GET  /api/v1/simulations/{id}
POST /api/v1/alerts
GET  /api/v1/alerts
POST /api/v1/webhooks
GET  /api/v1/webhooks
POST /api/v1/api-keys
```

The exact route list will evolve as implementation starts, but resource naming should stay consistent.

## Response envelope

A useful common response shape:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "timestamp": "...",
    "sourceBlock": 123456,
    "freshness": "fresh"
  }
}
```

Error shape:

```json
{
  "error": {
    "code": "PORTFOLIO_NOT_FOUND",
    "message": "Portfolio was not found.",
    "requestId": "req_..."
  }
}
```

Do not expose stack traces in production responses.

## Freshness is part of the API

A portfolio response should eventually make stale/partial data visible.

Useful metadata:

- source block;
- indexed at;
- current known tip;
- integrations indexed successfully;
- integrations stale/failed;
- valuation coverage.

A financial dashboard should not hide that data behind a spinner forever.

## Authentication modes

### Public read-only analysis

No account required for ordinary public blockchain reads, subject to rate limits.

### User session

Wallet challenge/nonce authentication for saved alerts, preferences and account-linked actions.

### Developer API keys

Keys should have an identifiable prefix, for example:

```text
rr_test_...
rr_live_...
```

Only a hash of the secret portion is stored. The complete key is shown once.

Future scopes might include:

```text
portfolio:read
risk:read
simulation:write
alerts:write
webhooks:write
```

## OpenAPI

NestJS Swagger/OpenAPI should be generated from the actual controllers/DTOs. It becomes the source for interactive docs and, if we choose, SDK type generation.

Examples need to use realistic Stacks addresses and units.

## TypeScript SDK

The SDK should be a thin typed client, roughly:

```ts
const riskrail = new RiskRail({ apiKey: process.env.RISKRAIL_API_KEY });

const portfolio = await riskrail.portfolios.get('SP...');
const risk = await riskrail.risk.get('SP...');
const simulation = await riskrail.simulations.run('SP...', {
  shocks: [{ assetId: 'BTC', changeBps: -2000 }]
});
```

Business logic stays on the server/domain packages. The SDK handles:

- base URL;
- authentication;
- request ids;
- retries for safe reads;
- typed request/response models;
- errors.

## Webhook events

Useful initial events:

```text
position.updated
portfolio.updated
risk.updated
risk.threshold_crossed
attestation.published
```

Payloads should include event version, unique event id and creation time.

## Signing webhooks

A delivery can include headers such as:

```text
X-RiskRail-Event-Id
X-RiskRail-Timestamp
X-RiskRail-Signature
```

The signature can be an HMAC over a defined byte string using the endpoint secret.

Verification documentation must specify exactly what is signed. Ambiguous webhook signature schemes are hard for developers to implement safely.

## Retries

Retry on transient network/5xx failures with exponential backoff. Do not retry forever.

A delivery table should record:

- endpoint;
- event id;
- attempt;
- status code;
- error category;
- timestamps.

Developers need a way to inspect and replay failed deliveries later.

## Rate limiting

Rate limits should exist at least by IP and developer key. Heavy operations such as new wallet indexing or large simulations may need stricter quotas than cached reads.
