import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service.js';

/** Bearer rr_live_/rr_test_ token -> request.userId, for developer endpoints. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly keys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const userId = await this.keys.resolve(header.slice(7));
    if (!userId) throw new UnauthorizedException('Invalid or revoked API key');
    request.userId = userId;
    return true;
  }
}
