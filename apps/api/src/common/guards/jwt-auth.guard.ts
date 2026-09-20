import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service.js';

/** Bearer access token -> request.userId. Rejects refresh tokens. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = await this.auth.decode(header.slice(7));
    if (payload.typ === 'refresh' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('An access token is required');
    }
    request.userId = payload.sub;
    return true;
  }
}
