import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service.js';
import { AuthService } from '../../modules/auth/auth.service.js';

export type AuthMethod = 'session' | 'api-key';

/**
 * Accepts either a wallet-session access token or an `rv_live_`/`rv_test_` API
 * key, and resolves both to the same `request.userId`.
 *
 * For routes a server integration needs -- alerts and webhooks. Before this
 * guard existed, API keys could be created and revoked but no route accepted
 * one: every account-scoped endpoint took session JWTs only, so a key sent as a
 * bearer token got a 401.
 *
 * Deliberately NOT used for key management or profile changes. Those stay on
 * `JwtAuthGuard`, so a leaked API key cannot mint further keys or redirect the
 * account's notification email.
 */
@Injectable()
export class AccountAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly keys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
      authMethod?: AuthMethod;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7);

    // Keys are recognisable by prefix, so there is no need to try both paths.
    if (token.startsWith('rv_live_') || token.startsWith('rv_test_')) {
      const userId = await this.keys.resolve(token);
      if (!userId) throw new UnauthorizedException('Invalid or revoked API key');
      request.userId = userId;
      request.authMethod = 'api-key';
      return true;
    }

    const payload = await this.auth.decode(token);
    if (payload.typ === 'refresh' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('An access token is required');
    }
    request.userId = payload.sub;
    request.authMethod = 'session';
    return true;
  }
}
