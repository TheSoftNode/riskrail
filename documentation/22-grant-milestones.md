# Grant Milestones

> **Baseline as of 23 September 2026.** Rivisk already has a hosted beta, deployed
> testnet contracts, live risk attestations with Chainhook confirmation, a published
> SDK (`@rivisk/sdk`), wallet-signature authentication, API keys, signed
> webhooks, realtime updates and a Zest V2 adapter validated against a real mainnet
> obligation. **These are existing project assets and are not being requested as
> grant-funded deliverables.** Evidence for each is in
> [29-current-status.md](./29-current-status.md) and on
> [rivisk-lilac.vercel.app/docs/status](https://rivisk-lilac.vercel.app/docs/status).

The grant funds the work that turns a working beta into infrastructure other
Stacks projects can depend on: an independent review, real liquidity modelling,
explanations users can act on, and a first external integration.

| Milestone | Focus | Amount | Target |
| --- | --- | --- | --- |
| 1 | Beta hardening and infrastructure review | $2,000 | 14 Oct 2026 |
| 2 | Advanced risk intelligence and AI explanations | $3,000 | 11 Nov 2026 |
| 3 | Ecosystem integration and production readiness | $5,000 | 2 Dec 2026 |

Each milestone leaves behind something demonstrable: a public endpoint, a
written review, a live integration — not "backend work completed".

---

## Milestone 1 — Beta hardening and infrastructure review

**Target:** 14 October 2026 · **$2,000**

### Goal

Put the beta on hosting that does not depend on expiring credits, and make the
parts that already run publicly dependable enough for another team to build
against.

Rivisk's backend already runs on AWS, but on **temporary promotional credits**
taken to make the beta available for this submission. Those credits expire. This
milestone reviews the current single-server design and moves what needs moving
onto a sustainable paid setup — sized for actual usage, not over-engineered for
traffic that does not exist yet.

### Work included

#### Infrastructure

- production architecture review of the current single-server beta, and a written
  decision on what moves and what stays;
- sustainable paid hosting to replace the credit-funded setup;
- persistent database infrastructure with tested backups **and tested restores**,
  rather than a container and a nightly dump;
- monitoring and alerting on the API, indexer, worker, realtime gateway and queue depth;
- a custom domain with certificate renewal under monitoring;
- documented recovery procedure, exercised at least once.

#### Reliability of the attestation path

- publisher key handling through a secret manager;
- retry, nonce and failure handling for broadcast transactions;
- alerting when the publisher balance runs low or a publish fails;
- a reconciliation pass that detects attestations broadcast but never confirmed.

#### Security review preparation

- threat model written down;
- dependency and secret scanning in CI;
- an independent review of the Clarity contracts commissioned (the review itself
  lands in Milestone 3).

### Acceptance criteria

- the API runs on hosting that does not depend on promotional credits, with a
  documented restore that has been tested;
- a deliberately failed publish surfaces an alert and is recovered without manual database edits;
- monitoring dashboards and alert rules are in the repository;
- the threat model and scanning results are public in `documentation/`.

### Evidence

- public endpoint on its own domain;
- restore exercise write-up with timings;
- alert screenshots from the induced failure;
- commissioned review scope and reviewer.

---

## Milestone 2 — Advanced risk intelligence and AI explanations

**Target:** 11 November 2026 · **$3,000**

### Goal

Close two gaps the beta makes obvious: the liquidity score is an accessibility
proxy rather than exit risk, and correct risk numbers are still hard for people
to interpret together.

### Work included

#### Market-depth and exit-risk modelling

- read venue liquidity for the assets Rivisk already values;
- estimate realistic exit size and slippage, rather than "how much is unlocked";
- express the limits of the estimate in the report, in the same conservative style
  as `valuationCoverageBps`;
- keep the current accessibility metric, clearly separated from exit risk.

#### AI risk explanations

The AI **never computes risk**. It reads a finished, deterministic report and
explains it:

```text
protocol data → adapters → risk engine → structured report → AI → explanation
```

not

```text
protocol data → AI → risk score
```

- explain what is driving a wallet's risk, what changed since the previous
  snapshot, and what a stress scenario means, in plain language;
- ground every sentence in fields of the report, so the explanation can be checked
  against the numbers;
- exposed through the API and SDK, so wallets and other Stacks apps get the same
  capability, not just the Rivisk dashboard;
- **cost control by design:** no model call during indexing, scoring, pricing or
  attestation; a call happens only when someone asks for an explanation; answers
  are cached by `reportHash` plus question type; a small, low-cost model by
  default; the provider is replaceable; the core API keeps working with the
  explainer disabled;
- **nothing from the model is ever hashed or published on chain.** Attestations
  stay fully deterministic.
- an explicit **$200–$300** of this milestone covers model evaluation and beta usage.

### Acceptance criteria

- exit-risk estimates published for the supported assets, with the methodology and
  its limits documented;
- explanations available through the API, SDK and dashboard, each traceable to
  fields of the report;
- an explanation for an unchanged report is served from cache, demonstrated by
  request counts;
- the whole stack passes its checks with the explainer turned off.

### Evidence

- before/after comparison of accessibility versus exit risk on a real wallet;
- worked examples of explanations beside the reports they describe;
- cache-hit measurements and a model-cost estimate per active wallet.

---

## Milestone 3 — Ecosystem integration and production readiness

**Target:** 2 December 2026 · **$5,000**

### Goal

Prove Rivisk is infrastructure by having something outside Rivisk depend on it,
and **prepare and — subject to the review finding no blocking issues — deploy the
reviewed Rivisk contracts to Stacks mainnet.**

### Work included

#### External integration

- one real Stacks project consuming Rivisk, through the REST API, the SDK or the
  `risk-provider-trait` on chain;
- integration support and the API changes their use exposes;
- a public write-up of what they built and what it needed.

#### Independent review and the path to mainnet

```text
current testnet deployment (beta v1)
        ↓
independent contract / security review
        ↓
fix findings, improve the design where needed
        ↓
redeploy the revised contracts to testnet if the code changed
        ↓
re-run contract and integration validation
        ↓
mainnet deployment if no blocking finding remains
```

- security and readiness review of the Clarity contracts delivered;
- findings triaged, fixed and re-reviewed where they affect the contracts;
- a Clarity contract cannot be edited in place, so any change means a new
  deployment: the revised version is validated on testnet exactly as v1 was,
  including the external-consumer path;
- mainnet release is driven by **the review, not the calendar**.

#### Production readiness

- published API terms, rate limits and support expectations;
- versioning and deprecation policy for the API and SDK;
- usage metrics and a public status page;
- external developer testing round with feedback folded into the SDK.

### Acceptance criteria

- a third party's integration is live and documented;
- the review report is public, with each finding's resolution;
- any contract change the review calls for is tested and redeployed to **testnet**
  before mainnet, and revalidated there;
- the reviewed contracts are deployed to Stacks **mainnet** if no blocking security
  issue remains, with transactions, addresses and integration documentation published;
- if a blocking issue prevents the mainnet release, the finding and its remediation
  are documented rather than shipping an unsafe contract to meet a date;
- terms, limits and versioning are published.

### Evidence

- link to the integrating project and its write-up;
- the review report and the fixes;
- usage metrics from the beta period;
- transaction record if mainnet deployment proceeds.

---

## Budget framing

| Milestone | Engineering | Infrastructure and external costs | Total |
| --- | --- | --- | --- |
| 1 | $1,100 architecture and hardening | $600 hosting · $300 monitoring and backups | $2,000 |
| 2 | $2,300 risk depth and AI implementation | $200 model usage · $500 market data and testing | $3,000 |
| 3 | $2,200 integration and release work | $1,200 independent review · $1,100 production infrastructure · $500 validation and docs | $5,000 |

Infrastructure is a line item rather than an afterthought because the beta's
hosting is currently covered by temporary AWS credits. When they expire, the API,
indexer, worker, realtime gateway, Redis and the database all still have to run.

The amounts are weighted towards the end because that is where the work that
makes Rivisk dependable sits: the review, the external integration and the
production commitments. Nothing in this plan pays for what already exists.
