import { FastifyInstance } from "fastify";
import { z } from "zod";
import { MarketDataService } from "../services/market-data.js";

const querySchema = z.object({
  type: z.enum(["stock", "crypto", "etf", "bond", "commodity"]).optional(),
  sector: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

function enrichWithPrices(asset: any, usdToEurRate: number) {
  const isEur = asset.currency === "EUR";

  if (isEur) {
    // Native EUR asset — price is already in EUR
    return {
      ...asset,
      currentPriceEur: asset.currentPrice,
      previousCloseEur: asset.previousClose,
      marketCapEur: asset.marketCap,
      eurRate: +usdToEurRate.toFixed(6),
    };
  }

  // Native USD asset — convert to EUR
  return {
    ...asset,
    currentPriceEur: asset.currentPrice ? +(asset.currentPrice * usdToEurRate).toFixed(2) : null,
    previousCloseEur: asset.previousClose ? +(asset.previousClose * usdToEurRate).toFixed(2) : null,
    marketCapEur: asset.marketCap ? +(asset.marketCap * usdToEurRate).toFixed(0) : null,
    eurRate: +usdToEurRate.toFixed(6),
  };
}

export async function assetRoutes(fastify: FastifyInstance) {
  const marketData = new MarketDataService(fastify);

  fastify.get("/api/assets", async (request) => {
    const parsed = querySchema.parse(request.query);
    const { type, sector, search, page, limit } = parsed;

    const where: any = {};
    if (type) where.type = type;
    if (sector) where.sector = sector;
    if (search) {
      where.OR = [
        { symbol: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total, eurRate] = await Promise.all([
      fastify.prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { symbol: "asc" },
      }),
      fastify.prisma.asset.count({ where }),
      marketData.getUsdToEurRate(),
    ]);

    return {
      data: data.map((asset) => enrichWithPrices(asset, eurRate)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });

  // Import an asset from Yahoo Finance into the local DB
  fastify.post("/api/assets/import", async (request, reply) => {
    const { symbol, name, type, exchange, sector, industry } = request.body as {
      symbol: string;
      name: string;
      type: string;
      exchange?: string;
      sector?: string;
      industry?: string;
    };

    if (!symbol || !name) {
      return reply.status(400).send({ error: "symbol and name are required" });
    }

    // Check if already exists
    const existing = await fastify.prisma.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (existing) {
      const eurRate = await marketData.getUsdToEurRate();
      return enrichWithPrices(existing, eurRate);
    }

    // Map type to valid enum value
    const validTypes = ["stock", "crypto", "etf", "bond", "commodity"] as const;
    const assetType = validTypes.includes(type as any) ? (type as typeof validTypes[number]) : "stock";

    // Fetch initial price
    const isCrypto = assetType === "crypto";
    let currentPrice: number | null = null;
    let previousClose: number | null = null;
    let changePercent: number | null = null;
    let volume: number | null = null;
    let marketCap: number | null = null;
    let currency = "USD";

    if (isCrypto) {
      const quote = await marketData.getCryptoPrice(symbol);
      if (quote) {
        currentPrice = quote.price;
        previousClose = quote.previousClose;
        changePercent = quote.changePercent;
        volume = quote.volume;
        currency = quote.currency;
      }
    } else {
      const quote = await marketData.getStockQuote(symbol);
      if (quote) {
        currentPrice = quote.price;
        previousClose = quote.previousClose;
        changePercent = quote.changePercent;
        volume = quote.volume;
        currency = quote.currency;
      }
    }

    const asset = await fastify.prisma.asset.create({
      data: {
        symbol: symbol.toUpperCase(),
        name,
        type: assetType,
        exchange: exchange || null,
        sector: sector || null,
        currency,
        currentPrice,
        previousClose,
        changePercent,
        volume,
        marketCap,
      },
    });

    const eurRate = await marketData.getToEurRate(currency);
    return reply.status(201).send(enrichWithPrices(asset, eurRate));
  });

  // Search across all Yahoo Finance assets (stocks, ETFs, crypto, etc.)
  fastify.get("/api/assets/search", async (request) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length < 1) {
      return { results: [] };
    }
    const results = await marketData.searchAssets(q.trim());

    // Fetch quotes in parallel for all results
    const quotes = await Promise.allSettled(
      results.map((r) =>
        r.type === "crypto"
          ? marketData.getCryptoPrice(r.symbol)
          : marketData.getStockQuote(r.symbol)
      )
    );

    // Collect unique currencies and fetch EUR rates in parallel
    const currencies = new Set<string>();
    for (let i = 0; i < quotes.length; i++) {
      const result = quotes[i];
      if (result.status === "fulfilled" && result.value) {
        currencies.add((result.value as any).currency || "USD");
      }
    }
    const rateMap: Record<string, number> = { EUR: 1 };
    const rateEntries = await Promise.allSettled(
      [...currencies]
        .filter((c) => c !== "EUR")
        .map(async (c) => [c, await marketData.getToEurRate(c)] as const)
    );
    for (const entry of rateEntries) {
      if (entry.status === "fulfilled") {
        rateMap[entry.value[0]] = entry.value[1];
      }
    }

    const enriched = results.map((r, i) => {
      const result = quotes[i];
      const quote =
        result.status === "fulfilled" && result.value ? result.value : null;
      const price = quote?.price ?? null;
      const currency = (quote as any)?.currency || "USD";
      const eurRate = rateMap[currency] ?? rateMap["USD"] ?? 0.84;
      const priceEur = price != null ? +(price * eurRate).toFixed(2) : null;
      return {
        ...r,
        currentPrice: price,
        currentPriceEur: priceEur,
        previousClose: quote?.previousClose ?? null,
        changePercent: quote?.changePercent ?? null,
        volume: quote?.volume ?? null,
        currency,
      };
    });

    return { results: enriched };
  });

  fastify.get("/api/assets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [asset, eurRate] = await Promise.all([
      fastify.prisma.asset.findUnique({ where: { id } }),
      marketData.getUsdToEurRate(),
    ]);

    if (!asset) {
      return reply.status(404).send({ error: "Not Found", message: "Asset not found" });
    }

    return enrichWithPrices(asset, eurRate);
  });

  // Delete a tracked asset (cascades to holdings, alerts, etc.)
  fastify.delete("/api/assets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await fastify.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({ error: "Not Found", message: "Asset not found" });
    }
    await fastify.prisma.asset.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Refresh all asset prices from real APIs
  fastify.post("/api/assets/refresh-prices", async (request, reply) => {
    fastify.log.info("Starting price refresh for all assets...");
    const result = await marketData.refreshAllPrices();
    return {
      message: `Refreshed ${result.updated} assets`,
      ...result,
    };
  });
}
