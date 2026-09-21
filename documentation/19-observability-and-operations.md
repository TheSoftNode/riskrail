# Observability and Operations

Rivisk is a monitoring product, so it would be ironic if the platform itself were hard to monitor.

## Structured logging

Production logs should be JSON and include context fields rather than only prose.

Example:

```json
{
  "service": "rivisk-indexer",
  "level": "info",
  "wallet": "SP...",
  "protocol": "bitpay",
  "blockHeight": 123456,
  "jobId": "...",
  "message": "Position refresh completed"
}
```

Useful common fields:

- service;
- environment;
- request id;
- job id;
- wallet (when appropriate and public);
- protocol id;
- source block;
- event id;
- duration;
- error code.

Never log secrets, API keys, SMTP credentials or publisher private keys.

## Health endpoints

Every hosted service should expose the equivalent of:

```text
/health   process is alive
/ready    dependencies are healthy enough to receive work
/metrics  operational metrics, protected as appropriate
```

Readiness for the API may depend on PostgreSQL/Redis. Readiness for the indexer may also consider upstream Stacks connectivity.

## Metrics

Useful metrics include:

```text
api_request_duration_ms
api_requests_total
indexer_tip_height
indexer_last_processed_height
indexer_lag_blocks
wallet_refresh_duration_ms
adapter_failures_total
risk_calculation_duration_ms
risk_calculations_total
queue_depth
queue_job_failures_total
alerts_triggered_total
webhook_delivery_failures_total
attestation_publish_failures_total
upstream_request_failures_total
```

## Tracing

OpenTelemetry can connect a user request to a refresh job and then to a risk calculation.

A trace might look like:

```text
HTTP GET portfolio
  -> DB read
  -> enqueue refresh
worker refresh job
  -> Stacks API
  -> BitPay adapter
  -> DB write
  -> enqueue risk
risk job
  -> risk engine
  -> DB snapshot
```

Not every span needs to be retained forever; the main goal is making intermittent latency/failure understandable.

## Alerting on Rivisk itself

Operational alerts should include:

- indexer lag above threshold;
- queue backlog growing continuously;
- repeated upstream API failures;
- PostgreSQL/Redis unavailable;
- high API 5xx rate;
- webhook delivery failure spike;
- unexpected publisher transaction frequency;
- service crash loop;
- disk/storage pressure where applicable.

## Runbooks

Before production, create short runbooks for recurring incidents:

- Stacks API unavailable;
- Chainhook callbacks stopped;
- indexer behind tip;
- Redis queue stuck;
- failed database migration;
- publisher key suspected compromised;
- protocol adapter returning invalid data;
- webhook provider/customer endpoint failure.

A runbook should say how to detect the issue, what is safe to restart, what data could be affected and how to recover.

## Data freshness monitoring

Because Rivisk presents financial state, "service is up" is not enough.

We also need to know:

- how old the latest portfolio snapshot is;
- how far its source block is from current tip;
- which adapters are stale;
- how old price data is;
- whether a published attestation is materially older than the current portfolio.

Freshness should be observable internally and exposed to users where relevant.
