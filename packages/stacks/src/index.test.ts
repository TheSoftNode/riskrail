import { describe, expect, it } from 'vitest';
import { inferNetworkFromApiUrl, parseAssetIdentifier, parseContractId } from './index.js';

describe('Stacks identifiers', () => {
  it('parses a SIP-010 asset identifier', () => {
    expect(parseAssetIdentifier('SM3VDX.sbtc-token::sbtc-token')).toEqual({
      contractId: 'SM3VDX.sbtc-token',
      tokenName: 'sbtc-token',
    });
  });

  it('parses a contract ID', () => {
    expect(parseContractId('ST123.risk-registry')).toEqual({ address: 'ST123', name: 'risk-registry' });
  });

  it('infers common networks from API URLs', () => {
    expect(inferNetworkFromApiUrl('https://api.testnet.hiro.so')).toBe('testnet');
    expect(inferNetworkFromApiUrl('http://localhost:3999')).toBe('devnet');
    expect(inferNetworkFromApiUrl('https://api.hiro.so')).toBe('mainnet');
  });
});
