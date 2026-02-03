import { FastifyInstance } from "fastify";
import { MarketDataService } from "../services/market-data.js";

export async function priceRoutes(fastify: FastifyInstance) {
  const marketData = new MarketDataService(fastify);

  fastify.get("/api/assets/:id/prices", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { period, source } = request.query as { period?: string; source?: string };

    const asset = await fastify.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({ error: "Not Found", message: "Asset not found" });
    }

    // Try real API first for stocks/ETFs
    if (asset.type !== "crypto") {
      try {
        const apiPrices = await marketData.getHistoricalPrices(asset.symbol, period);
        if (apiPrices.length > 0) {
          return apiPrices;
        }
      } catch (error) {
        fastify.log.warn(`API fetch failed for ${asset.symbol}, falling back to DB`);
      }
    }

    // For crypto, get current price from CoinGecko
    if (asset.type === "crypto") {
      const quote = await marketData.getCryptoPrice(asset.symbol);
      if (quote) {
        return [{ date: new Date().toISOString(), close: quote.price, open: quote.previousClose, high: quote.price, low: quote.previousClose, volume: quote.volume }];
      }
    }

    // Fallback to database
    const dbPrices = await fastify.prisma.priceHistory.findMany({
      where: { assetId: id },
      orderBy: { date: "desc" },
      take: 100,
    });

    return dbPrices.reverse();
  });

  fastify.get("/api/assets/:id/signals", async (request, reply) => {
    const { id } = request.params as { id: string };

    const asset = await fastify.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({ error: "Not Found", message: "Asset not found" });
    }

    const signals = await fastify.prisma.technicalSignal.findMany({
      where: { assetId: id },
      orderBy: { calculatedAt: "desc" },
      take: 10,
    });

    return signals;
  });
}
