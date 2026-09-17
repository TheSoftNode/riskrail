# Users and Use Cases

RiskRail is easier to design when we keep the actual user questions in view. A technically elegant risk engine is not useful if the interface cannot answer the basic question somebody came with.

## Persona 1 — Active sBTC user

This user holds sBTC, keeps part of it in a wallet, and deploys part of it into Stacks applications. They are comfortable signing transactions but do not want to manually calculate portfolio exposure in a spreadsheet.

Typical questions:

- Where is my sBTC right now?
- How much is directly spendable?
- What is locked, vesting, supplied or collateralized?
- Which protocol represents my biggest dependency?
- What happens if BTC drops quickly?

Primary flow:

1. enter or connect a Stacks address;
2. RiskRail indexes the address;
3. the overview shows direct balances and protocol positions;
4. the user opens a position to see the source data and risk details;
5. the user runs a stress scenario;
6. the user optionally creates an alert or signs an on-chain policy.

## Persona 2 — Borrower / collateral user

This user has a lending position and cares most about health factor and liquidation risk.

Typical questions:

- What is the current health factor?
- How far is the position from the protocol liquidation threshold?
- Which asset price is driving that risk?
- Under a -10%, -20% or -30% BTC move, what does the position look like?
- Has the position moved into a more dangerous range since I last checked?

For this user, accuracy is more important than visual complexity. RiskRail should show the protocol-native parameters that went into the calculation and make it clear whether a value was read directly or calculated.

## Persona 3 — Treasury operator

A DAO or project treasury often has a different problem. Liquidation may matter, but concentration and operational visibility matter just as much.

Typical questions:

- How much of our treasury is exposed to one protocol?
- How much is held directly versus committed to contracts?
- What part of the treasury can be accessed immediately?
- Can we export or query the same information programmatically?
- Can our internal monitoring receive a webhook when a threshold is crossed?

This is where historical snapshots, webhooks and the API become more important than the retail dashboard alone.

## Persona 4 — Wallet developer

A wallet team does not necessarily want to build and maintain a protocol indexer, collateral formulas, stress scenarios and risk history.

Typical needs:

- `GET` a portfolio for an address;
- display a small risk summary inside the wallet;
- show which positions are locked or committed;
- receive updates when risk changes materially;
- link a user to a deeper RiskRail view when needed.

The SDK and webhooks exist primarily for this kind of integration.

## Persona 5 — Protocol developer

A protocol may want portfolio-level context that it cannot observe from its own contract alone.

For example, a lending application could eventually read a recent RiskRail attestation or call the API to understand cross-protocol concentration. We should be careful not to make RiskRail an oracle that protocols blindly trust for safety-critical decisions, but the data can still be useful as an additional signal.

## Persona 6 — Analyst / ecosystem observer

Later versions may expose aggregated, privacy-conscious market health information such as:

- total monitored collateral;
- distribution of health-factor ranges;
- capital concentration by protocol;
- broad liquidity conditions;
- growth of sBTC deployment across supported integrations.

This is not a milestone-one feature, but the snapshot model keeps the door open.

## Key user journeys

### Journey A — Analyze a wallet without logging in

The user enters `SP...` or `ST...`. RiskRail validates the principal, returns a job/freshness state if indexing is needed, and then presents the normalized portfolio.

No signature is required for public blockchain analysis.

### Journey B — Connect a wallet and save monitoring preferences

The user connects a supported Stacks wallet, signs an authentication challenge, and can save alerts and monitored addresses. Authentication must use a nonce/challenge flow; a wallet connection alone is not proof that the backend should trust a session.

### Journey C — Run a stress test

The user opens the stress screen and selects a predefined scenario such as `BTC -20%`. RiskRail creates a simulated copy of relevant valuation inputs, recalculates supported metrics and returns the difference between current and stressed state.

No real transaction is created.

### Journey D — Configure an alert

The user chooses a metric, operator, threshold and notification channel. RiskRail stores the off-chain rule, or the user can choose to publish a small policy through `risk-policy.clar` where supported.

The alert worker evaluates the policy when new portfolio/risk data arrives.

### Journey E — Verify an attestation

A user opens a published snapshot and sees:

- source block;
- publication block;
- report hash;
- on-chain snapshot id;
- transaction id;
- the full off-chain report.

The interface canonicalizes and hashes the report again. A matching hash confirms that the report being shown corresponds to what RiskRail committed on-chain.

### Journey F — Developer integration

A developer creates an API key, uses `@riskrail/sdk`, calls the portfolio and risk endpoints, then registers a signed webhook for material updates.

The developer should not need to understand Chainhook internals to use RiskRail.
