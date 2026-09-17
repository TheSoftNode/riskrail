import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'riskrail-api', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  ready() { return { status: 'ready' }; }
}
