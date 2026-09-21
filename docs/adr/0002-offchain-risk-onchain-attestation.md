# ADR 0002: Compute risk off-chain; attest results on-chain

Status: Accepted

Cross-protocol valuation, liquidity and stress testing require external/on-chain data aggregation and are inefficient to reproduce entirely inside Clarity. Rivisk therefore computes deterministic reports off-chain and commits compact metrics plus a canonical SHA-256 report hash to `risk-registry.clar`.

This preserves verifiability and composability without turning the contract into a costly data-processing system.
