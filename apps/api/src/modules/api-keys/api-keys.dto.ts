import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Wallet integration' })
  @IsString()
  @Length(1, 60)
  name!: string;

  @ApiPropertyOptional({ description: 'Issue an rv_live_ key instead of rv_test_' })
  @IsOptional()
  @IsBoolean()
  live?: boolean;
}
