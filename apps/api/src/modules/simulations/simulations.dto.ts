import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PriceShockDto {
  @ApiPropertyOptional({ example: 'sBTC', description: 'RiskRail asset identifier. Either assetId or symbol is required.' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({ example: 'sBTC', description: 'Asset symbol. Either symbol or assetId is required.' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiProperty({ example: -2000, description: 'Price change in basis points. -2000 means -20%.' })
  @IsInt()
  @Min(-10_000)
  @Max(100_000)
  changeBps!: number;
}

export class RunSimulationDto {
  @ApiProperty({ example: 'SP2...' })
  @IsString()
  address!: string;

  @ApiPropertyOptional({ example: 'Custom BTC stress' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ type: [PriceShockDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceShockDto)
  shocks!: PriceShockDto[];
}
