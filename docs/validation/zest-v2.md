# Zest V2 adapter — live validation

**Date:** 2026-09-20 · **Network:** Stacks mainnet · **Deployer:** `SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7`

Reproduce with:

```bash
pnpm --filter @rivisk/adapter-zest-v2 validate:live SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3
```

## Why this document exists

The adapter had unit tests and they passed. The first time it was pointed at a
real position it threw, because every fixture had been written from the same
misunderstanding as the code. This page records the comparison against the
protocol's own numbers, so "Rivisk reproduces Zest" is a checked claim rather
than an asserted one.

## Subject

`SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3`, Zest obligation `762`: sBTC
collateral against a USDC borrow.

Ground truth comes from the contracts' own print events in transaction
[`0x3d62373075…`](https://explorer.hiro.so/txid/0x3d62373075fe0252b9ea6320ca34774604dfd138607f666595dab1370a1fa19a)
(a `borrow` at block **9031697**), because Zest exposes no read-only function
that returns a position's USD valuation — the valuation only appears in events.

## Result

### Debt

| Quantity | Source | Value |
| --- | --- | --- |
| Scaled debt @ 9031697 | `v0-market-vault` print, `updated-scaled-debt` | `175245193737` |
| Scaled debt read by Rivisk | `get-position` | `175245193737` ✅ exact |
| Borrow index @ 9031697 | `v0-8-market` print, `borrow-index` | `1010660706649` |
| Rivisk debt, reconstructed @ 9031697 | `scaled × index / 1e12` | **177,113.431339 USDC** |
| Zest `position-debt-usd` @ 9031697 | `v0-8-market` print | **$177,086.887349** |
| Ratio | | **0.99985013** |

That ratio is the USDC oracle price, not an error: Rivisk reports a *token
amount* and Zest reports *USD*. The two agree to eight significant figures once
the unit difference is accounted for.

A live read 394 blocks (71.6 min) later gave `177,114.126530 USDC`, i.e. growth
of 0.000393%, an implied borrow APR of **2.88%** — consistent with a USDC
lending market.

> Comparing Rivisk's token amount directly against Zest's USD figure implies a
> ~113% APR and looks like a serious bug. It is the unit mismatch. Worth knowing
> before anyone re-runs this and panics.

### Collateral

| Quantity | Source | Value |
| --- | --- | --- |
| zToken shares | `get-position`, asset `3` (`v0-vault-sbtc`) | `370146481` |
| Underlying after `convert-to-assets` | Rivisk | `370352662` (3.70352662 sBTC) |
| Zest `position-collateral-usd` @ 9031697 | `v0-8-market` print | $297,199.33 |
| Implied sBTC price | | $80,248 |
| BTC spot at time of check (72 min later) | CoinGecko | $80,443 (+0.24%) |

The share-to-underlying ratio (1.000557) comes from the vault's own
`convert-to-assets`, so it is correct by construction; what this confirms is
that Rivisk applies it to the right asset and the right amount.

### Risk parameters

Read straight from the position's risk group, not hardcoded:

| Parameter | Value |
| --- | --- |
| Borrow LTV | 6000 bps |
| Partial liquidation LTV | 7000 bps |
| Full liquidation LTV | 7500 bps |
| Liquidation penalty | 750–1000 bps |

Zest's own LTV at 9031697 was **59.59%**, against a 60% borrow cap — this
position was at the edge of its borrowing limit, which is why the `borrow` in
the sample transaction is the last one it could make.

## The bug this found

`getAsset` failed for asset ids 0, 2 and 6 (STX, sBTC, USDC) — the three assets
that matter most — while succeeding for their zToken ids.

The cause was in Clarity decoding. `cvToJSON` reports a node's type as the whole
recursive signature:

```
(tuple (addr principal) (decimals uint) (id (buff 1))
       (oracle (tuple (callcode (optional none)) (ident (buff 32)) ...)))
```

The decoder matched that string with `includes('optional')` and
`includes('none')`, so a tuple containing an empty optional *anywhere inside it*
was read as Clarity `none` and discarded. STX, sBTC and USDC all carry
`(callcode (optional none))`; their zTokens carry `(optional (buff 1))`, which is
why those worked and made the failure look asset-specific.

Three packages had their own copy of this logic — `adapter-zest-v2`,
`adapter-bitpay`, and `rivisk-contracts`, where the check was
`if (type.includes('none')) return null` and would have nulled any risk-policy
tuple holding an empty optional.

All three now use `unwrapClarity` from `@rivisk/stacks`, which anchors kind
detection to the leading constructor and decides emptiness from the value being
null. Covered by `packages/stacks/src/clarity.test.ts`, including the exact
Zest asset shape.

## Not yet validated

- **Prices are Zest's, not Rivisk's.** This compares position *quantities* and
  debt accounting. Rivisk marks to its own oracle, so its USD figures and
  liquidation distances will differ from Zest's screen by the spread between the
  two price sources. That difference is a product decision, and it is not
  measured here.
- **One position, one asset pair.** sBTC collateral against USDC debt. Multi-
  collateral positions, other assets, and positions in liquidation are untested
  against live data.
- **No historical reads.** The adapter reads the current tip; the comparison
  above reconstructs the older block arithmetically rather than querying at that
  tip.
