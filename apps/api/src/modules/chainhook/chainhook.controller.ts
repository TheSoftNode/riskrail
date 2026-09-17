import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';

function authorized(value?: string): boolean {
  const expected = process.env.CHAINHOOK_AUTH_TOKEN;
  if (!expected || !value?.startsWith('Bearer ')) return false;
  const actual = value.slice('Bearer '.length);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@ApiTags('chainhook')
@Controller('chainhook')
export class ChainhookController {
  @Post('risk-registry')
  @ApiExcludeEndpoint()
  riskRegistry(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    if (!authorized(authorization)) throw new UnauthorizedException();
    return { accepted: true, event: 'risk-registry', receivedAt: new Date().toISOString(), body };
  }

  @Post('risk-policy')
  @ApiExcludeEndpoint()
  riskPolicy(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    if (!authorized(authorization)) throw new UnauthorizedException();
    return { accepted: true, event: 'risk-policy', receivedAt: new Date().toISOString(), body };
  }
}
