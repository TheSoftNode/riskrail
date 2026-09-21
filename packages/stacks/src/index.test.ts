import { describe, expect, it } from 'vitest';
import { inferNetworkFromApiUrl, isStacksPrincipal, parseAssetIdentifier, parseContractId } from './index.js';

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

describe('isStacksPrincipal checksum', () => {
  it('accepts real mainnet and testnet addresses', () => {
    expect(isStacksPrincipal('SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3')).toBe(true);
    expect(isStacksPrincipal('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM')).toBe(true);
  });

  it('accepts a contract principal', () => {
    expect(isStacksPrincipal('SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-8-market')).toBe(true);
  });

  /**
   * The shape check alone passed this, so the API queued an index job that
   * failed four times in a row deep inside the indexer.
   */
  it('rejects a well-shaped address with a bad checksum', () => {
    expect(isStacksPrincipal('SP491K9J80XN2KV6WVBH3BR3MVEF5X0KZBMTZPZ7')).toBe(false);
  });

  it('still rejects obvious rubbish', () => {
    expect(isStacksPrincipal('not-an-address')).toBe(false);
    expect(isStacksPrincipal('SP')).toBe(false);
    expect(isStacksPrincipal('')).toBe(false);
  });
});
