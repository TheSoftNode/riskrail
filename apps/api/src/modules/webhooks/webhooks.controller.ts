import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service.js';
import { CreateWebhookDto, SetWebhookEnabledDto } from './webhooks.dto.js';
import { AccountAuthGuard } from '../../common/guards/account-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('webhooks')
@ApiBearerAuth()
// Session or API key: registering an endpoint is a normal server-side task.
@UseGuards(AccountAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List your webhook endpoints and recent deliveries' })
  list(@CurrentUser() userId: string) {
    return this.webhooks.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Register an endpoint — the signing secret is shown once' })
  create(@CurrentUser() userId: string, @Body() input: CreateWebhookDto) {
    return this.webhooks.create(userId, input.url, input.events);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Enable or disable an endpoint' })
  setEnabled(@CurrentUser() userId: string, @Param('id') id: string, @Body() input: SetWebhookEnabledDto) {
    return this.webhooks.setEnabled(userId, id, input.enabled);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an endpoint' })
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.webhooks.remove(userId, id);
  }
}
