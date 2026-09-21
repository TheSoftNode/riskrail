import type { AdapterContext, NormalizedPosition, ProtocolAdapter, ProtocolMetadata } from '@rivisk/adapter-core';
import { StacksClient, isStacksPrincipal } from '@rivisk/stacks';

export class NativeStacksAdapter implements ProtocolAdapter {
  metadata(): ProtocolMetadata {
    return { id: 'native-stacks', name: 'Stacks Wallet', type: 'wallet', contracts: [] };
  }

  async supports(address: string): Promise<boolean> {
    return isStacksPrincipal(address);
  }

  async getPositions(address: string, context: AdapterContext): Promise<NormalizedPosition[]> {
    const client = new StacksClient(context.stacksApiUrl);
    const [balances, currentHeight] = await Promise.all([
      client.getAddressBalances(address, context.signal),
      context.blockHeight === undefined ? client.getCurrentBlockHeight(context.signal) : Promise.resolve(context.blockHeight),
    ]);

    const tokenMetadata = await Promise.all(
      balances.fungibleTokens.map(async (token) => ({
        token,
        metadata: await client.getFungibleTokenMetadata(token.assetIdentifier, context.signal),
      })),
    );

    const assets = [
      {
        assetId: 'STX',
        symbol: 'STX',
        amountAtomic: balances.stx.balance,
        decimals: 6,
        role: 'asset' as const,
      },
      ...tokenMetadata.map(({ token, metadata }) => ({
        assetId: token.assetIdentifier,
        symbol: metadata.symbol,
        amountAtomic: token.balance,
        decimals: metadata.decimals,
        role: 'asset' as const,
      })),
    ].filter((asset) => BigInt(asset.amountAtomic) > 0n);

    const exact = tokenMetadata.every(({ metadata }) => metadata.exact);

    return [{
      id: `native:${address}`,
      owner: address,
      protocol: this.metadata(),
      type: 'wallet',
      assets,
      accessibility: { liquidBps: 10_000 },
      source: { blockHeight: currentHeight, observedAt: new Date().toISOString(), exact },
      metadata: {
        stx: {
          totalAtomic: balances.stx.balance,
          availableAtomic: balances.stx.available,
          lockedAtomic: balances.stx.locked,
        },
        tokenMetadataExact: exact,
        accessibilityNote: 'Direct wallet assets are treated as liquid. STX stacking locks will be modeled by a dedicated staking adapter rather than applied to every wallet asset.',
      },
    }];
  }
}
