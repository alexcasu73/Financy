import { FastifyInstance } from "fastify";
import { z } from "zod";
import { MarketDataService } from "../services/market-data";

const createAlertSchema = z.object({
  assetId: z.string().optional(),
  symbol: z.string().optional(),
  type: z.enum(["price_above", "price_below", "percent_change", "volume_spike", "technical_signal"]),
  condition: z.object({
    threshold: z.number(),
    indicator: z.string().optional(),
    signal: z.string().optional(),
  }),
  channels: z.array(z.enum(["email", "telegram", "in_app"])),
}).refine(data => data.assetId || data.symbol, {
  message: "Either assetId or symbol must be provided",
});

const updateAlertSchema = z.object({
  type: z.enum(["price_above", "price_below", "percent_change", "volume_spike", "technical_signal"]).optional(),
  condition: z.object({
    threshold: z.number(),
    indicator: z.string().optional(),
    signal: z.string().optional(),
  }).optional(),
  status: z.enum(["active", "triggered", "paused", "expired"]).optional(),
  channels: z.array(z.enum(["email", "telegram", "in_app"])).optional(),
});

export async function alertRoutes(fastify: FastifyInstance) {
  // Protect all routes in this plugin
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get("/api/alerts", async (request) => {
    const alerts = await fastify.prisma.alert.findMany({
      where: { userId: request.user.id },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    });

    // Get EUR conversion rates
    const marketData = new MarketDataService(fastify);
    const eurRates = await marketData.getEurRates();
    const defaultRate = eurRates["USD"] || (await marketData.getUsdToEurRate());

    const toEur = (value: number, currency: string) =>
      currency === "EUR" ? value : +(value * (eurRates[currency] || defaultRate)).toFixed(2);

    return alerts.map((a) => {
      const currency = a.asset.currency || "USD";
      const currentPrice = a.asset.currentPrice || 0;
      const currentPriceEur = toEur(currentPrice, currency);

      return {
        ...a,
        symbol: a.asset.symbol,
        name: a.asset.name,
        currency,
        currentPrice,
        currentPriceEur,
        changePercent: a.asset.changePercent,
        sector: a.asset.sector,
      };
    });
  });

  fastify.post("/api/alerts", async (request, reply) => {
    const parsed = createAlertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    let assetId = parsed.data.assetId;

    // If symbol is provided instead of assetId, find or create the asset
    if (!assetId && parsed.data.symbol) {
      const symbol = parsed.data.symbol.toUpperCase();

      // Check if asset already exists in DB
      let asset = await fastify.prisma.asset.findFirst({
        where: { symbol },
      });

      if (!asset) {
        // Fetch from Yahoo Finance
        const marketData = new MarketDataService(fastify);
        const quote = await marketData.getDetailedQuote(symbol);

        if (!quote) {
          return reply.status(404).send({
            error: "Not Found",
            message: `Asset ${symbol} not found on Yahoo Finance`
          });
        }

        // Create asset in DB
        asset = await fastify.prisma.asset.create({
          data: {
            symbol: quote.symbol,
            name: quote.name,
            type: "stock",
            sector: quote.sector,
            exchange: "US",
            currency: quote.currency,
            currentPrice: quote.price,
            previousClose: quote.price / (1 + quote.changePercent / 100),
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
          },
        });

        fastify.log.info(`Created asset from Yahoo Finance: ${asset.symbol} (${asset.id})`);
      }

      assetId = asset.id;
    }

    // Validate assetId exists
    const asset = await fastify.prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      return reply.status(404).send({ error: "Not Found", message: "Asset not found" });
    }

    const alert = await fastify.prisma.alert.create({
      data: {
        userId: request.user.id,
        assetId,
        type: parsed.data.type,
        condition: parsed.data.condition,
        channels: parsed.data.channels,
      },
      include: { asset: true },
    });

    return reply.status(201).send(alert);
  });

  fastify.put("/api/alerts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateAlertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const existing = await fastify.prisma.alert.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Not Found", message: "Alert not found" });
    }

    const alert = await fastify.prisma.alert.update({
      where: { id },
      data: parsed.data,
      include: { asset: true },
    });

    return alert;
  });

  fastify.delete("/api/alerts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await fastify.prisma.alert.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Not Found", message: "Alert not found" });
    }

    // Se l'alert era stato creato da un suggerimento, ripristina il suggerimento
    await fastify.prisma.alertSuggestion.updateMany({
      where: { acceptedAlertId: id },
      data: { acceptedAlertId: null },
    });

    await fastify.prisma.alert.delete({ where: { id } });
    return reply.status(204).send();
  });

  fastify.get("/api/alerts/:id/history", async (request, reply) => {
    const { id } = request.params as { id: string };

    const alert = await fastify.prisma.alert.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!alert) {
      return reply.status(404).send({ error: "Not Found", message: "Alert not found" });
    }

    const history = await fastify.prisma.alertHistory.findMany({
      where: { alertId: id },
      orderBy: { triggeredAt: "desc" },
    });

    return history;
  });

  // Get price tracking data for an alert
  fastify.get("/api/alerts/:id/tracking", async (request, reply) => {
    const { id } = request.params as { id: string };

    const alert = await fastify.prisma.alert.findFirst({
      where: { id, userId: request.user.id },
      include: {
        priceTracks: {
          orderBy: { recordedAt: "asc" },
          take: 500,
        },
        asset: true,
      },
    });

    if (!alert) {
      return reply.status(404).send({ error: "Not Found", message: "Alert not found" });
    }

    const condition = alert.condition as { threshold: number };

    return {
      alertId: alert.id,
      symbol: alert.asset.symbol,
      alertType: alert.type,
      threshold: condition.threshold,
      currentPrice: alert.asset.currentPrice,
      isTracking: alert.isTracking,
      trackingStartedAt: alert.trackingStartedAt,
      tracks: alert.priceTracks.map((t) => ({
        price: t.price,
        threshold: t.threshold,
        recordedAt: t.recordedAt,
      })),
    };
  });
}
