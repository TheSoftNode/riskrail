import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './api-keys.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List your API keys (never returns the secret)' })
  list(@CurrentUser() userId: string) {
    return this.keys.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Issue a new API key — the token is shown once' })
  create(@CurrentUser() userId: string, @Body() input: CreateApiKeyDto) {
    return this.keys.create(userId, input.name, input.live ?? false);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.keys.revoke(userId, id);
  }
}
