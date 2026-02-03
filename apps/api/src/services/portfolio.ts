import { FastifyInstance } from "fastify";
import { MarketDataService } from "./market-data.js";

interface HoldingPerformance {
  holdingId: string;
  assetId: string;
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  currency: string;
  weight: number;
  // EUR (primary) — avgBuyPrice is stored in EUR
  avgBuyPrice: number;
  currentPriceEur: number;
  currentValueEur: number;
  totalCostEur: number;
  profitLossEur: number;
  profitLossPercent: number;
  // Native currency (secondary)
  currentPrice: number;
  currentValue: number;
}

interface PortfolioPerformance {
  // EUR (primary)
  totalValueEur: number;
  totalCostEur: number;
  totalReturnEur: number;
  totalReturnPercent: number;
  dailyChangeEur: number;
  dailyChangePercent: number;
  // Native/USD (secondary)
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  eurRate: number;
  holdings: HoldingPerformance[];
}

export class PortfolioService {
  private marketData: MarketDataService;

  constructor(private fastify: FastifyInstance) {
    this.marketData = new MarketDataService(fastify);
  }

  async calculatePerformance(portfolioId: string): Promise<PortfolioPerformance> {
    const holdings = await this.fastify.prisma.holding.findMany({
      where: { portfolioId },
      include: { asset: true },
    });

    // Collect unique currencies and fetch EUR rates for each
    const currencies = [...new Set(holdings.map((h) => h.asset.currency))];
    const rateEntries = await Promise.all(
      currencies.map(async (c) => [c, await this.marketData.getToEurRate(c)] as const)
    );
    const eurRates: Record<string, number> = Object.fromEntries(rateEntries);
    const eurRate = eurRates["USD"] || (await this.marketData.getUsdToEurRate());

    let totalValueEur = 0;
    let totalCostEur = 0;
    let dailyChangeEur = 0;
    let totalValue = 0;

    const toEur = (v: number, currency: string) =>
      currency === "EUR" ? v : +(v * (eurRates[currency] || eurRate)).toFixed(2);

    const holdingData: HoldingPerformance[] = holdings.map((h) => {
      const currency = h.asset.currency;
      const currentPrice = h.asset.currentPrice || 0;
      const previousClose = h.asset.previousClose || currentPrice;

      // EUR primary — avgBuyPrice is already stored in EUR
      const currentPriceEur = toEur(currentPrice, currency);
      const previousCloseEur = toEur(previousClose, currency);
      const currentValueEur = +(h.quantity * currentPriceEur).toFixed(2);
      const costEur = +(h.quantity * h.avgBuyPrice).toFixed(2);
      const profitLossEur = +(currentValueEur - costEur).toFixed(2);
      const profitLossPercent = costEur > 0 ? (profitLossEur / costEur) * 100 : 0;
      const dailyHoldingChangeEur = +(h.quantity * (currentPriceEur - previousCloseEur)).toFixed(2);

      // Native secondary
      const currentValue = h.quantity * currentPrice;

      totalValueEur += currentValueEur;
      totalCostEur += costEur;
      dailyChangeEur += dailyHoldingChangeEur;
      totalValue += currentValue;

      return {
        holdingId: h.id,
        assetId: h.assetId,
        symbol: h.asset.symbol,
        name: h.asset.name,
        type: h.asset.type,
        quantity: h.quantity,
        currency,
        weight: 0,
        avgBuyPrice: h.avgBuyPrice,
        currentPriceEur,
        currentValueEur,
        totalCostEur: costEur,
        profitLossEur,
        profitLossPercent,
        currentPrice,
        currentValue,
      };
    });

    // Calculate weights based on EUR values
    holdingData.forEach((h) => {
      h.weight = totalValueEur > 0 ? (h.currentValueEur / totalValueEur) * 100 : 0;
    });

    const totalReturnEur = +(totalValueEur - totalCostEur).toFixed(2);
    const totalReturnPercent = totalCostEur > 0 ? (totalReturnEur / totalCostEur) * 100 : 0;
    const dailyChangePercent =
      totalValueEur - dailyChangeEur > 0
        ? (dailyChangeEur / (totalValueEur - dailyChangeEur)) * 100
        : 0;

    // USD secondary totals (approximation at current rate)
    const totalCost = eurRate > 0 ? +(totalCostEur / eurRate).toFixed(2) : 0;
    const totalReturn = +(totalValue - totalCost).toFixed(2);

    return {
      totalValueEur,
      totalCostEur,
      totalReturnEur,
      totalReturnPercent,
      dailyChangeEur,
      dailyChangePercent,
      totalValue,
      totalCost,
      totalReturn,
      eurRate,
      holdings: holdingData,
    };
  }
}
