# Testing Strategy

Rivisk needs more than one kind of test because different failures matter at different layers.

## 1. Pure unit tests

Best suited for:

- risk formulas;
- concentration;
- price shocks;
- fixed-point conversion;
- canonical report serialization;
- alert rule evaluation;
- portfolio aggregation.

These tests should be fast, deterministic and have no network/database dependency.

For financial calculations, include exact boundary cases rather than only normal values.

Example health factor cases:

```text
11999 -> critical
12000 -> elevated
14999 -> elevated
15000 -> moderate
19999 -> moderate
20000 -> healthy
undefined -> unknown
```

## 2. Adapter tests

Each adapter should have fixtures representing real protocol structures.

Test:

- no position;
- one position;
- several positions;
- cancelled/closed position;
- zero balance;
- partial vesting/withdrawal;
- malformed or missing upstream data;
- correct source/exactness metadata.

The output assertion is the normalized position, not a UI screen.

## 3. Contract tests

Clarinet tests should cover authorization and state transitions.

### Risk registry

- owner can add/remove publisher;
- unauthorized principal cannot publish;
- publisher can publish;
- risk/bps bounds are enforced;
- source block cannot be in the future;
- snapshot ids increment;
- previous snapshots remain readable;
- latest snapshot points to the newest id;
- report hash is stored exactly;
- freshness behavior is correct;
- ownership transfer behaves correctly.

### Risk policy

- user can set policy;
- another user cannot overwrite it;
- value bounds are enforced;
- enable/disable works;
- update height changes.

### Protocol registry

- owner can register;
- duplicate ids fail;
- non-owner cannot register/update;
- enable/disable works;
- adapter version and metadata hash update correctly.

## 4. Database/integration tests

Run PostgreSQL and Redis in containers.

Test workflows such as:

```text
normalized positions
 -> persist latest Position rows
 -> create PositionSnapshot
 -> build PortfolioSnapshot
 -> calculate/save RiskSnapshot
```

Also test transaction behavior around partial failures.

## 5. API tests

NestJS/Supertest should cover:

- validation;
- status codes;
- response envelopes;
- auth/rate limiting;
- stale versus fresh portfolio behavior;
- API-key access;
- error handling;
- Chainhook callback authentication.

## 6. Queue/worker tests

Test jobs for:

- idempotency;
- retry behavior;
- dead-letter/final failure behavior;
- duplicate blockchain events;
- alert de-duplication;
- webhook retry/backoff;
- attestation publication failure.

## 7. End-to-end tests

Playwright can cover the user journeys once the UI exists:

```text
enter wallet
 -> indexing state
 -> portfolio renders
 -> risk metrics render
 -> run BTC -20% scenario
 -> create alert
```

Wallet signing can use a test harness rather than relying on a real browser extension in every CI run.

## 8. Mainnet/testnet smoke tests

A small non-destructive smoke suite can periodically verify:

- Stacks API connectivity;
- configured contract read-only calls;
- known adapter fixture address still parses;
- current block height moves forward;
- no unexpected schema change in upstream payloads.

Do not make every CI run depend on public internet services. Keep deterministic fixtures locally.

## Coverage philosophy

A high coverage percentage does not guarantee correct financial logic. Prioritize tests around:

- boundary conditions;
- money/unit conversion;
- authorization;
- idempotency;
- protocol formula reproduction;
- missing/stale data;
- report hash reproducibility.

## CI gates

A pull request should eventually require:

```text
format check
lint
typecheck
unit tests
contract tests
integration tests
build
security checks
```

Long-running E2E or external smoke tests can run separately if they make normal PR feedback too slow.
