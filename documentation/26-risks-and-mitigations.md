# Project Risks and Mitigations

This document covers product and engineering risks, not market predictions.

## 1. Protocol data is inconsistent or incomplete

### Risk

Different protocols expose positions differently. Some values may require multiple reads or off-chain indexing.

### Mitigation

- adapter boundary;
- explicit `exact`/estimated metadata;
- protocol-specific methodology docs;
- partial portfolio status;
- do not silently treat failed integrations as zero.

## 2. Risk calculations are wrong

### Risk

A formula bug can produce misleading risk information.

### Mitigation

- pure risk-engine functions;
- boundary tests;
- compare against protocol-native values;
- fixtures from real positions;
- methodology versioning;
- code review for formula changes;
- show source inputs in the product.

## 3. Price data is stale or manipulated

### Mitigation

- source/timestamp every price;
- stale-price threshold;
- sanity checks;
- multiple providers where justified;
- avoid publishing a fresh-looking risk snapshot with stale prices;
- surface warnings.

## 4. Chainhook event is missed

### Mitigation

- periodic reconciliation/polling for monitored wallets;
- block checkpoints;
- backfill jobs;
- indexer lag monitoring;
- event delivery metrics.

## 5. Duplicate event causes duplicate state/alert

### Mitigation

- stable event ids;
- idempotent processors;
- unique constraints where appropriate;
- edge-triggered alerts.

## 6. Stacks reorg changes source state

### Mitigation

- save block hashes;
- define confirmation policy;
- re-read recent canonical blocks;
- invalidate/rebuild affected snapshots;
- avoid irreversible off-chain assumptions from unconfirmed events.

## 7. Publisher key is compromised

### Mitigation

- isolated publisher process;
- secret manager;
- monitoring publication behavior;
- owner can revoke publisher;
- separate admin key;
- future multisig/governance for high-value production use.

## 8. Too much scope for ten weeks

### Mitigation

- only 2–3 position sources initially;
- one strong external lending integration;
- defer advanced quantitative models;
- use existing Stacks/BitPay experience;
- focus milestone acceptance criteria on demonstrable outcomes.

## 9. Low beta adoption

### Mitigation

- API/SDK from the start;
- integrate with existing Stacks projects rather than only seeking retail users;
- demo with real public positions;
- recruit external developers before milestone 3;
- capture feedback explicitly.

## 10. Smart contracts add complexity without value

### Mitigation

Keep contract responsibilities narrow:

- report hash/summary registry;
- user policy;
- protocol registry;
- composable trait.

Do not move the analytics engine on-chain merely to increase contract code.

## 11. Composite score is misunderstood

### Mitigation

- keep individual metrics visible;
- publish methodology;
- version the score;
- avoid marketing the score as a guarantee;
- allow integrations to consume raw metrics instead.

## 12. Upstream API dependency

### Mitigation

- caching;
- retries with limits;
- timeouts;
- provider abstraction;
- fallback endpoints where practical;
- store enough indexed state to serve recent data during a temporary outage.

## 13. Database growth

### Mitigation

- indexes on time-series access patterns;
- retention/rollup plan later;
- avoid storing duplicate raw payloads indefinitely;
- partition/archive only when measured volume calls for it.

## 14. Webhook abuse / SSRF

### Mitigation

When external users can register webhook URLs:

- validate allowed URL schemes;
- block local/private metadata ranges;
- control redirects;
- set strict timeouts/body limits;
- use a dedicated delivery worker/network policy;
- sign all events.

## 15. Documentation drifts from code

### Mitigation

- current-status page;
- docs updated in feature PRs;
- do not state planned features as shipped;
- version important public methodology.
