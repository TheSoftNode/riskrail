import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@rivisk/database';
import { isStacksPrincipal } from '@rivisk/stacks';
import type { CreateAlertDto, UpdateAlertStatusDto } from './alerts.dto.js';

@Injectable()
export class AlertsService {
  async list(address: string) {
    this.assertAddress(address);
    const wallet = await prisma.wallet.findUnique({ where: { address } });
    if (!wallet) return { address, rules: [], policyBreaches: [] };

    const [rules, policyBreaches] = await Promise.all([
      prisma.alertRule.findMany({
        where: { walletId: wallet.id, status: { not: 'ARCHIVED' } },
        include: { events: { orderBy: { triggeredAt: 'desc' }, take: 5 } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.policyBreachEvent.findMany({
        where: { walletId: wallet.id },
        orderBy: { triggeredAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      address,
      rules,
      policyBreaches: policyBreaches.map((event) => ({
        ...event,
        sourceBlock: event.sourceBlock.toString(),
      })),
    };
  }

  async create(userId: string, address: string, input: CreateAlertDto) {
    this.assertAddress(address);
    const numericThreshold = Number(input.threshold);
    if (!Number.isFinite(numericThreshold) || numericThreshold < 0) {
      throw new BadRequestException('Alert threshold must be a non-negative number');
    }

    const wallet = await this.assertOwnedWallet(userId, address);

    return prisma.alertRule.create({
      data: {
        walletId: wallet.id,
        metric: input.metric,
        operator: input.operator,
        threshold: input.threshold,
        channel: input.channel,
      },
    });
  }

  async updateStatus(userId: string, id: string, input: UpdateAlertStatusDto) {
    const existing = await prisma.alertRule.findUnique({
      where: { id },
      include: { wallet: { select: { userId: true } } },
    });
    if (!existing) throw new NotFoundException('Alert rule not found');
    if (existing.wallet.userId !== userId) {
      throw new ForbiddenException('This alert rule belongs to another account');
    }
    return prisma.alertRule.update({ where: { id }, data: { status: input.status } });
  }

  /**
   * A wallet row is created by any public scan, so its existence proves nothing.
   * Ownership is only established when someone signs a challenge with that
   * address, which is what sets `userId` — so that is what we check here. An
   * unclaimed wallet is deliberately *not* claimable through this path.
   */
  private async assertOwnedWallet(userId: string, address: string) {
    const wallet = await prisma.wallet.findUnique({ where: { address } });
    if (!wallet || wallet.userId !== userId) {
      throw new ForbiddenException(
        'Sign in with this address before creating alerts for it',
      );
    }
    return wallet;
  }

  private assertAddress(address: string) {
    if (!isStacksPrincipal(address)) throw new BadRequestException('A valid Stacks principal is required');
  }
}
