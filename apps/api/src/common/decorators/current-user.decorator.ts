import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Reads the user id that JwtAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<{ userId: string }>().userId,
);
