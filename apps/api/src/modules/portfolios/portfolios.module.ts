import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard.js';
import { PortfoliosController } from './portfolios.controller.js';
import { PortfoliosService } from './portfolios.service.js';

@Module({
  controllers: [PortfoliosController],
  providers: [PortfoliosService, RateLimitGuard],
})
export class PortfoliosModule {}
