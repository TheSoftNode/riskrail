import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service.js';
import { CreateAlertDto, UpdateAlertStatusDto } from './alerts.dto.js';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get(':address')
  @ApiOperation({ summary: 'List address-scoped beta alert rules and recent policy breaches' })
  list(@Param('address') address: string) {
    return this.alerts.list(address);
  }

  @Post(':address')
  @ApiOperation({ summary: 'Create an in-app beta alert rule for a Stacks address' })
  create(@Param('address') address: string, @Body() input: CreateAlertDto) {
    return this.alerts.create(address, input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pause, resume or archive an alert rule' })
  update(@Param('id') id: string, @Body() input: UpdateAlertStatusDto) {
    return this.alerts.updateStatus(id, input);
  }
}
