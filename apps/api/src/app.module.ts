import { Module } from '@nestjs/common';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PortfoliosModule } from './modules/portfolios/portfolios.module.js';
import { ChainhookModule } from './modules/chainhook/chainhook.module.js';
import { SimulationsModule } from './modules/simulations/simulations.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { PoliciesModule } from './modules/policies/policies.module.js';

@Module({ imports: [AuthModule, ApiKeysModule, WebhooksModule, HealthModule, PortfoliosModule, SimulationsModule, AlertsModule, PoliciesModule, ChainhookModule] })
export class AppModule {}
