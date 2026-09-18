import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PoliciesService } from './policies.service.js';

@ApiTags('policies')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Read the wallet-owned RiskRail policy from the configured Clarity contract' })
  get(@Param('address') address: string) {
    return this.policies.get(address);
  }
}
