import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { prisma } from '@riskrail/database';
import { AuthService } from './auth.service.js';
import { ChallengeDto, RefreshDto, UpdateProfileDto, VerifyDto } from './auth.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('challenge')
  @ApiOperation({ summary: 'Get the message a wallet must sign to sign in' })
  challenge(@Body() input: ChallengeDto) {
    return this.auth.createChallenge(input.address);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Exchange a signed challenge for access and refresh tokens' })
  verify(@Body() input: VerifyDto) {
    return this.auth.verify(input);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user and the wallets linked to it' })
  async me(@CurrentUser() userId: string) {
    const [user, wallets] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerifiedAt: true, notifyByEmail: true },
      }),
      prisma.wallet.findMany({
        where: { userId },
        select: { address: true, lastIndexedAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      userId,
      email: user?.email ?? null,
      emailVerified: Boolean(user?.emailVerifiedAt),
      notifyByEmail: user?.notifyByEmail ?? true,
      wallets,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set the notification email address and preference' })
  async updateProfile(@CurrentUser() userId: string, @Body() input: UpdateProfileDto) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.email === undefined
          ? {}
          : // Changing the address invalidates any previous verification.
            { email: input.email, emailVerifiedAt: null }),
        ...(input.notifyByEmail === undefined ? {} : { notifyByEmail: input.notifyByEmail }),
      },
      select: { email: true, emailVerifiedAt: true, notifyByEmail: true },
    });
    return {
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      notifyByEmail: user.notifyByEmail,
    };
  }
}
