import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsService } from './alerts.service.js';

@Module({
  imports: [AuthModule, ApiKeysModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
