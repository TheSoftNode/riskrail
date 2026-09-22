import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { ChainhookService } from './chainhook.service.js';
import type { ChainhookPayload } from './chainhook.parser.js';

/**
 * Chainhooks 2.0 sends the account's consumer secret as a Bearer token. The
 * setting is a comma-separated list so a rotated secret and its predecessor
 * can both be accepted until every in-flight delivery has drained.
 */
export function authorized(value?: string): boolean {
  const accepted = (process.env.CHAINHOOK_AUTH_TOKEN ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (!accepted.length || !value?.startsWith('Bearer ')) return false;
  const presented = Buffer.from(value.slice('Bearer '.length));
  // Compare against every entry so the time taken doesn't reveal which matched.
  let ok = false;
  for (const token of accepted) {
    const expected = Buffer.from(token);
    if (presented.length === expected.length && timingSafeEqual(presented, expected)) ok = true;
  }
  return ok;
}

@ApiTags('chainhook')
@Controller('chainhook')
export class ChainhookController {
  constructor(private readonly chainhook: ChainhookService) {}

  /** An attestation was mined; record its on-chain snapshot id. */
  @Post('risk-registry')
  @ApiExcludeEndpoint()
  riskRegistry(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChainhookPayload,
  ) {
    if (!authorized(authorization)) throw new UnauthorizedException();
    return this.chainhook.confirmAttestations(body);
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
