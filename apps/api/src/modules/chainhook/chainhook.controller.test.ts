import { afterEach, describe, expect, it } from 'vitest';
import { authorized } from './chainhook.controller.js';

describe('chainhook authorization', () => {
  const original = process.env.CHAINHOOK_AUTH_TOKEN;
  afterEach(() => {
    process.env.CHAINHOOK_AUTH_TOKEN = original;
  });

  it('accepts any one of several per-hook secrets', () => {
    process.env.CHAINHOOK_AUTH_TOKEN = 'secret-registry, secret-policy';
    expect(authorized('Bearer secret-registry')).toBe(true);
    expect(authorized('Bearer secret-policy')).toBe(true);
  });

  it('rejects a wrong, missing or non-Bearer token', () => {
    process.env.CHAINHOOK_AUTH_TOKEN = 'secret-registry,secret-policy';
    expect(authorized('Bearer secret-other')).toBe(false);
    expect(authorized(undefined)).toBe(false);
    expect(authorized('secret-registry')).toBe(false);
    expect(authorized('Bearer ')).toBe(false);
  });

  it('rejects everything when no token is configured', () => {
    process.env.CHAINHOOK_AUTH_TOKEN = ' , ';
    expect(authorized('Bearer ')).toBe(false);
    expect(authorized('Bearer anything')).toBe(false);
  });
});
