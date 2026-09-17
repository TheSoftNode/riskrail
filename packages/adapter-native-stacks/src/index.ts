import type { AdapterContext, NormalizedPosition, ProtocolAdapter, ProtocolMetadata } from '@riskrail/adapter-core';
import { StacksClient, isStacksPrincipal } from '@riskrail/stacks';

export class NativeStacksAdapter implements ProtocolAdapter {
  metadata(): ProtocolMetadata {
    return { id: 'native-stacks', name: 'Stacks Wallet', type: 'wallet', contracts: [] };
  }

  async supports(address: string): Promise<boolean> {
    return isStacksPrincipal(address);
  }

  async getPositions(address: string, context: AdapterContext): Promise<NormalizedPosition[]> {
    const client = new StacksClient(context.stacksApiUrl);
    const balances = await client.getAddressBalances(address, context.signal);
    const blockHeight = context.blockHeight ?? 0;

    const assets = [
      {
        assetId: 'STX',
        symbol: 'STX',
        amountAtomic: balances.stx.balance,
        decimals: 6,
        role: 'asset' as const,
      },
      ...Object.entries(balances.fungible_tokens).map(([assetId, data]) => ({
        assetId,
        symbol: assetId.split('::').at(-1) ?? assetId,
        amountAtomic: data.balance,
        decimals: assetId.toLowerCase().includes('sbtc') ? 8 : 0,
        role: 'asset' as const,
      })),
    ];

    return [{
      id: `native:${address}`,
      owner: address,
      protocol: this.metadata(),
      type: 'wallet',
      assets,
      accessibility: { liquidBps: 10_000 },
      source: { blockHeight, observedAt: new Date().toISOString(), exact: Object.keys(balances.fungible_tokens).length === 0 },
      metadata: { note: 'Non-sBTC SIP-010 decimals require token-metadata resolution before valuation.' },
    }];
  }
}
