# Event flow

Canonical event names live in `@riskrail/events`.

```text
chain.position.changed
  -> indexer normalizes the affected position
  -> position.updated
  -> portfolio.recalculate.requested
  -> portfolio.updated
  -> risk.recalculate.requested
  -> risk.updated
  -> alert.evaluate.requested
  -> alert.triggered (if threshold crossed)
  -> notification / webhook / websocket
```

Consumers must be idempotent. Event handlers should use stable event IDs derived from chain transaction/event identity or application job IDs.
