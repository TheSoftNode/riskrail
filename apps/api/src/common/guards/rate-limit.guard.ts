import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRedisConnection } from '@rivisk/queue';

export interface RateLimitOptions {
  /** Requests allowed inside the window. */
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMIT_KEY = 'rivisk:rate-limit';

/** Caps how often one caller may hit a route. */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Redis-backed fixed-window limiter.
 *
 * It lives in Redis rather than in process memory because the API is meant to
 * run as more than one instance — an in-memory counter would give each replica
 * its own allowance, so the real limit would silently be `limit x replicas`.
 *
 * A caller is identified by client IP, which means `trust proxy` has to be set
 * correctly in production; otherwise every request carries the load balancer's
 * address and the whole deployment shares a single bucket.
 */
@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly redis = createRedisConnection();

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      route?: { path?: string };
      params?: Record<string, string>;
    }>();

    const bucket = Math.floor(Date.now() / 1000 / options.windowSeconds);
    const key = [
      'rivisk:ratelimit',
      request.route?.path ?? context.getHandler().name,
      request.ip ?? 'unknown',
      bucket,
    ].join(':');

    let used: number;
    try {
      // INCR then EXPIRE: the key is created by the first request of a window,
      // so the TTL only needs setting on that first call.
      used = await this.redis.incr(key);
      if (used === 1) await this.redis.expire(key, options.windowSeconds);
    } catch {
      // Redis being unreachable must not take down public read paths. Abuse
      // protection is the lesser concern next to a total outage, so fail open.
      return true;
    }

    if (used > options.limit) {
      const retryAfter = (bucket + 1) * options.windowSeconds - Math.floor(Date.now() / 1000);
      // The standard header, not only the body field: clients -- including
      // Rivisk's own SDK -- read `Retry-After` to decide how long to wait.
      // With the value only in the JSON body, the SDK never saw it and fell
      // back to its own backoff.
      context
        .switchToHttp()
        .getResponse<{ setHeader(name: string, value: string): void }>()
        .setHeader('Retry-After', String(Math.max(0, retryAfter)));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please retry shortly.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
