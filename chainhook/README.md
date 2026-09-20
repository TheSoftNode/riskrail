# Chainhook predicates

The files here are templates because deployed contract identifiers are not known until testnet deployment.

Before registering a predicate:
1. Replace `DEPLOYER` with the testnet/mainnet deployer principal.
2. Replace the callback URL with the deployed indexer/API callback.
3. Store the callback bearer token outside source control.
4. Validate the predicate against the Chainhook version used in the target environment.

## Incremental indexing

`POST /api/v1/chainhook/protocol` turns protocol activity into a targeted
re-index instead of polling every wallet.

The receiver walks the payload for Stacks principals, intersects them with
wallets RiskRail already tracks, and queues one `portfolio.refresh` per match.

Two deliberate choices:

- **Only known wallets are queued.** A contract call names many principals that
  have never used RiskRail; indexing those would let anyone make the service do
  unbounded work.
- **Jobs are keyed `chainhook:<source>:<address>:<block>` with a short delay**, so
  several events in one block collapse into a single read.

Rollbacks are treated as re-index triggers too — a reorg means the state we
recorded for those wallets may no longer be canonical.
