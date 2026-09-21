import { describe, expect, it } from 'vitest';
import { clarityKind, unwrapClarity, unwrapClarityResponse } from './clarity.js';

describe('clarityKind', () => {
  it('reads the outer constructor, not nested ones', () => {
    expect(clarityKind('(tuple (oracle (tuple (callcode (optional none)))))')).toBe('tuple');
    expect(clarityKind('(optional (buff 1))')).toBe('optional');
    expect(clarityKind('(response uint uint)')).toBe('response');
    expect(clarityKind('(list 5 uint)')).toBe('list');
  });

  it('handles bare types', () => {
    expect(clarityKind('uint')).toBe('uint');
    expect(clarityKind('bool')).toBe('bool');
    expect(clarityKind('none')).toBe('none');
  });
});

describe('unwrapClarity', () => {
  it('unwraps primitives', () => {
    expect(unwrapClarity({ type: 'uint', value: '8' })).toBe('8');
    expect(unwrapClarity({ type: 'bool', value: true })).toBe(true);
  });

  it('returns null for an empty optional', () => {
    expect(unwrapClarity({ type: '(optional none)', value: null })).toBeNull();
  });

  it('unwraps a populated optional', () => {
    expect(unwrapClarity({ type: '(optional uint)', value: { type: 'uint', value: '3' } })).toBe('3');
  });

  /**
   * The regression this module exists for: the tuple's own type signature spells
   * out every nested type, so a substring match for "none" or "optional" reads
   * the *oracle field's* type as if it were the tuple's, and the whole asset
   * decodes as null. This is the exact shape returned by Zest's
   * `v0-assets.lookup` for sBTC, STX and USDC.
   */
  it('keeps a tuple that merely contains an empty optional', () => {
    const node = {
      type: '(tuple (addr principal) (decimals uint) (oracle (tuple (callcode (optional none)) (ident (buff 32)))))',
      value: {
        addr: { type: 'principal', value: 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.sbtc-token' },
        decimals: { type: 'uint', value: '8' },
        oracle: {
          type: '(tuple (callcode (optional none)) (ident (buff 32)))',
          value: {
            callcode: { type: '(optional none)', value: null },
            ident: { type: '(buff 32)', value: '0xe62d' },
          },
        },
      },
    };

    expect(unwrapClarity(node)).toEqual({
      addr: 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.sbtc-token',
      decimals: '8',
      oracle: { callcode: null, ident: '0xe62d' },
    });
  });

  it('decodes a tuple field literally named "type"', () => {
    const node = {
      type: '(tuple (type (buff 1)) (max-staleness uint))',
      value: {
        type: { type: '(buff 1)', value: '0x02' },
        'max-staleness': { type: 'uint', value: '60' },
      },
    };
    expect(unwrapClarity(node)).toEqual({ type: '0x02', 'max-staleness': '60' });
  });

  it('maps over lists', () => {
    const node = {
      type: '(list 2 uint)',
      value: [
        { type: 'uint', value: '1' },
        { type: 'uint', value: '2' },
      ],
    };
    expect(unwrapClarity(node)).toEqual(['1', '2']);
  });
});

describe('unwrapClarityResponse', () => {
  it('reports the err branch', () => {
    expect(
      unwrapClarityResponse({
        type: '(response uint uint)',
        value: { type: 'uint', value: '7' },
        success: false,
      }),
    ).toEqual({ ok: false, value: '7' });
  });

  it('reports the ok branch', () => {
    expect(
      unwrapClarityResponse({
        type: '(response uint uint)',
        value: { type: 'uint', value: '7' },
        success: true,
      }),
    ).toEqual({ ok: true, value: '7' });
  });

  it('treats a non-response as a bare value', () => {
    expect(unwrapClarityResponse({ type: 'uint', value: '9' })).toEqual({ ok: true, value: '9' });
  });
});
