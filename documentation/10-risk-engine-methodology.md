# Risk Engine Methodology

## Why the risk engine is separate

Rivisk's credibility depends on being able to explain how a number was produced. For that reason, risk math lives in a pure TypeScript package and does not depend on the database, HTTP requests, Chainhook or the UI.

A function should be testable with plain input objects.

## Numeric conventions

### Atomic token amounts

Stored and transported as strings or `bigint`. Never convert a large atomic value to JavaScript `number` and hope it remains exact.

### USD values

Represented as decimal strings in domain objects and calculated with `Decimal.js`.

### Basis points

Percentage-like values often use basis points:

```text
100      = 1.00%
1,000    = 10.00%
4,400    = 44.00%
10,000   = 100.00%
```

### Health factor E4

A health factor can be represented using four decimal places:

```text
10,000 = 1.0000
14,700 = 1.4700
20,000 = 2.0000
```

This convention avoids floating-point ambiguity in persistence/events/contracts.

## Current implemented calculations

The scaffold already contains a small working risk core.

### Protocol concentration

Protocol concentration is now based on **gross exposure**, not net equity. This matters for lending positions: $10,000 of collateral and $6,000 of debt should not look like only $4,000 of protocol exposure.

Conceptually:

```text
protocol gross exposure = sum(abs(valued assets and debt))
protocol share = protocol gross exposure / total gross exposure
```

Rivisk reports the largest share in basis points and can later return the full distribution.

Example:

```text
Wallet/native     $8,000
Protocol A        $12,000
BitPay             $4,000
Total             $24,000
```

Largest protocol share is 50.00%, or `5000` bps.

A critical limitation: concentration is only as good as valuation coverage. If half the positions are unpriced, the interface must say the calculation is based on known value rather than pretending it covers the entire portfolio.

### Capital accessibility

Each position can expose `accessibility.liquidBps`. The engine weights that by position value.

Conceptually:

```text
accessibility = sum(position value * liquid share) / total valued positions
```

A direct wallet position normally has 10,000 bps accessibility. A partially vested stream can be lower.

### Health-factor classification

The current starting thresholds are:

```text
< 1.20        critical
1.20–<1.50    elevated
1.50–<2.00    moderate
>= 2.00       healthy
missing        unknown
```

These labels are a Rivisk presentation convention. The actual liquidation behavior is controlled by the protocol, so the UI must also show protocol-native thresholds and source data.

### Lending LTV and health

The first shared lending calculation is implemented. After an adapter provides collateral/debt assets and the protocol's thresholds, the portfolio engine calculates:

```text
current LTV = debt USD / collateral USD
health factor = partial liquidation LTV / current LTV
```

Health is stored in E4 fixed point. The protocol threshold comes from the adapter; Rivisk does not invent a generic liquidation LTV.

For Zest V2, the adapter reads the applicable egroup values and the common engine performs the arithmetic.

### Liquidation distance

For the current lending model, the estimated collateral-price distance to the partial-liquidation threshold is:

```text
distance = 1 - (current LTV / partial liquidation LTV)
```

For a single-collateral position, Rivisk can also estimate the price at which that threshold would be reached. Multi-collateral positions are treated as portfolio approximations rather than being given a misleading single exact liquidation price.

### Deterministic stress scenarios

The scenario engine applies price changes to a copy of normalized positions and then recalculates lending metrics. It does not stop at changing a display value.

Current presets are BTC -10%, BTC -20%, BTC -30% and STX -20%, with custom multi-asset shocks available through the API. The engine records before/after health and can warn when a position crosses the partial-liquidation threshold.

## Risk components still being expanded

### Liquidity risk

Liquidity needs market-specific data. Useful outputs may include:

- position size / available depth;
- expected exit price impact;
- value executable within a configured slippage bound;
- a normalized liquidity score.

We should not reduce this to a score until the underlying measurable values are trustworthy.

### Asset concentration

Asset concentration is implemented from normalized economic exposure. Wrapped/derivative relationships still need care so the system does not accidentally count the same exposure twice as more adapters are added.

### Composite score

A composite score can eventually summarize several dimensions, for example:

```text
collateral risk       35%
liquidity risk        25%
concentration risk    20%
protocol exposure     20%
```

Those weights are *not* final methodology. Before exposing a composite score publicly we need versioning, documented normalization rules and tests showing what changes the score.

The individual metrics remain the source of truth even if a summary score is added.

## Methodology versioning

Every canonical risk report should identify the risk-engine/methodology version.

Why? Because a snapshot calculated with methodology v1 should remain understandable after v2 changes a threshold or improves liquidity math.

The current risk worker writes `rivisk-v1.1` into canonical reports. The exact scheme can evolve, but an old snapshot must always say which methodology produced it.

## Missing data

Missing data is part of the result, not an implementation embarrassment.

A report can contain warnings such as:

```text
- 18% of discovered token value could not be priced.
- Liquidity metrics unavailable for Protocol X.
- Lending position was last confirmed 14 blocks ago.
```

Rivisk should never turn an unknown into zero just to make a dashboard look complete.
