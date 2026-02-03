import { FastifyInstance } from "fastify";
import { z } from "zod";
import { MarketDataService } from "../services/market-data.js";

const addHoldingSchema = z.object({
  assetId: z.string(),
  quantity: z.number().positive(),
  avgBuyPrice: z.number().positive(),
});

const updateHoldingSchema = z.object({
  assetId: z.string().optional(),
  quantity: z.number().positive().optional(),
  avgBuyPrice: z.number().positive().optional(),
});

export async function holdingRoutes(fastify: FastifyInstance) {
  const marketData = new MarketDataService(fastify);

  // Protect all routes
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get("/api/portfolios/:id/holdings", async (request, reply) => {
    const { id } = request.params as { id: string };

    const portfolio = await fastify.prisma.portfolio.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!portfolio) {
      return reply.status(404).send({ error: "Not Found", message: "Portfolio not found" });
    }

    const holdings = await fastify.prisma.holding.findMany({
      where: { portfolioId: id },
      include: { asset: true },
    });

    // Collect unique currencies and fetch EUR rates for each
    const currencies = [...new Set(holdings.map((h) => h.asset.currency))];
    const rateEntries = await Promise.all(
      currencies.map(async (c) => [c, await marketData.getToEurRate(c)] as const)
    );
    const eurRates: Record<string, number> = Object.fromEntries(rateEntries);
    const eurRate = eurRates["USD"] || (await marketData.getUsdToEurRate());

    const toEur = (v: number, currency: string) =>
      currency === "EUR" ? v : +(v * (eurRates[currency] || eurRate)).toFixed(2);

    return holdings.map((h) => {
      const currency = h.asset.currency;
      const currentPrice = h.asset.currentPrice || 0;

      // EUR primary — avgBuyPrice is stored in EUR
      const currentPriceEur = toEur(currentPrice, currency);
      const currentValueEur = +(h.quantity * currentPriceEur).toFixed(2);
      const totalCostEur = +(h.quantity * h.avgBuyPrice).toFixed(2);
      const profitLossEur = +(currentValueEur - totalCostEur).toFixed(2);
      const profitLossPercent =
        totalCostEur > 0 ? (profitLossEur / totalCostEur) * 100 : 0;

      // Native secondary
      const currentValue = h.quantity * currentPrice;

      return {
        ...h,
        symbol: h.asset.symbol,
        name: h.asset.name,
        type: h.asset.type,
        currency,
        currentPrice,
        currentValue,
        currentPriceEur,
        currentValueEur,
        totalCostEur,
        profitLossEur,
        profitLossPercent,
        eurRate,
      };
    });
  });

  fastify.post("/api/portfolios/:id/holdings", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = addHoldingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const portfolio = await fastify.prisma.portfolio.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!portfolio) {
      return reply.status(404).send({ error: "Not Found", message: "Portfolio not found" });
    }

    const asset = await fastify.prisma.asset.findUnique({
      where: { id: parsed.data.assetId },
    });
    if (!asset) {
      return reply.status(404).send({ error: "Not Found", message: "Asset not found" });
    }

    const holding = await fastify.prisma.holding.upsert({
      where: {
        portfolioId_assetId: {
          portfolioId: id,
          assetId: parsed.data.assetId,
        },
      },
      create: { portfolioId: id, ...parsed.data },
      update: {
        quantity: parsed.data.quantity,
        avgBuyPrice: parsed.data.avgBuyPrice,
      },
      include: { asset: true },
    });

    return reply.status(201).send(holding);
  });

  fastify.put("/api/holdings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateHoldingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const holding = await fastify.prisma.holding.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!holding || holding.portfolio.userId !== request.user.id) {
      return reply.status(404).send({ error: "Not Found", message: "Holding not found" });
    }

    const updated = await fastify.prisma.holding.update({
      where: { id },
      data: parsed.data,
      include: { asset: true },
    });

    return updated;
  });

  fastify.delete("/api/holdings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const holding = await fastify.prisma.holding.findUnique({
      where: { id },
      include: { portfolio: true },
    });
    if (!holding || holding.portfolio.userId !== request.user.id) {
      return reply.status(404).send({ error: "Not Found", message: "Holding not found" });
    }

    await fastify.prisma.holding.delete({ where: { id } });
    return reply.status(204).send();
  });
}
