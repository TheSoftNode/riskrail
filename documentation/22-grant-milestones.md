# Grant Milestones

The grant delivery plan is designed around three milestones over roughly ten weeks. The milestones are outcome-based: each one should leave behind something demonstrable and testable, not just "backend work completed."

## Milestone 1 — Cross-Protocol Portfolio and Contract Foundation

**Target:** Weeks 1–3

### Goal

Prove that RiskRail can take a Stacks address, discover more than one kind of position, normalize those positions, calculate initial deterministic metrics, and anchor a report hash on Stacks testnet.

### Work included

#### Native Stacks indexing

- validate Stacks principals;
- retrieve STX and fungible-token balances;
- identify sBTC correctly for the configured network;
- resolve token metadata where needed;
- preserve source block/freshness.

#### BitPay adapter

- implement a concrete `BitPayReader` using contract reads/indexed state;
- discover stream ids for a wallet;
- read stream state;
- calculate remaining/withdrawable values;
- emit normalized stream positions;
- respond to relevant contract events.

#### Adapter/normalization foundation

- finalize `ProtocolAdapter` v1;
- finalize `NormalizedPosition` v1;
- adapter registry in the indexer;
- partial-failure behavior;
- fixtures and tests.

#### Portfolio engine

- aggregate positions;
- known USD total;
- by-protocol exposure;
- capital accessibility;
- valuation coverage warnings.

#### Initial risk engine

- protocol concentration;
- capital accessibility;
- health-factor classification infrastructure;
- deterministic report input/output shape.

#### Clarity foundation

- `risk-provider-trait.clar`;
- `risk-registry.clar`;
- `protocol-registry.clar`;
- authorization and history tests;
- testnet deployment configuration.

#### Attestation proof

- canonicalize one risk report;
- hash it;
- publish summary/hash on testnet;
- verify the off-chain report against the contract snapshot.

### Acceptance criteria

Milestone 1 is complete when:

1. a valid Stacks address can be indexed;
2. native wallet assets are represented as normalized positions;
3. BitPay positions can be represented for an address that has streams;
4. at least two position sources can appear in one portfolio;
5. concentration/accessibility calculations pass exact unit tests;
6. a risk report has deterministic serialization/hash behavior;
7. an authorized publisher can create a testnet risk snapshot;
8. the report hash can be verified against that snapshot;
9. all milestone code is documented and reproducible from the repository.

### Evidence

- public repository commits;
- test output;
- testnet transaction/contract principal;
- short screen recording or live demo;
- example report + hash;
- API response showing the normalized portfolio.

---

## Milestone 2 — Risk Product, Stress Testing and User Policies

**Target:** Weeks 4–7

### Goal

Turn the portfolio/indexing foundation into a useful risk product, with real collateral analytics, stress scenarios and alerts.

### Work included

#### External lending/collateral adapter

- choose a Stacks protocol with meaningful sBTC/collateral relevance;
- document contract and calculation sources;
- read supplied/borrowed/collateral state;
- map health/liquidation inputs;
- add fixtures and adapter tests.

#### Collateral risk

- health-factor calculation or validation;
- liquidation threshold/distance where supported;
- exact/estimated source flags;
- methodology documentation.

#### Stress engine

- BTC -10%;
- BTC -20%;
- BTC -30%;
- custom shocks;
- before/after position and portfolio metrics;
- warnings for unsupported scenario dimensions.

#### Dashboard

- address input/wallet connection;
- portfolio summary;
- positions;
- concentration/accessibility;
- collateral health;
- stress-test screen;
- freshness and source details.

#### Alerts

- off-chain alert rules;
- edge-triggered evaluation;
- email/in-app delivery;
- `risk-policy.clar` integration;
- Chainhook event for policy changes.

#### Realtime

- wallet/risk rooms;
- update events after snapshot changes;
- query invalidation/refetch on the frontend.

### Acceptance criteria

Milestone 2 is complete when:

1. a supported lending position displays real collateral metrics;
2. a BTC stress scenario changes those metrics deterministically;
3. the user can compare baseline and stressed states;
4. the user can configure an alert;
5. the user can set an on-chain risk policy;
6. a threshold crossing creates an alert event and at least one notification;
7. the platform does not move user funds to perform any of the above.

### Evidence

- dashboard demo;
- lending adapter tests;
- scenario fixtures;
- on-chain policy transaction;
- alert-event history;
- documentation of the risk formulas.

---

## Milestone 3 — Public Beta and Developer Infrastructure

**Target:** Weeks 8–10

### Goal

Make RiskRail usable by people outside the core team and demonstrate that the same infrastructure can be consumed programmatically.

### Work included

#### Public beta

- hosted web app;
- hosted API;
- PostgreSQL/Redis managed deployment;
- health/monitoring;
- staging/production configuration.

#### REST API

- versioned resources;
- validation/auth/rate limits;
- OpenAPI docs;
- freshness metadata;
- error conventions.

#### TypeScript SDK

- typed client;
- portfolio/risk/simulation resources;
- examples;
- package release or documented local package use.

#### Developer authentication

- API key creation/revocation;
- safe key hashing;
- test/live convention;
- rate-limit identity.

#### Webhooks

- endpoint registration;
- signed events;
- retries/backoff;
- delivery history.

#### External validation

Targets:

- 100+ wallet analyses;
- 25+ recurring monitored wallets;
- 50+ stress simulations;
- 10+ configured alerts;
- 3+ external developers trying API/SDK;
- 1 integration proof of concept.

### Acceptance criteria

Milestone 3 is complete when:

1. a public beta URL is available;
2. developer documentation is public;
3. an external developer can obtain portfolio/risk data;
4. webhooks can be verified using the documented signature method;
5. an external proof-of-concept integration exists;
6. tester feedback and usage metrics are summarized;
7. next-step backlog is documented.

## Budget framing

A reasonable $10,000 grant budget can be described by workstream rather than pretending the numbers represent fixed vendor invoices:

| Workstream | Amount |
| --- | ---: |
| Core indexing and risk engine | $3,000 |
| Protocol integrations | $2,000 |
| Frontend/dashboard | $1,750 |
| Stress testing and alerting | $1,000 |
| API/SDK and developer docs | $750 |
| Testing, security and infrastructure | $750 |
| User testing and ecosystem validation | $750 |
| **Total** | **$10,000** |

A possible milestone payment split is $4,000 / $3,500 / $2,500, but the final application should match the Endowment form and terms.
