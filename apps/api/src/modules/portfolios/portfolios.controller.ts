import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PortfoliosService } from './portfolios.service.js';

@ApiTags('portfolios')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Get the latest indexed portfolio for a Stacks address' })
  @ApiParam({ name: 'address', description: 'Stacks principal' })
  getPortfolio(@Param('address') address: string) {
    return this.portfolios.getPortfolio(address);
  }

  @Get(':address/risk')
  @ApiOperation({ summary: 'Get the latest deterministic risk snapshot' })
  getRisk(@Param('address') address: string) {
    return this.portfolios.getRisk(address);
  }

  @Post(':address/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue a fresh on-chain portfolio index for this address' })
  @ApiResponse({ status: 202, description: 'Refresh accepted' })
  refresh(@Param('address') address: string) {
    return this.portfolios.requestRefresh(address);
  }
}
