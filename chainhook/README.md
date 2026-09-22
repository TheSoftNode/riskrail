# Chainhook predicates

Chainhook definitions in the **Chainhooks 2.0** format (`version: "1"`,
`filters.events`, `action.http_post`), checked against the schema in
`@hirosystems/chainhooks-client` 2.1. The Rivisk contract hooks target the
testnet deployment (`ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7`, see
`contracts/deployments/testnet.json`).

| File | Network | Watches | Route |
| --- | --- | --- | --- |
| `risk-registry.publish.json` | testnet | `publish-risk-snapshot` calls | `risk-registry` |
| `risk-policy.updated.json` | testnet | `set-risk-policy`, `set-policy-enabled`, `delete-risk-policy` | `risk-policy` |
| `protocol.activity.json` | mainnet | print events of the Zest V2 market vault | `protocol` |

Before registering, replace `YOUR_API_HOST` with the deployed API host.
Chainhook runs remotely and cannot reach `localhost`.

**Authentication.** Chainhooks 2.0 generates one consumer secret per account
(`/chainhooks/me/secret`) and sends it as `Authorization: Bearer <secret>`.
Put that secret in `CHAINHOOK_AUTH_TOKEN`. The setting accepts a
comma-separated list, so after a rotation the old and new secrets can both be
accepted until deliveries signed with the old one have drained.

**Payloads.** 2.0 nests blocks under `event.apply` / `event.rollback`, reports
`metadata.status` instead of `success`, and gives `metadata.result` as
`{ hex, repr }`. The receiver accepts both this and the 1.x shape; see
`apps/api/src/modules/chainhook/chainhook.parser.ts`.

**Network.** The Zest hook is mainnet. It only does useful work when the
indexer reads mainnet (`STACKS_NETWORK=mainnet`); against a testnet stack the
wallets it names are never tracked, so every delivery is a no-op.

## Attestation confirmations

`POST /api/v1/chainhook/risk-registry` records which on-chain snapshot id each
attestation became. The worker stores the transaction id when it broadcasts;
the id is only known once the transaction is mined, so the receiver reads it
from the call's return value, `(ok uN)`, and writes it to the snapshot with the
matching `onchainTxId`. A rollback clears the id again.

This endpoint **does not re-index the wallet**. Publishing changes nothing about
the position, and a re-index produces a new snapshot that the worker attests
too, so each confirmation would trigger another paid transaction, every block.

## Why the Zest predicate watches the vault, not the market

An earlier version of `protocol.activity.json` listened for a `contract_call` to
`v0-market-vault` with method `get-position`. That could never fire, for two
reasons: `get-position` is a `read_only` function, so calling it never produces
a transaction, and the contract identifier used a Zest V1 governance deployer
rather than the V2 deployer the adapter actually reads from.

The replacement watches **print events** (`contract_log`) **on the market vault**:

```
SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-market-vault
```

Users transact against `v0-8-market` (`borrow`, `repay`, `supply-collateral-add`,
`collateral-remove`, `collateral-remove-redeem`, `liquidate`, …), but every one
of those has to write position state through the vault, and the vault emits one
print per write carrying the affected `account` principal:

| User calls               | Vault emits          |
| ------------------------ | -------------------- |
| `borrow`                 | `debt-add-scaled`    |
| `repay`                  | `debt-remove-scaled` |
| `supply-collateral-add`  | `collateral-add`     |
| `collateral-remove-redeem` | `collateral-remove` |

Watching the vault therefore gives one predicate instead of one per method, and
it keeps working when Zest ships a new market contract (`v0-8-market` →
`v0-9-market`), because the storage layer is the part that stays put.

The vault includes the affected `account` principal in every one of those
prints, which is what the receiver extracts. (Chainhooks 2.0 has no `contains`
filter on `contract_log`; the receiver's wallet filter does that job instead.)

> Verified against mainnet transactions on 2026-09-20. If Zest migrates the
> vault itself, this identifier has to be updated.

## Incremental indexing

`POST /api/v1/chainhook/protocol` turns protocol activity into a targeted
re-index instead of polling every wallet.

The receiver walks the payload for Stacks principals, intersects them with
wallets Rivisk already tracks, and queues one `portfolio.refresh` per match.

Two deliberate choices:

- **Only known wallets are queued.** A contract call names many principals that
  have never used Rivisk; indexing those would let anyone make the service do
  unbounded work.
- **Jobs are keyed `chainhook:<source>:<address>:<block>` with a short delay**, so
  several events in one block collapse into a single read.

Rollbacks are treated as re-index triggers too — a reorg means the state we
recorded for those wallets may no longer be canonical.
