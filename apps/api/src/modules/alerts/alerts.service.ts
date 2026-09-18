import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@riskrail/database';
import { isStacksPrincipal } from '@riskrail/stacks';
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

  async create(address: string, input: CreateAlertDto) {
    this.assertAddress(address);
    const numericThreshold = Number(input.threshold);
    if (!Number.isFinite(numericThreshold) || numericThreshold < 0) {
      throw new BadRequestException('Alert threshold must be a non-negative number');
    }
    const wallet = await prisma.wallet.upsert({ where: { address }, update: {}, create: { address } });
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

  async updateStatus(id: string, input: UpdateAlertStatusDto) {
    const existing = await prisma.alertRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Alert rule not found');
    return prisma.alertRule.update({ where: { id }, data: { status: input.status } });
  }

  private assertAddress(address: string) {
    if (!isStacksPrincipal(address)) throw new BadRequestException('A valid Stacks principal is required');
  }
}
