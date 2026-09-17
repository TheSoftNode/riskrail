import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.protocol.upsert({
    where: { id: 'native-stacks' },
    update: { name: 'Stacks Wallet', protocolType: 'wallet', contractIds: [] },
    create: {
      id: 'native-stacks',
      name: 'Stacks Wallet',
      protocolType: 'wallet',
      contractIds: [],
    },
  });

  const bitPayContract = process.env.BITPAY_CORE_CONTRACT?.trim();
  await prisma.protocol.upsert({
    where: { id: 'bitpay' },
    update: {
      name: 'BitPay',
      protocolType: 'streaming-payments',
      contractIds: bitPayContract ? [bitPayContract] : [],
    },
    create: {
      id: 'bitpay',
      name: 'BitPay',
      protocolType: 'streaming-payments',
      contractIds: bitPayContract ? [bitPayContract] : [],
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
