# Consuming Rivisk On-Chain

For Clarity developers integrating Rivisk into another Stacks contract.

The REST API and SDK return the full risk picture. This page is about the small
trusted core a *contract* can act on: `risk-registry.clar`, reached through
`risk-provider-trait`.

## The two rules

Everything else on this page is detail. These two are not.

### 1. A reading has an age

`get-latest-health-factor` will cheerfully hand back a number published four
hundred blocks ago, derived from chain state older still. Acting on it is how a
protocol liquidates someone on stale data.

Use `get-risk-if-fresh`, which returns `none` instead of a stale reading:

```clarity
(define-public (open-position (provider <risk-provider>) (user principal))
  (let (
    (risk (unwrap!
            (try! (contract-call? provider get-risk-if-fresh user u144))
            ERR_NO_FRESH_RISK))
  )
    (asserts! (>= (get health-factor-e4 risk) u12500) ERR_UNHEALTHY)
    (ok true)
  )
)
```

The freshness check cannot be forgotten, because there is no way to get the
value without passing it.

### How long is 144 blocks?

Not a day. Freshness is measured in **Stacks blocks**, and since Nakamoto they
arrive every few seconds rather than every ten minutes. On testnet on
2026-09-21 we measured **9.6 seconds per block**, so:

| Window | Blocks at ~9.6s |
| --- | --- |
| 5 minutes | ~31 |
| 1 hour | ~375 |
| 1 day | ~9,000 |

`u144` is therefore about **23 minutes**. Pick the bound from how stale a
reading your product can tolerate, then convert, and re-measure the block time
on the network you target. A snapshot is only refreshed when its wallet is
re-indexed, so a tight window also needs frequent indexing (or Chainhook
triggers) to stay satisfiable.

The example consumer's source comment calls `u144` "roughly a day". That
comment was written for pre-Nakamoto block times and is wrong; it is left in the
repository only because the repo copy must match the deployed contract.

### 2. A debt-free wallet publishes the *safest* values, not zero

A wallet with no borrowings has no meaningful health factor. It is published as
the maximum uint, and its liquidation distance as `u10000`.

This is a deliberate choice. Had "no debt" been published as `u0`, this check:

```clarity
(>= (get health-factor-e4 risk) u12500)
```

would read a wallet with zero debt as the most dangerous position on the chain,
and refuse it. With the sentinel, the naive comparison is the correct one.

Compare against the constant rather than pasting the literal:

```clarity
(contract-call? .risk-registry get-unbounded-health-factor)
```

If you need to *distinguish* "no debt" from "very healthy", compare against that
value explicitly. Most consumers do not need to.

## Units

All unsigned, all fixed-point.

| Field | Range | Reading |
| --- | --- | --- |
| `risk-score-bps` | 0–10000 | 10000 = maximum risk |
| `health-factor-e4` | — | `u14700` = 1.47; max uint = no debt |
| `liquidation-distance-bps` | 0–10000 | 10000 = furthest / no debt |
| `protocol-concentration-bps` | 0–10000 | largest single-protocol share |
| `liquidity-score-bps` | 0–10000 | 10000 = most accessible |
| `source-block` | — | block the underlying state was read at |
| `published-at` | — | block the attestation was written at |
| `report-hash` | `(buff 32)` | SHA-256 of the canonical JSON report |

`source-block` and `published-at` are different numbers and the gap matters:
freshness is measured from `published-at`, but the data describes
`source-block`. A snapshot published this block may still describe state from
twenty blocks ago.

## The interface

`get-latest-risk` returns everything from one snapshot in a single call —
cheaper than five separate reads and guaranteed to be internally consistent.
`get-risk-if-fresh` is the same, gated on age. Single-field getters exist for
consumers that need exactly one number and are handling freshness themselves.

`is-snapshot-fresh` answers the age question on its own, for a contract that
wants to branch on it rather than fail.

## Taking the provider as an argument

Accept a `<risk-provider>` rather than hardcoding the registry address:

```clarity
(use-trait risk-provider .risk-provider-trait.risk-provider-trait)
```

The same code then works against a test double in your own suite, against a
future registry version, and against any other conforming provider. It also
means your tests do not need Rivisk deployed.

## The read-only limitation

Clarity will not let a `define-read-only` function dispatch on a trait — the
analyzer cannot prove a dynamically resolved callee is read-only, so the whole
function is treated as writing. You hit this the moment you try to build a
"would this be allowed?" preview.

Split it. Rivisk's `get-risk-if-fresh` *is* read-only, so call the registry
directly from your read-only function or your UI, then apply thresholds with a
pure helper:

```clarity
(define-read-only (meets-policy (health-factor-e4 uint) (concentration-bps uint))
  (and (>= health-factor-e4 MIN_HEALTH_FACTOR_E4)
       (<= concentration-bps MAX_CONCENTRATION_BPS))
)
```

## Verifying a report

`report-hash` is the SHA-256 of the canonical JSON risk report. Fetch the report
from the API, canonicalize, hash, and compare. Matching proves the report you
are reading is the one that was attested, and that nothing was edited after
publication.

Recording the hash alongside a decision means the decision can be audited later
against the exact data it was made from. The example consumer does this.

## What the registry does not tell you

- **Whether the numbers are right.** It attests what Rivisk computed, and that
  it has not been altered since. Publishers are authorized principals; the trust
  model is "Rivisk said this at this block", not "this is objectively true".
- **Whether a protocol endorses Rivisk.** `protocol-registry.clar` records
  which protocols Rivisk has an adapter for. Nothing more. See the header
  comment in that contract.
- **Anything Rivisk's own oracle disagrees with.** Rivisk marks to its own
  price source, so its USD figures and liquidation distances will differ from a
  protocol's own screen by the spread between the two.

## Worked example

`contracts/examples/risk-consumer-example.clar` is a working consumer, exercised
by `contracts/tests/external-consumption.test.ts`. It is reference material
rather than part of the protocol, and it demonstrates the guardrail pattern,
freshness refusal, the sentinel behaviour and the read-only split.
