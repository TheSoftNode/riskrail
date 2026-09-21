# Risk engine rules

The risk engine is a pure TypeScript library. It accepts normalized positions and explicit scenario input, then returns deterministic metrics.

Rules:

- No database access.
- No HTTP calls.
- No AI-generated numeric risk values.
- Decimal arithmetic for monetary values.
- Every financial formula should have exact-value unit tests.
- Protocol-specific facts such as LTV thresholds come from adapters/market metadata; shared arithmetic stays in the portfolio/risk packages.
- A missing price remains missing. Rivisk lowers valuation coverage rather than inventing a value.

Current metrics:

- Asset concentration.
- Protocol concentration.
- Capital accessibility / locked capital.
- Current LTV for valued lending positions.
- Borrow headroom where a protocol exposes a borrow threshold.
- Health factor against a protocol's partial-liquidation threshold.
- Liquidation distance and a single-collateral liquidation-price estimate where deterministic calculation is possible.
- Default BTC -10%, -20%, -30% and STX -20% stress scenarios.
- Custom multi-asset price shocks through the simulation API.

The worker stores the standard scenario results inside the canonical risk report. The current methodology version is `rivisk-v1.1`.

A scenario is a what-if calculation against an indexed snapshot. It is not a market prediction and it never executes a transaction.
