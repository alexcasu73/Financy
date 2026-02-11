#!/usr/bin/env tsx
/**
 * Import Price History Script
 *
 * Populates the price_history table with historical OHLCV data
 * from Yahoo Finance API (via yahoofinance2 package)
 *
 * Usage:
 *   npm install yahoofinance2
 *   tsx scripts/import-price-history.ts [--days=90] [--symbols=AAPL,MSFT]
 */

import { PrismaClient } from '@prisma/client';
import yahooFinance from 'yahoofinance2';

const prisma = new PrismaClient();

interface ImportOptions {
  days: number;
  symbols?: string[];
  batchSize: number;
  delayMs: number;
}

const DEFAULT_OPTIONS: ImportOptions = {
  days: 90,
  batchSize: 10,
  delayMs: 1000, // 1 second delay between batches to avoid rate limiting
};

async function importPriceHistory(options: ImportOptions = DEFAULT_OPTIONS) {
  console.log('🚀 Starting price history import...');
  console.log(`📅 Importing last ${options.days} days`);

  // Get assets to import
  const assets = options.symbols
    ? await prisma.asset.findMany({
        where: { symbol: { in: options.symbols } },
        select: { id: true, symbol: true, type: true },
      })
    : await prisma.asset.findMany({
        where: {
          type: { in: ['stock', 'etf'] }, // Skip crypto for now (different API)
          currentPrice: { gt: 0 }, // Only active assets
        },
        select: { id: true, symbol: true, type: true },
        orderBy: { marketCap: 'desc' },
      });

  console.log(`📊 Found ${assets.length} assets to import`);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - options.days);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process in batches
  for (let i = 0; i < assets.length; i += options.batchSize) {
    const batch = assets.slice(i, i + options.batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(assets.length / options.batchSize)}`);

    await Promise.all(
      batch.map(async (asset) => {
        try {
          // Check if we already have recent data
          const existingCount = await prisma.priceHistory.count({
            where: {
              assetId: asset.id,
              date: { gte: startDate },
            },
          });

          if (existingCount > options.days * 0.8) {
            console.log(`⏭️  ${asset.symbol}: Already has ${existingCount} records, skipping`);
            skippedCount++;
            return;
          }

          // Fetch from Yahoo Finance
          const queryOptions = {
            period1: startDate,
            period2: new Date(),
            interval: '1d' as const,
          };

          const result = await yahooFinance.historical(asset.symbol, queryOptions);

          if (!result || result.length === 0) {
            console.log(`⚠️  ${asset.symbol}: No data returned`);
            errorCount++;
            return;
          }

          // Prepare data for upsert
          const historyData = result.map((quote) => ({
            assetId: asset.id,
            date: quote.date,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            close: quote.close,
            volume: quote.volume || 0,
          }));

          // Upsert in chunks to avoid deadlocks
          for (const data of historyData) {
            await prisma.priceHistory.upsert({
              where: {
                assetId_date: {
                  assetId: data.assetId,
                  date: data.date,
                },
              },
              update: {
                open: data.open,
                high: data.high,
                low: data.low,
                close: data.close,
                volume: data.volume,
              },
              create: data,
            });
          }

          console.log(`✅ ${asset.symbol}: Imported ${historyData.length} records`);
          successCount++;
        } catch (error: any) {
          console.error(`❌ ${asset.symbol}: ${error.message}`);
          errorCount++;
        }
      })
    );

    // Delay between batches to avoid rate limiting
    if (i + options.batchSize < assets.length) {
      console.log(`⏳ Waiting ${options.delayMs}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`📈 Total: ${assets.length}`);
}

// Parse command line arguments
function parseArgs(): Partial<ImportOptions> {
  const args = process.argv.slice(2);
  const options: Partial<ImportOptions> = {};

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--symbols=')) {
      options.symbols = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--delay=')) {
      options.delayMs = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

// Main execution
async function main() {
  const customOptions = parseArgs();
  const options = { ...DEFAULT_OPTIONS, ...customOptions };

  await importPriceHistory(options);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
