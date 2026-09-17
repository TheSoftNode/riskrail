# Demo and Acceptance Plan

A grant milestone should be easy to verify without reading thousands of lines of code. This document turns the technical deliverables into concrete demos.

## Milestone 1 demo

### Demo wallet

Use a testnet or safe public address that has:

- native STX/sBTC balance;
- a BitPay stream position.

If no single address has both, use a prepared testnet flow to create one.

### Walkthrough

1. Open RiskRail.
2. Enter the Stacks address.
3. Show the source block and indexing status.
4. Show native wallet assets.
5. Show the BitPay stream as a separate normalized position.
6. Show total known portfolio value.
7. Show protocol concentration.
8. Show capital accessibility/locked value.
9. Open the raw/source details for one position.
10. Generate a canonical risk report.
11. Show its SHA-256 hash.
12. Publish the snapshot on testnet.
13. Open the transaction/contract read.
14. Click Verify and show that the local report hash matches the on-chain hash.

### Acceptance evidence

Store in the repository/grant notes:

- wallet address;
- source block;
- API response fixture;
- report file;
- report hash;
- contract principal;
- transaction id;
- test output screenshot/log;
- short video URL if used.

## Milestone 2 demo

Use a wallet with a supported lending/collateral position.

Walkthrough:

1. Show current collateral/debt/health.
2. Show the formula/source description.
3. Run BTC -10%.
4. Run BTC -20%.
5. Compare resulting health factor/liquidation distance.
6. Create a threshold alert.
7. Set the equivalent/supported on-chain risk policy.
8. Change testnet state or use a deterministic test fixture that crosses the threshold.
9. Show the saved `AlertEvent`.
10. Show email/realtime notification.
11. Confirm no asset-moving transaction was executed by RiskRail.

## Milestone 3 demo

This should be developer-oriented as well as user-oriented.

1. Create a developer API key.
2. Call portfolio endpoint with curl/SDK.
3. Call risk endpoint.
4. Run a simulation using SDK.
5. Register a webhook endpoint.
6. Trigger a test event.
7. Verify webhook signature.
8. Show delivery history.
9. Show OpenAPI docs.
10. Show the external proof-of-concept integration.

## Demo reliability

Never rely on a live external market state that may disappear five minutes before a presentation.

Maintain:

- deterministic fixtures;
- a prepared testnet address;
- recorded source block examples;
- a fallback local demo mode clearly labeled as fixture data.

The real live path should still be demonstrated when available, but a reviewer should not be blocked by an unrelated upstream outage.
