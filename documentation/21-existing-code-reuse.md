# Reusing Existing Stacks Work

RiskRail is not being built from a blank page. Two earlier projects, StacksPay and BitPay, already solved several engineering problems that RiskRail also needs to solve.

The goal is not to copy those applications wholesale. The goal is to reuse patterns and small pieces of infrastructure that have already been exercised, while keeping RiskRail's new domain work clearly separate.

## What StacksPay gives us

StacksPay already established useful patterns around:

- Stacks API access;
- wallet/address handling;
- blockchain monitoring;
- Chainhook/event processing;
- API key concepts;
- outbound webhooks;
- Swagger/OpenAPI setup;
- developer SDK organization;
- security middleware;
- backend/frontend separation.

Those are platform concerns, not payment-specific product logic.

### What to reuse conceptually

#### Stacks client and monitoring pattern

The old payment monitor can be reduced into generic chain access and indexing code. RiskRail should not carry concepts such as payment status or merchant settlement into the indexer.

#### Chainhook flow

The useful pattern is:

```text
Stacks event
 -> authenticated callback
 -> durable processing
 -> update application state
```

RiskRail changes the domain action from "update a payment" to "refresh a position and recalculate portfolio risk."

#### API keys and webhooks

StacksPay's developer-facing architecture is useful because RiskRail also needs to serve external applications. The implementation should be reviewed and modernized rather than blindly copied, especially around secret storage and signature details.

#### SDK organization

The earlier SDK pattern can guide `@riskrail/sdk`, but RiskRail endpoints should be designed around its own resources.

## What BitPay gives us

BitPay is more than a code-reuse source. It can be an actual RiskRail protocol integration.

Useful existing concepts include:

- sBTC-aware Clarity code;
- read-only contract functions;
- contract events;
- realtime event patterns;
- stream state;
- treasury/contract administration experience.

## BitPay as an adapter

A BitPay stream contains useful portfolio information:

- total amount;
- withdrawn amount;
- vested amount;
- sender;
- recipient;
- start block;
- end block;
- cancellation state.

RiskRail maps that into a `stream` position and calculates an accessibility ratio.

For example:

```text
total stream      0.050 sBTC
withdrawn         0.010 sBTC
vested            0.025 sBTC

remaining locked  0.040 sBTC
withdrawable now  0.015 sBTC
```

From RiskRail's point of view, this is not a payment screen. It is evidence that 0.040 sBTC remains economically associated with a stream and only part of it is currently accessible.

## What should not be copied

From BitPay:

- marketplace/NFT features;
- payment execution flows;
- custody/vault logic;
- treasury withdrawal governance;
- anything unrelated to observing portfolio state.

From StacksPay:

- merchant checkout;
- payment links;
- settlement workflows;
- order/merchant business logic.

Bringing those into RiskRail would blur the product and make the grant work look like a rename.

## Existing foundation vs new RiskRail work

This distinction should remain clear in grant documentation and commit history.

### Existing foundation/patterns

- Stacks API experience;
- Chainhook experience;
- wallet connectivity;
- sBTC/Clarity experience;
- event-driven backend patterns;
- webhooks/API keys/SDK patterns;
- realtime delivery patterns.

### New RiskRail work

- protocol adapter standard;
- normalized cross-protocol position model;
- portfolio aggregation;
- risk methodology;
- stress scenarios;
- collateral/liquidation analysis;
- risk alert evaluation;
- canonical risk reports;
- on-chain risk registry;
- user-owned on-chain risk policies;
- protocol registry;
- public RiskRail API/SDK.

## Reuse rule of thumb

Before copying code from an older repository, ask:

1. Is this infrastructure or old product logic?
2. Does it fit the current TypeScript/NestJS/monorepo conventions?
3. Are its security assumptions still acceptable?
4. Can it be expressed as a package/interface rather than pasted into an app?
5. Do we have tests that prove the reused behavior still works?

If the answer to those questions is weak, reimplement the small piece cleanly instead of carrying technical debt into the new project.
