# Security Model

RiskRail is read-heavy and non-custodial, which removes a large class of risk, but it still handles security-sensitive infrastructure: API keys, webhook secrets, wallet authentication, contract administration and potentially a service key that publishes attestations.

## Security goals

1. A compromise of the public web/API should not give an attacker custody of user funds.
2. The platform should not accept forged Chainhook/webhook events as trusted state.
3. Developer credentials should be revocable and stored safely.
4. A compromised attestation publisher should be containable and revocable.
5. Risk calculations should be auditable and protected from silent input manipulation.
6. Logs should help incident response without leaking secrets.

## Non-custodial boundary

The normal RiskRail workflow never asks a user for:

- seed phrase;
- raw private key;
- wallet backup;
- custody deposit.

If any UI ever asks for those values, it is a bug or compromise.

## Wallet authentication

Connecting a wallet is not the same as an authenticated backend session.

Recommended flow:

1. API issues a one-time nonce/challenge;
2. wallet signs the message using the approved Stacks auth mechanism;
3. backend verifies address, signature, nonce and expiry;
4. backend creates a short-lived session/access token;
5. nonce is consumed.

Replay protection matters.

## API keys

Developer API keys should:

- have test/live prefixes;
- be shown once;
- be stored as a salted/peppered secure hash;
- support revocation;
- track last usage;
- support future scopes;
- never appear in normal logs.

## Webhook secrets

RiskRail signs outbound webhooks. Endpoint secrets should be generated with strong randomness and stored in a protected form appropriate for signing.

If the server needs the clear secret to compute HMAC signatures, simple one-way hashing is not enough; use encryption/key management or derive per-endpoint signing material securely. The current schema uses `secretHash` as a placeholder and should be finalized when webhook implementation begins.

## Chainhook ingress

Inbound callbacks need authentication and schema validation. Treat raw blockchain webhook data as untrusted input until it passes validation.

Use idempotency keys so replayed callbacks cannot duplicate state transitions.

## Attestation publisher

The RiskRail publisher key has authority to write snapshots to the registry. It should be isolated from ordinary API credentials.

Production options include:

- cloud secret manager + isolated worker;
- HSM/KMS-backed signing if supported by the Stacks signing path;
- dedicated signer service with a very narrow API;
- a multisig/governance process for publisher administration.

The contract owner can revoke a publisher if it is compromised.

## Smart contract administration

Owner functions need careful operational handling:

- publisher management;
- ownership transfer;
- protocol registration/enable state;
- adapter version updates.

The owner should not be a casual browser wallet used every day. A stronger admin setup is preferable before mainnet production.

## Input validation

Validate at every trust boundary:

- Stacks principals;
- API DTOs;
- webhook payloads;
- Chainhook payloads;
- environment variables;
- protocol read results;
- price provider responses.

Zod/class-validator schemas should fail closed when critical fields are malformed.

## HTTP security

Baseline:

- Helmet;
- explicit CORS allowlist;
- rate limiting;
- request body size limits;
- secure cookies if browser sessions are used;
- TLS in hosted environments;
- no detailed stack traces in production;
- request ids for tracing.

## Database security

Use separate database credentials per environment. Production should not expose PostgreSQL publicly.

Migrations should be reviewed like application code.

## Dependency/security automation

The repository already includes the shape for Dependabot and security workflows. CI should run:

- dependency audit;
- CodeQL/static analysis;
- secret scanning where available;
- lint/typecheck/tests;
- container scanning once production images are built.

## Threat examples

### Manipulated price input

Mitigation: source metadata, sanity checks, provider fallback/aggregation, stale-price rules, and warnings.

### Forged protocol event

Mitigation: authenticated Chainhook ingress plus authoritative state re-read before final position update.

### Duplicate event replay

Mitigation: idempotency keys and unique event identity.

### Publisher key leak

Mitigation: key isolation, publisher revocation, monitoring unexpected publication rate, and owner governance.

### Malicious/buggy adapter

Mitigation: fixtures, protocol formula tests, code review, adapter versioning, and the ability to disable a protocol.

### False precision

This is a product-security issue too. If data is missing, show that it is missing rather than presenting a confident number.
