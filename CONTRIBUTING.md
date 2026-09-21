# Contributing

1. Create a branch: `feat/<scope>`, `fix/<scope>`, `docs/<scope>`, or `chore/<scope>`.
2. Use conventional commits, e.g. `feat(risk): add liquidation distance model`.
3. Run `pnpm typecheck && pnpm test && pnpm build` before opening a PR.
4. New protocol integrations must implement `@rivisk/adapter-core` and include adapter fixture tests.
5. New risk formulas must be pure, deterministic, documented, and covered by exact-value tests.
6. Never introduce custody, signing, or secret storage into a protocol adapter.
