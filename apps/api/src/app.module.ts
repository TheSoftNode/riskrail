import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { PortfoliosModule } from './modules/portfolios/portfolios.module.js';
import { ChainhookModule } from './modules/chainhook/chainhook.module.js';

@Module({ imports: [HealthModule, PortfoliosModule, ChainhookModule] })
export class AppModule {}
