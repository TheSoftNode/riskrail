# Chainhook predicates

Rivisk's own contract predicates are templates until the contracts are
deployed. The Zest mainnet predicate is not a template — it is verified against
the live deployment (see below).

Before registering a predicate:
1. Replace `DEPLOYER` with the testnet/mainnet deployer principal.
2. Replace the callback URL with the deployed indexer/API callback.
3. Store the callback bearer token outside source control.
4. Validate the predicate against the Chainhook version used in the target environment.

## Why the Zest predicate watches the vault, not the market

An earlier version of `protocol.activity.json` listened for a `contract_call` to
`v0-market-vault` with method `get-position`. That could never fire, for two
reasons: `get-position` is a `read_only` function, so calling it never produces
a transaction, and the contract identifier used a Zest V1 governance deployer
rather than the V2 deployer the adapter actually reads from.

The replacement watches **print events on the market vault**:

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

`contains: "account"` matches those prints because the vault includes the
affected principal in every one of them — which is also what the receiver needs.

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
