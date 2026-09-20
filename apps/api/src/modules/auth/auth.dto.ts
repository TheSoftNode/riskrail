import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class ChallengeDto {
  @ApiProperty({ example: 'SP2ABC…' })
  @IsString()
  @Matches(/^S[PTMN][0-9A-Z]{8,}$/i, { message: 'address must be a Stacks principal' })
  address!: string;
}

export class VerifyDto {
  @ApiProperty({ example: 'SP2ABC…' })
  @IsString()
  address!: string;

  @ApiProperty({ description: 'Compressed secp256k1 public key, hex encoded' })
  @IsString()
  @MinLength(66)
  publicKey!: string;

  @ApiProperty({ description: 'RSV signature over the issued challenge' })
  @IsString()
  @MinLength(130)
  signature!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'you@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean;
}
