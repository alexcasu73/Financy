import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const holdings = await prisma.holding.findMany({
    include: { asset: true },
    orderBy: { quantity: 'desc' }
  });

  console.log('\n=== PORTFOLIO HOLDINGS ===\n');
  console.log('Symbol | Qty | AvgBuy€ | Current | Curr | Value€');
  console.log('-------|-----|---------|---------|------|--------');

  let totalValue = 0;

  for (const h of holdings) {
    const currentPrice = h.asset.currentPrice || 0;
    const currency = h.asset.currency;
    const eurRate = currency === 'EUR' ? 1 : 0.847386;
    const priceEur = currentPrice * eurRate;
    const valueEur = h.quantity * priceEur;
    totalValue += valueEur;

    console.log(
      `${h.asset.symbol.padEnd(6)} | ` +
      `${h.quantity.toString().padEnd(3)} | ` +
      `${h.avgBuyPrice.toFixed(2).padStart(7)} | ` +
      `${currentPrice.toFixed(2).padStart(7)} | ` +
      `${currency.padEnd(4)} | ` +
      `${valueEur.toFixed(2).padStart(8)}`
    );
  }

  console.log('-------|-----|---------|---------|------|--------');
  console.log(`TOTAL VALUE: ${totalValue.toFixed(2)}€\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
