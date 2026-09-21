# Testnet Deployment Runbook

Deploying Rivisk's four Clarity contracts (plus the consumer example) to Stacks testnet, and wiring the stack to them.

Deploying is the easy half. The failure that actually bites is a deployment that succeeds and is then silently unwired — the publisher never authorised, an env var left empty, the API pointed at a different address. Nothing errors; no attestation is ever written. The verification step exists for that.

## Prerequisites

**Clarinet 3.24 or newer.** The manifest targets `epoch = 3.4`, which clarinet 2.x rejects outright:

```
error: syntax errors in Clarinet.toml
epoch field invalid (value supported: 2.0, 2.05, 2.1, 2.2, 2.3, 2.4, 3.0)
```

The clarinet-sdk used by the tests accepts 3.4, which is why `pnpm --filter @rivisk/contracts test` passes on an old CLI while `clarinet check` fails. Check with `clarinet --version` before anything else.

```bash
# macOS
brew install clarinet
# or download from https://github.com/hirosystems/clarinet/releases
```

**A funded testnet account.** Deployment costs roughly **4.3 STX** at the low-cost fee rate:

| Contract | Cost (µSTX) |
| --- | --- |
| `protocol-registry` | 671,414 |
| `risk-provider-trait` | 670,025 |
| `risk-consumer-example` | 952,031 |
| `risk-policy` | 950,845 |
| `risk-registry` | 964,287 |
| **Total** | **≈4.21 STX** |

Fund the deployer at <https://explorer.hiro.so/sandbox/faucet?chain=testnet>.

## 1. Provide the deployer key

```bash
cp contracts/settings/Testnet.toml.example contracts/settings/Testnet.toml
# edit: mnemonic = "<your 24-word testnet mnemonic>"
```

`contracts/settings/Testnet.toml` and `Mainnet.toml` are **gitignored**. They were tracked until 2026-09-20, holding placeholder mnemonics — which meant the first person to paste a real key would have committed it. Only the `.example` templates belong in version control.

## 2. Check and test before spending anything

```bash
cd contracts
clarinet check                                   # must be 0 warnings, 5 contracts
pnpm --filter @rivisk/contracts test           # 51 tests
```

`clarinet check` runs `check_checker` in strict mode. Writes that are owner- or publisher-gated carry an explicit `;; #[allow(unchecked_data)]` with the reason; a *new* unchecked-data warning means a genuinely unvalidated write, not noise.

## 3. Generate the plan

```bash
clarinet deployments generate --testnet --low-cost
```

This writes `deployments/default.testnet-plan.yaml`, which is gitignored — it embeds the deployer's own address, so each operator generates their own rather than inheriting someone else's.

Read it before applying. Contract order matters within the batch: `risk-provider-trait` must publish before `risk-registry` (which implements it) and before `risk-consumer-example` (which uses it). Clarinet resolves this automatically; confirm it did.

## 4. Deploy

```bash
clarinet deployments apply --testnet
```

Testnet blocks settle in a few minutes. Watch the deployer on the explorer until all five transactions are in an anchored block.

## 5. Verify

```bash
node contracts/scripts/verify-deployment.mjs <ST-deployer-address> \
  --network testnet \
  --publisher <ST-publisher-address>
```

It checks that each contract is published at that address, that the trait surface actually responds, that the sentinel readers exist, and that the publisher is authorised. It exits non-zero on any failure and prints the exact environment lines to set.

## 6. Authorise the publisher

The publisher is the account behind `RISK_PUBLISHER_SECRET_KEY` — the worker signs attestations with it. It is deliberately **not** the deployer: the deployer key can be kept cold, while the publisher key lives on a server and can be revoked from the registry if it leaks.

```clarity
(contract-call? .risk-registry set-publisher 'ST2PUBLISHER... true)
```

Revoking later is the same call with `false`. Snapshots already published stay readable — revocation stops future writes, it does not erase history.

## 7. Register the protocol adapters

`protocol-registry` records which protocols Rivisk has an adapter for. It does **not** mean those protocols endorse Rivisk; see the header comment in the contract.

```clarity
(contract-call? .protocol-registry register-protocol
  u1 "Zest Protocol V2" "lending" 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-8-market u1 0x<metadata-hash>)
```

## 8. Wire the stack

```bash
RISK_REGISTRY_CONTRACT=ST...deployer.risk-registry
RISK_POLICY_CONTRACT=ST...deployer.risk-policy
PROTOCOL_REGISTRY_CONTRACT=ST...deployer.protocol-registry
RISK_PUBLISHER_ENABLED=true
RISK_PUBLISHER_SECRET_KEY=<publisher private key>

# web
NEXT_PUBLIC_RISK_POLICY_CONTRACT=ST...deployer.risk-policy
NEXT_PUBLIC_STACKS_NETWORK=testnet
```

`RISK_PUBLISHER_ENABLED` defaults to false. Leaving it false after deployment is the most likely way to end up with live contracts and no attestations.

## 9. Prove it end to end

```bash
pnpm --filter @rivisk/api smoke     # auth, keys, webhooks, alerts against a live API
```

Then index a wallet, wait for a risk snapshot, and confirm an attestation transaction appears from the publisher on the explorer. Until you have seen that transaction, on-chain attestation is a capability rather than a feature.

## Ownership

Both registries use **two-step** ownership transfer:

```clarity
(contract-call? .risk-registry transfer-ownership 'ST2NEW...)   ;; nominates
(contract-call? .risk-registry accept-ownership)                 ;; the nominee claims it
```

Nothing changes until the nominee accepts, so a mistyped address cannot permanently remove the ability to authorise or revoke publishers. `cancel-ownership-transfer` withdraws a pending nomination. `protocol-registry` had no transfer function at all before 2026-09-20 — a rotated deployer key would have frozen the adapter list forever.

## Before mainnet

Everything above, plus:

- an independent review of `risk-registry` and `risk-policy`;
- ownership moved off the deployment key to a key held separately;
- a rehearsed publisher-key revocation;
- the contracts exercised on testnet long enough to see a reorg.

Contracts are immutable. There is no patch after this point — only a new deployment and a migration for every integrator holding the old address.
