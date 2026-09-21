import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsString, IsUrl } from 'class-validator';
import { WEBHOOK_EVENTS } from './webhooks.service.js';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/rivisk' })
  @IsString()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events!: string[];
}

export class SetWebhookEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
