# Risk Engine Methodology

## Why the risk engine is separate

RiskRail's credibility depends on being able to explain how a number was produced. For that reason, risk math lives in a pure TypeScript package and does not depend on the database, HTTP requests, Chainhook or the UI.

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

For valued positions, group position value by protocol:

```text
protocol share = protocol value / total known portfolio value
```

RiskRail reports the largest share in basis points and can later return the full distribution.

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

These labels are a RiskRail presentation convention. The actual liquidation behavior is controlled by the protocol, so the UI must also show protocol-native thresholds and source data.

### Generic price shock

The current utility applies a basis-point price change to valued assets:

```text
stressed value = current value * (1 + changeBps / 10,000)
```

This is only the first building block. A real lending stress test must recalculate collateral/debt and protocol health, not just lower a displayed USD value.

## Planned risk components

### Collateral health

Where a protocol exposes a health factor directly, RiskRail can read it and independently validate the formula when practical.

Where it does not, the adapter provides the inputs and the engine calculates according to documented protocol rules.

### Liquidation distance

There is no single universal formula. Depending on the protocol, RiskRail may calculate:

- distance from current health factor to liquidation health factor;
- collateral price at which the threshold is crossed;
- percentage price move from current oracle price to that liquidation price.

The methodology must be stored with the protocol integration.

### Liquidity risk

Liquidity needs market-specific data. Useful outputs may include:

- position size / available depth;
- expected exit price impact;
- value executable within a configured slippage bound;
- a normalized liquidity score.

We should not reduce this to a score until the underlying measurable values are trustworthy.

### Asset concentration

Group economic exposure by asset rather than protocol. Wrapped/derivative relationships need care so the system does not accidentally count the same exposure twice.

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

At minimum include:

```json
{
  "schemaVersion": "1",
  "engineVersion": "0.1.0",
  "methodologyVersion": "2026-01"
}
```

The exact version scheme can change, but the concept should not.

## Missing data

Missing data is part of the result, not an implementation embarrassment.

A report can contain warnings such as:

```text
- 18% of discovered token value could not be priced.
- Liquidity metrics unavailable for Protocol X.
- Lending position was last confirmed 14 blocks ago.
```

RiskRail should never turn an unknown into zero just to make a dashboard look complete.
