import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const commonAssets = [
  // Tech stocks
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'MU', name: 'Micron Technology, Inc.', type: 'stock', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', type: 'stock', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'INTC', name: 'Intel Corporation', type: 'stock', sector: 'Technology', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', type: 'stock', sector: 'Consumer Cyclical', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', type: 'stock', sector: 'Technology', exchange: 'NASDAQ' },

  // Finance
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', type: 'stock', sector: 'Financial Services', exchange: 'NYSE' },
  { symbol: 'BAC', name: 'Bank of America Corporation', type: 'stock', sector: 'Financial Services', exchange: 'NYSE' },
  { symbol: 'PFSI', name: 'PennyMac Financial Services', type: 'stock', sector: 'Financial Services', exchange: 'NYSE' },

  // Commodities
  { symbol: 'VALE', name: 'Vale S.A.', type: 'stock', sector: 'Basic Materials', exchange: 'NYSE' },
  { symbol: 'GLD', name: 'SPDR Gold Trust', type: 'etf', sector: 'Commodities', exchange: 'NYSE' },
  { symbol: 'SLV', name: 'iShares Silver Trust', type: 'etf', sector: 'Commodities', exchange: 'NYSE' },

  // Auto
  { symbol: 'F', name: 'Ford Motor Company', type: 'stock', sector: 'Consumer Cyclical', exchange: 'NYSE' },
  { symbol: 'GM', name: 'General Motors Company', type: 'stock', sector: 'Consumer Cyclical', exchange: 'NYSE' },

  // Crypto
  { symbol: 'BTC-USD', name: 'Bitcoin USD', type: 'crypto', sector: 'Cryptocurrency', exchange: 'CCC' },
  { symbol: 'ETH-USD', name: 'Ethereum USD', type: 'crypto', sector: 'Cryptocurrency', exchange: 'CCC' },
];

async function main() {
  console.log('🌱 Seeding trading assets...');

  for (const asset of commonAssets) {
    try {
      await prisma.asset.upsert({
        where: { symbol: asset.symbol },
        update: {
          name: asset.name,
          type: asset.type as any,
          sector: asset.sector,
          exchange: asset.exchange,
        },
        create: {
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type as any,
          sector: asset.sector,
          exchange: asset.exchange,
        },
      });
      console.log(`✅ ${asset.symbol} - ${asset.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed ${asset.symbol}:`, error);
    }
  }

  console.log('✨ Done seeding assets!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
