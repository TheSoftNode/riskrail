import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PortfoliosService } from './portfolios.service';

@ApiTags('portfolios')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Get normalized portfolio for a Stacks address' })
  @ApiParam({ name: 'address', description: 'Stacks principal' })
  getPortfolio(@Param('address') address: string) { return this.portfolios.getPortfolio(address); }

  @Get(':address/risk')
  @ApiOperation({ summary: 'Get current deterministic risk summary' })
  getRisk(@Param('address') address: string) { return this.portfolios.getRisk(address); }
}
