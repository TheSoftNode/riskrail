# Architecture overview

```text
Stacks Network
   |   | Stacks API
   | Chainhook
   v
Indexer -> protocol adapters -> normalized positions -> PostgreSQL
                                                 |
                                                 v
                                           BullMQ events
                                           /          \
                                  portfolio worker   risk worker
                                         |               |
                                         +-------> risk engine
                                                   /   |   \
                                                API  alerts realtime
                                                 |            |
                                                 +------> Next.js

Risk Engine -> canonical report -> SHA-256 -> publisher worker -> risk-registry.clar
```

## Trust boundaries

1. Blockchain and external protocol data are untrusted inputs until validated.
2. Protocol adapters must never hold signing keys.
3. The public API does not hold the risk-publisher key.
4. The risk engine is pure and does not perform network/database access.
5. The on-chain registry stores concise attestations, not sensitive user data or full reports.

## Scaling path

The grant MVP uses PostgreSQL + Redis/BullMQ. If event volume later requires Kafka, the event schemas in `@riskrail/events` become the compatibility boundary. Applications should not publish arbitrary queue payloads outside those schemas.
