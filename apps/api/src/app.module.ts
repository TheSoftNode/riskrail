import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { ChainhookModule } from './modules/chainhook/chainhook.module';

@Module({ imports: [HealthModule, PortfoliosModule, ChainhookModule] })
export class AppModule {}
