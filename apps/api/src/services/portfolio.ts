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
      include: { asset: true, portfolio: { include: { user: { include: { settings: true } } } } },
    });

    if (holdings.length === 0) {
      return {
        totalValueEur: 0,
        totalCostEur: 0,
        totalReturnEur: 0,
        totalReturnPercent: 0,
        dailyChangeEur: 0,
        dailyChangePercent: 0,
        totalValue: 0,
        totalCost: 0,
        totalReturn: 0,
        eurRate: 1,
        holdings: [],
      };
    }

    // Get EUR price adjustment factor from user settings
    const eurAdjustmentFactor = holdings[0].portfolio.user.settings?.eurPriceAdjustmentFactor ?? 1.0;

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

    // Helper to convert to EUR with high precision (no intermediate rounding)
    const toEur = (v: number, currency: string): number =>
      currency === "EUR" ? v : v * (eurRates[currency] || eurRate);

    const holdingData: HoldingPerformance[] = holdings.map((h) => {
      const currency = h.asset.currency;
      const currentPrice = h.asset.currentPrice || 0;
      const previousClose = h.asset.previousClose || currentPrice;
      const fxRate = eurRates[currency] || eurRate;

      // EUR primary — avgBuyPrice is already stored in EUR
      // Calculate with full precision, round only final values
      // Apply EUR adjustment factor for EUR prices (Trade Republic calibration)
      const currentPriceEurRaw = currency === "EUR"
        ? currentPrice * eurAdjustmentFactor
        : currentPrice * fxRate;
      const previousCloseEurRaw = currency === "EUR"
        ? previousClose * eurAdjustmentFactor
        : previousClose * fxRate;

      // Round only display values with maximum precision
      const currentPriceEur = +currentPriceEurRaw.toFixed(8); // Keep 8 decimals for price
      const previousCloseEur = +previousCloseEurRaw.toFixed(8);

      // Calculate values with full precision, then round to cents
      const currentValueEur = +(h.quantity * currentPriceEurRaw).toFixed(2);
      const costEur = +(h.quantity * h.avgBuyPrice).toFixed(2);
      const profitLossEur = +(currentValueEur - costEur).toFixed(2);
      const profitLossPercent = costEur > 0 ? (profitLossEur / costEur) * 100 : 0;
      const dailyHoldingChangeEur = +(h.quantity * (currentPriceEurRaw - previousCloseEurRaw)).toFixed(2);

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
