import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.protocol.upsert({
    where: { id: 'native-stacks' },
    update: {},
    create: { id: 'native-stacks', name: 'Stacks Wallet', protocolType: 'wallet', contractIds: [] },
  });
  await prisma.protocol.upsert({
    where: { id: 'bitpay' },
    update: {},
    create: { id: 'bitpay', name: 'BitPay', protocolType: 'streaming-payments', contractIds: [] },
  });
}

main().finally(() => prisma.$disconnect());
