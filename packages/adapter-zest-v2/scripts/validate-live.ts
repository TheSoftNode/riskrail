/**
 * Reads a real Zest V2 position from mainnet and prints what the adapter makes
 * of it.
 *
 * This exists because unit tests only prove the adapter is self-consistent. The
 * first time it was pointed at a live position it failed outright, on an asset
 * shape no fixture covered — so "it reads mainnet" is a claim that has to be
 * re-checked against the chain, not against our own mocks.
 *
 *   npx tsx scripts/validate-live.ts [address]
 *
 * To check the numbers, take a recent `borrow`/`repay` transaction for the same
 * address and compare the market contract's own `position-debt-usd` print with
 * `scaled debt x borrow index` from here. See docs/validation/zest-v2.md.
 */
import {
  StacksZestV2Reader,
  ZestV2Adapter,
  ZEST_V2_MAINNET_CONTRACTS,
} from '../src/index.js';

const API = process.env.STACKS_API_URL ?? 'https://api.hiro.so';
const ADDRESS = process.argv[2] ?? 'SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3';

const json = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v), 2);

async function main() {
  const reader = new StacksZestV2Reader(API, ZEST_V2_MAINNET_CONTRACTS);
  const adapter = new ZestV2Adapter(reader, ZEST_V2_MAINNET_CONTRACTS);

  console.log(`address: ${ADDRESS}`);
  console.log(`api:     ${API}\n`);

  const state = await reader.getPosition(ADDRESS);
  if (!state) {
    console.log('No Zest position for this address.');
    return;
  }

  console.log('--- raw on-chain position ---');
  console.log(json(state));

  const positions = await adapter.getPositions(ADDRESS, { stacksApiUrl: API });
  console.log(`\n--- normalized (${positions.length}) ---`);
  console.log(json(positions));
}

main().catch((error) => {
  console.error('FAILED:', error);
  process.exit(1);
});
