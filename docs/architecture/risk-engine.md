# Risk engine rules

The risk engine is a pure TypeScript library. It accepts normalized positions, price/market state and explicit configuration, then returns deterministic metrics.

Rules:

- No database access.
- No HTTP calls.
- No AI-generated numeric risk values.
- Decimal arithmetic for monetary values.
- Every formula has exact-value unit tests.
- Protocol-specific liquidation rules stay in adapters/market metadata; the engine consumes normalized values.

Initial metrics:

- Asset concentration.
- Protocol concentration.
- Capital accessibility / locked capital.
- Collateral health when supplied by supported lending adapters.
- Liquidation distance where protocol rules permit deterministic calculation.
- Stress scenarios for BTC/STX/asset price shocks.
