# Chainhook predicates

The files here are templates because deployed contract identifiers are not known until testnet deployment.

Before registering a predicate:
1. Replace `DEPLOYER` with the testnet/mainnet deployer principal.
2. Replace the callback URL with the deployed indexer/API callback.
3. Store the callback bearer token outside source control.
4. Validate the predicate against the Chainhook version used in the target environment.
