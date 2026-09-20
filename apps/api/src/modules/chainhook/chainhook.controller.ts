import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { ChainhookService } from './chainhook.service.js';
import type { ChainhookPayload } from './chainhook.parser.js';

function authorized(value?: string): boolean {
  const expected = process.env.CHAINHOOK_AUTH_TOKEN;
  if (!expected || !value?.startsWith('Bearer ')) return false;
  const a = Buffer.from(value.slice('Bearer '.length));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@ApiTags('chainhook')
@Controller('chainhook')
export class ChainhookController {
  constructor(private readonly chainhook: ChainhookService) {}

  @Post('risk-registry')
  @ApiExcludeEndpoint()
  riskRegistry(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChainhookPayload,
  ) {
    if (!authorized(authorization)) throw new UnauthorizedException();
    return this.chainhook.ingest('risk-registry', body);
  }

  @Post('risk-policy')
  @ApiExcludeEndpoint()
  riskPolicy(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChainhookPayload,
  ) {
    if (!authorized(authorization)) throw new UnauthorizedException();
    return this.chainhook.ingest('risk-policy', body);
  }

  /** Protocol activity — a stream or lending position changed. */
  @Post('protocol')
  @ApiExcludeEndpoint()
  protocol(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChainhookPayload,
  ) {
    if (!authorized(authorization)) throw new UnauthorizedException();
    return this.chainhook.ingest('protocol', body);
  }
}
