import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AccountAuthGuard } from './account-auth.guard.js';

function context(authorization?: string) {
  const request: Record<string, unknown> = { headers: { authorization } };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function guard(opts: { keyUser?: string | null; jwt?: Record<string, unknown> | Error } = {}) {
  const auth = {
    decode: vi.fn(async () => {
      if (opts.jwt instanceof Error) throw opts.jwt;
      return opts.jwt ?? { sub: 'user-session', typ: 'access' };
    }),
  };
  const keys = { resolve: vi.fn(async () => opts.keyUser ?? null) };
  return { g: new AccountAuthGuard(auth as never, keys as never), auth, keys };
}

describe('AccountAuthGuard', () => {
  it('accepts a live API key and resolves its owner', async () => {
    const { g, keys, auth } = guard({ keyUser: 'user-key' });
    const { ctx, request } = context('Bearer rv_live_abc123');
    await expect(g.canActivate(ctx)).resolves.toBe(true);
    expect(request.userId).toBe('user-key');
    expect(request.authMethod).toBe('api-key');
    // A key is never also tried as a JWT.
    expect(auth.decode).not.toHaveBeenCalled();
    expect(keys.resolve).toHaveBeenCalledWith('rv_live_abc123');
  });

  it('accepts a test API key', async () => {
    const { g } = guard({ keyUser: 'user-key' });
    await expect(g.canActivate(context('Bearer rv_test_xyz').ctx)).resolves.toBe(true);
  });

  it('rejects a revoked or unknown key', async () => {
    const { g } = guard({ keyUser: null });
    await expect(g.canActivate(context('Bearer rv_live_revoked').ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a wallet-session access token', async () => {
    const { g, keys } = guard({ jwt: { sub: 'user-session', typ: 'access' } });
    const { ctx, request } = context('Bearer eyJhbGciOi.jwt.token');
    await expect(g.canActivate(ctx)).resolves.toBe(true);
    expect(request.userId).toBe('user-session');
    expect(request.authMethod).toBe('session');
    expect(keys.resolve).not.toHaveBeenCalled();
  });

  it('rejects a refresh token presented as an access token', async () => {
    const { g } = guard({ jwt: { sub: 'user-session', typ: 'refresh' } });
    await expect(g.canActivate(context('Bearer eyJ.refresh').ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid JWT', async () => {
    const { g } = guard({ jwt: new UnauthorizedException('Invalid or expired token') });
    await expect(g.canActivate(context('Bearer garbage').ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing or non-bearer header', async () => {
    const { g } = guard();
    await expect(g.canActivate(context(undefined).ctx)).rejects.toThrow(UnauthorizedException);
    await expect(g.canActivate(context('Basic abc').ctx)).rejects.toThrow(UnauthorizedException);
  });
});
