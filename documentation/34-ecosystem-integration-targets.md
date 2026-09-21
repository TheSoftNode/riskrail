# Ecosystem Integration Targets

> **Wording rule for this document, and for anything derived from it.**
>
> Every project named here is an **integration target** — a concrete example of
> a product that could consume Rivisk's infrastructure. None of them has
> agreed to integrate Rivisk, and nothing here should be written or spoken as
> if they had. A named partnership we do not have is worth less than nothing: it
> is the kind of claim a reviewer checks, and the kind that ends a grant
> conversation.
>
> If a team does confirm an integration, move it out of this document and into a
> partnerships section, with the confirmation on record.

Project names and descriptions below are taken from the Stacks Endowment's own
funded-projects directory: <https://grants.stacksendowment.co/projects>
(checked 2026-09-20). Quoted text is theirs. Where a row says what Rivisk
could offer, that is our inference and is marked as such.

## Why Rivisk is infrastructure, not a dashboard

The dashboard exists for three reasons: it lets an individual or treasury
inspect their own cross-protocol risk, it proves the underlying engine works,
and it is a reference implementation for builders. It is not the product.

The product is the layer underneath other products:

```
  Wallets   Yield apps   Lending apps   Agents   Treasuries
      |          |             |           |         |
      +----------+------+------+-----------+---------+
                        |
                     Rivisk
                        |
     portfolio discovery, normalized positions, debt-aware
     valuation, collateral health, liquidation risk, stress
     testing, concentration, alerts, API, SDK, attestations
```

A yield router should not have to build position discovery, Zest debt reading,
health-factor maths, liquidation distance, concentration and stress testing in
order to show a user whether a position is safe. It should be able to ask.

## The demand surface

The Endowment's directory spans Q1–Q3 2026. These are the funded projects with a
genuine risk surface.

### Yield and vaults — risk before routing

| Project | Endowment description | What Rivisk could offer (our inference) |
| --- | --- | --- |
| **BitYield** (Q2) | "consumer-grade Bitcoin yield dashboard that lets BTC holders access Stacks yield opportunities" | Position risk, concentration and stress results shown before a user is routed into an opportunity |
| **SatoshiYield** (Q1) | "yield aggregation and vault interface on Stacks" | Per-vault and aggregate exposure, concentration limits, stress scenarios across the vaults a user holds |

### Agentic products — risk as a guardrail

| Project | Endowment description | What Rivisk could offer (our inference) |
| --- | --- | --- |
| **PaySats** (Q2) | "agentic Bitcoin savings account to Stacks, enabling users to DCA into sBTC" | Portfolio health as a precondition for an automated action, and alerting on a position the agent is accumulating into |
| **DeepStack** (Q2) | "Bitcoin-native market-making and liquidity agent for Stacks" | Exposure and concentration as safety inputs for an autonomous agent; market-depth metrics once those are real rather than a proxy |
| **AgentPay** (Q2) | "building a Stacks/sBTC adapter for its existing agent payment infrastructure" | A wallet's risk state as an application-level limit before an agent moves funds |
| **Nayori by PerkOS** (Q2) | "extending its live Stacks agent commerce infrastructure to support sBTC-denominated job escrow" | Counterparty and collateral health checks around escrowed sBTC |

### Execution and liquidity — relevant once market depth is real

| Project | Endowment description | What Rivisk could offer (our inference) |
| --- | --- | --- |
| **Jing Swap RFQ** (Q2) | "CEX-hedged RFQ market-making mechanism for sBTC swaps on Stacks" | Execution and liquidity analytics — genuinely useful only after market-depth work replaces today's capital-accessibility proxy |
| **NightOwl by Bitflow** (Q1) | "CEX/DEX arbitrage processor for the Stacks ecosystem" | Exposure limits and liquidity metrics for an automated strategy |

### Leverage and derivatives — the hardest fit, and the most honest about it

| Project | Endowment description | What Rivisk could offer (our inference) |
| --- | --- | --- |
| **Covault** (Q2) | "fully collateralized, cash-settled European options clearinghouse on Stacks" | Portfolio and treasury risk around the sBTC/STX collateral behind positions. Options risk itself — greeks, payoff at expiry — is **not** something today's lending model covers, and we should not pretend otherwise |
| **FlashStack** (Q1) | "flash loan infrastructure on Stacks to support advanced DeFi use cases" | Post-action portfolio state; within-transaction risk checks are a different problem and we do not solve them today |

### Deliberately not listed

Stretching the list would make the argument look manufactured, and a reviewer
would notice. These funded projects have no natural risk surface for us:
BigMarket (prediction markets), sBTC Escrow, sBTC Pay, Launkr, FlowVault,
HermesBridge, Scaffold Stack, Passkey Onboarding Wallet, ShadowFeed and Privara.
Several are excellent projects; that is not the question.

## The institutional angle

The Endowment has approved working capital for on-chain DeFi deployment — LP
positions, lending and borrowing, looped loans — and has discussed risk-adjusted
yield and treasury management. That is close to Rivisk's treasury-monitoring
use case.

We may say Rivisk is designed for exactly that kind of capital deployment. We
may not say the Endowment will use it.

## How a consumer actually integrates

Two paths, depending on where the decision is made.

**Off-chain** — a dashboard, backend or agent uses the REST API or the
TypeScript SDK and gets the full picture: positions, metrics, stress scenarios,
alert configuration, webhooks.

**On-chain** — a Clarity contract reads the compact attested subset from
`risk-registry.clar` through `risk-provider-trait`. This is a much smaller
surface on purpose: only what another contract can safely act on.

```clarity
;; Checking a wallet across every protocol Rivisk covers, not only your own.
(contract-call? .risk-registry get-risk-if-fresh user u144)
```

See [Consuming Rivisk on-chain](./35-consuming-rivisk-onchain.md) for the
interface, the freshness rule and the no-debt sentinels — the last of which will
silently invert a safety check if ignored.

## What this changes about our priorities

The ordering that follows from "Rivisk is infrastructure":

1. a stable on-chain interface, because a trait cannot be changed after deploy;
2. a stable REST API;
3. the SDK;
4. webhooks and realtime;
5. external integrations;

with the dashboard maintained as a reference implementation rather than the
place new capability lands first.

## Positioning language

For the grant application and public material:

> Rivisk is designed as shared risk infrastructure for the emerging Stacks
> Bitcoin-finance stack. Projects funded by the Stacks Endowment illustrate the
> demand surface: BitYield and SatoshiYield are routing users into Bitcoin yield;
> PaySats is building an agentic sBTC savings account; DeepStack is operating an
> autonomous market-making and liquidity agent; Jing Swap RFQ is improving sBTC
> swap execution; and Covault is building an options clearinghouse on Stacks.
> Rivisk gives products in these categories a common way to query portfolio
> health, concentration, stress scenarios and verifiable risk attestations
> without rebuilding protocol indexing and risk logic themselves. These projects
> are ecosystem integration targets rather than claimed partnerships unless
> separately confirmed.

The final sentence is not optional.

## Corrections log

Earlier drafts of this page carried descriptions that the Endowment's directory
does not support. Recorded here so they do not creep back in:

- **PaySats was described as "sBTC savings and borrowing, integrating
  Zest/Bitflow".** The directory says "agentic Bitcoin savings account…enabling
  users to DCA into sBTC". It mentions no borrowing, no Zest and no Bitflow. The
  borrowing framing made PaySats look like our strongest lending-risk fit when
  the listing does not claim that at all.
- **"Jing"** is listed as **Jing Swap RFQ**, and it is CEX-hedged RFQ
  market-making rather than execution improvement generally.
- **"AgentPay / PerkOS"** are two separate projects. The PerkOS product is
  **Nayori by PerkOS**.
- **Covault** is specifically a "fully collateralized, cash-settled European
  options clearinghouse", not general "Bitcoin-backed options infrastructure".
- An earlier draft named **Vibewatch** and **Degen Labs** as grantees we were
  choosing not to list. Neither appears in the directory.

Sources: [Stacks Endowment funded projects](https://grants.stacksendowment.co/projects) ·
[Q2 2026 Stacks Endowment grantees](https://www.stacks.co/blog/announcing-the-q2-2026-stacks-endowment-grantees) ·
[Stacks Treasury Committee update](https://www.stacks.co/blog/stacks-treasury-committee-december-2025) ·
[Applying for a Stacks Endowment grant](https://www.stacks.co/blog/everything-you-need-to-know-about-applying-for-a-stacks-endowment-grant)
