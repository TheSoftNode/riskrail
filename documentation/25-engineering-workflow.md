# Engineering Workflow

The project should stay easy to review even when one person is doing most of the work. Small, coherent commits are useful for grants, debugging and future contributors.

## Branching

`main` should remain deployable or at least buildable.

Feature branches can follow:

```text
feat/native-stacks-indexer
feat/bitpay-adapter
feat/risk-attestations
fix/indexer-idempotency
refactor/risk-report-schema
docs/adapter-methodology
```

Direct work on `main` can be acceptable during the earliest solo scaffold phase, but once CI and deployment are active, feature branches + pull requests are safer.

## Commit style

Use Conventional Commits where practical:

```text
feat(adapter): add BitPay stream reader
feat(risk): calculate protocol concentration
feat(contracts): publish historical risk snapshots
fix(indexer): ignore duplicate chainhook delivery
test(risk): cover health-factor boundaries
docs(grant): document milestone acceptance criteria
```

A commit should tell the story of one change.

## Pull requests

A useful PR description answers:

- what changed;
- why it changed;
- how it was tested;
- whether database/contracts/API schemas changed;
- any follow-up work;
- screenshots or transaction ids when relevant.

## Definition of done

A feature is not done only because the happy path works locally.

For normal application work:

- code implemented;
- types/validation updated;
- tests added;
- docs updated when behavior/API changes;
- logs/metrics considered;
- no secrets added;
- lint/typecheck/build pass;
- migration reviewed if applicable.

For an adapter:

- fixtures;
- normalization tests;
- exactness/source behavior documented;
- failure behavior documented;
- Chainhook triggers identified;
- protocol math references documented.

For a Clarity contract:

- authorization tests;
- error/boundary tests;
- events documented;
- deployment/config update;
- read-only API documented;
- testnet transaction evidence before mainnet consideration.

## Architecture decision records

Use `docs/adr/` for decisions that future contributors are likely to question.

Examples already represented:

- modular monolith/monorepo first;
- risk calculation off-chain, attestations on-chain.

Good ADR candidates:

- canonical report format;
- price/oracle strategy;
- first lending protocol selection;
- publisher key architecture;
- webhook signing format;
- reorg confirmation policy.

## Code ownership

As the team grows, CODEOWNERS can require review for high-risk areas:

```text
contracts/
packages/risk-engine/
packages/adapter-*/
packages/database/prisma/
.github/workflows/
```

## Release/versioning

Internal packages can move together early on. Public packages such as `@riskrail/sdk` need semantic versioning once external users depend on them.

Changesets can be introduced/used for package release notes as public package publishing starts.

## Documentation discipline

When implementation differs from this long-form documentation, the code may be correct and the document may simply be stale. Update the documentation in the same PR so the repository does not become a museum of old plans.
