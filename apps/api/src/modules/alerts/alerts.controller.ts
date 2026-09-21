import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AccountAuthGuard } from '../../common/guards/account-auth.guard.js';
import { AlertsService } from './alerts.service.js';
import { CreateAlertDto, UpdateAlertStatusDto } from './alerts.dto.js';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get(':address')
  @ApiOperation({ summary: 'List address-scoped alert rules and recent policy breaches' })
  list(@Param('address') address: string) {
    return this.alerts.list(address);
  }

  /**
   * Creating and changing rules is account state, so both require a wallet
   * session or an API key, and both check that the caller actually owns the
   * address. Without that check any caller could attach rules to — or silently
   * disable monitoring on — someone else's address.
   */
  @Post(':address')
  @UseGuards(AccountAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an in-app alert rule for an address you own' })
  @ApiResponse({ status: 403, description: 'The address is not linked to this account' })
  create(
    @CurrentUser() userId: string,
    @Param('address') address: string,
    @Body() input: CreateAlertDto,
  ) {
    return this.alerts.create(userId, address, input);
  }

  @Patch(':id')
  @UseGuards(AccountAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pause, resume or archive an alert rule you own' })
  @ApiResponse({ status: 403, description: 'The rule belongs to another account' })
  update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() input: UpdateAlertStatusDto,
  ) {
    return this.alerts.updateStatus(userId, id, input);
  }
}
