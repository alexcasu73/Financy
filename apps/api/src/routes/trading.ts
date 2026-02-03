import { FastifyInstance } from "fastify";
import { z } from "zod";
import { TradingService } from "../services/trading";
import { MarketDataService } from "../services/market-data";

const profileSchema = z.object({
  horizon: z.enum(["short", "medium", "long"]),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  targetProfitPct: z.number().min(1).max(100),
  maxLossPct: z.number().min(1).max(50),
  preferredSectors: z.array(z.string()),
  investmentPerTrade: z.number().optional(),
  tradingStyle: z.enum(["momentum", "value", "swing", "scalping"]).optional(),
  analysisInterval: z.number().min(0).max(1440).optional(), // 0 = disabled, 15-1440 min
  suggestionInterval: z.number().min(0).max(1440).optional(), // 0 = disabled, 60-1440 min
  resuggestDismissedAfterDays: z.number().min(0).max(365).optional(), // days before re-suggesting dismissed assets (0 = always)
});

const cashBalanceSchema = z.object({
  amount: z.number().positive(),
});

const updateProfileSchema = profileSchema.partial();

const addAssetSchema = z.object({
  assetId: z.string(),
});

const executeBuySchema = z.object({
  quantity: z.number().positive(),
});

export async function tradingRoutes(fastify: FastifyInstance) {
  const tradingService = new TradingService(fastify);

  // Protect all routes
  fastify.addHook("onRequest", fastify.authenticate);

  // ==================== PROFILE ====================

  // GET /api/trading/profile - Get user's trading profile
  fastify.get("/api/trading/profile", async (request) => {
    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });
    return profile || null;
  });

  // POST /api/trading/profile - Create trading profile (from survey)
  fastify.post("/api/trading/profile", async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    // Check if profile already exists
    const existing = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });

    if (existing) {
      // Update existing profile
      const profile = await fastify.prisma.tradingProfile.update({
        where: { userId: request.user.id },
        data: parsed.data,
      });
      return profile;
    }

    // Create new profile
    const profile = await fastify.prisma.tradingProfile.create({
      data: {
        userId: request.user.id,
        ...parsed.data,
      },
    });

    return reply.status(201).send(profile);
  });

  // PUT /api/trading/profile - Update trading profile
  fastify.put("/api/trading/profile", async (request, reply) => {
    fastify.log.info({ body: request.body }, "PUT /api/trading/profile received");

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      fastify.log.error({ error: parsed.error }, "Validation error in PUT /api/trading/profile");
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    fastify.log.info({ data: parsed.data }, "Updating trading profile");

    const profile = await fastify.prisma.tradingProfile.update({
      where: { userId: request.user.id },
      data: parsed.data,
    });

    fastify.log.info({ profile }, "Trading profile updated");
    return profile;
  });

  // DELETE /api/trading/profile - Delete trading profile
  fastify.delete("/api/trading/profile", async (request, reply) => {
    try {
      await fastify.prisma.tradingProfile.delete({
        where: { userId: request.user.id },
      });
      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Record not found
        return reply.status(404).send({ error: "Not found", message: "Trading profile not found" });
      }
      throw error;
    }
  });

  // ==================== CASH BALANCE ====================

  // GET /api/trading/balance - Get cash balance
  fastify.get("/api/trading/balance", async (request) => {
    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });

    if (!profile) {
      return { cashBalance: 0 };
    }

    return { cashBalance: profile.cashBalance };
  });

  // POST /api/trading/balance/deposit - Deposit funds
  fastify.post("/api/trading/balance/deposit", async (request, reply) => {
    const parsed = cashBalanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });

    if (!profile) {
      return reply.status(404).send({ error: "Not found", message: "Trading profile not found. Complete the survey first." });
    }

    const updatedProfile = await fastify.prisma.tradingProfile.update({
      where: { id: profile.id },
      data: {
        cashBalance: { increment: parsed.data.amount },
      },
    });

    fastify.log.info(`Deposit: +€${parsed.data.amount.toFixed(2)}, New balance: €${updatedProfile.cashBalance.toFixed(2)}`);

    return {
      cashBalance: updatedProfile.cashBalance,
      deposited: parsed.data.amount,
    };
  });

  // POST /api/trading/balance/withdraw - Withdraw funds
  fastify.post("/api/trading/balance/withdraw", async (request, reply) => {
    const parsed = cashBalanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });

    if (!profile) {
      return reply.status(404).send({ error: "Not found", message: "Trading profile not found." });
    }

    if (profile.cashBalance < parsed.data.amount) {
      return reply.status(400).send({
        error: "Insufficient funds",
        message: `Saldo insufficiente. Disponibili: €${profile.cashBalance.toFixed(2)}`
      });
    }

    const updatedProfile = await fastify.prisma.tradingProfile.update({
      where: { id: profile.id },
      data: {
        cashBalance: { decrement: parsed.data.amount },
      },
    });

    fastify.log.info(`Withdraw: -€${parsed.data.amount.toFixed(2)}, New balance: €${updatedProfile.cashBalance.toFixed(2)}`);

    return {
      cashBalance: updatedProfile.cashBalance,
      withdrawn: parsed.data.amount,
    };
  });

  // ==================== TRADING ASSETS ====================

  // GET /api/trading/assets - Get all trading assets
  fastify.get("/api/trading/assets", async (request) => {
    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });

    if (!profile) {
      return [];
    }

    const tradingAssets = await fastify.prisma.tradingAsset.findMany({
      where: { profileId: profile.id },
      include: {
        asset: true,
        signals: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get EUR conversion rates
    const marketData = new MarketDataService(fastify);
    const eurRates = await marketData.getEurRates();
    const defaultRate = eurRates["USD"] || (await marketData.getUsdToEurRate());

    const toEur = (value: number, currency: string) =>
      currency === "EUR" ? value : +(value * (eurRates[currency] || defaultRate)).toFixed(2);

    // Log signals data for debugging
    fastify.log.info(`📊 Trading assets query returned ${tradingAssets.length} assets`);
    tradingAssets.forEach(ta => {
      if (ta.signals && ta.signals.length > 0) {
        fastify.log.info(`  - ${ta.asset.symbol}: ${ta.signals.length} signals, latest: ${ta.signals[0].action}`);
      }
    });

    // Calculate current profit and EUR prices
    return tradingAssets.map((ta) => {
      const currency = ta.asset.currency;
      const currentPrice = ta.asset.currentPrice || 0;
      const currentPriceEur = toEur(currentPrice, currency);

      // Calculate profit using native currency to avoid exchange rate fluctuation issues
      let currentProfitPct = null;
      if (ta.status === "bought" && ta.entryPriceNative && currentPrice) {
        // Use native currency for accurate P/L (avoids exchange rate changes affecting the calculation)
        currentProfitPct = ((currentPrice - ta.entryPriceNative) / ta.entryPriceNative) * 100;
      } else if (ta.status === "bought" && ta.entryPrice && currentPriceEur) {
        // Fallback to EUR if native price not available
        currentProfitPct = ((currentPriceEur - ta.entryPrice) / ta.entryPrice) * 100;
      }

      return {
        ...ta,
        currentProfitPct,
        symbol: ta.asset.symbol,
        name: ta.asset.name,
        currency,
        currentPrice,
        currentPriceEur,
        changePercent: ta.asset.changePercent, // daily change of the asset
        previousClose: ta.asset.previousClose,
        entryPriceEur: ta.entryPrice, // already in EUR
        entryPriceNative: ta.entryPriceNative, // original currency price
        exitPriceEur: ta.exitPrice, // already in EUR
        targetPriceEur: ta.targetPrice, // already in EUR
        stopLossPriceEur: ta.stopLossPrice, // already in EUR
        signals: ta.signals, // Include latest signals
      };
    });
  });

  // POST /api/trading/assets - Add asset to trading
  fastify.post("/api/trading/assets", async (request, reply) => {
    const parsed = addAssetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });

    if (!profile) {
      return reply.status(400).send({ error: "No profile", message: "Create a trading profile first" });
    }

    // Check if already exists
    const existing = await fastify.prisma.tradingAsset.findUnique({
      where: {
        profileId_assetId: {
          profileId: profile.id,
          assetId: parsed.data.assetId,
        },
      },
    });

    if (existing) {
      return reply.status(400).send({ error: "Already exists", message: "Asset already in trading list" });
    }

    const tradingAsset = await tradingService.addAssetToTrading(
      profile.id,
      parsed.data.assetId
    );

    return reply.status(201).send(tradingAsset);
  });

  // PUT /api/trading/assets/:id/buy - Execute buy
  fastify.put("/api/trading/assets/:id/buy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = executeBuySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    // Verify ownership
    const tradingAsset = await fastify.prisma.tradingAsset.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!tradingAsset || tradingAsset.profile.userId !== request.user.id) {
      return reply.status(404).send({ error: "Not found", message: "Trading asset not found" });
    }

    const updated = await tradingService.executeBuy(id, parsed.data.quantity);
    return updated;
  });

  // PUT /api/trading/assets/:id/sell - Execute sell
  fastify.put("/api/trading/assets/:id/sell", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership
    const tradingAsset = await fastify.prisma.tradingAsset.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!tradingAsset || tradingAsset.profile.userId !== request.user.id) {
      return reply.status(404).send({ error: "Not found", message: "Trading asset not found" });
    }

    const updated = await tradingService.executeSell(id);
    return updated;
  });

  // DELETE /api/trading/assets/:id - Remove from trading
  fastify.delete("/api/trading/assets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership
    const tradingAsset = await fastify.prisma.tradingAsset.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!tradingAsset || tradingAsset.profile.userId !== request.user.id) {
      return reply.status(404).send({ error: "Not found", message: "Trading asset not found" });
    }

    await fastify.prisma.tradingAsset.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ==================== SIGNALS ====================

  // GET /api/trading/signals - Get recent signals
  fastify.get("/api/trading/signals", async (request) => {
    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: request.user.id },
    });

    if (!profile) {
      return [];
    }

    const signals = await fastify.prisma.tradingSignal.findMany({
      where: {
        tradingAsset: { profileId: profile.id },
      },
      include: {
        tradingAsset: {
          include: { asset: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Get EUR conversion rates
    const marketData = new MarketDataService(fastify);
    const eurRates = await marketData.getEurRates();
    const defaultRate = eurRates["USD"] || (await marketData.getUsdToEurRate());

    const toEur = (value: number, currency: string) =>
      currency === "EUR" ? value : +(value * (eurRates[currency] || defaultRate)).toFixed(2);

    // Filter out SELL signals for bought assets that haven't reached target/stop loss
    const filteredSignals = signals.filter((s) => {
      // Always show BUY and HOLD signals
      if (s.action !== "SELL") return true;

      // For SELL signals on bought assets, check if target or stop loss reached
      const ta = s.tradingAsset;
      if (ta.status !== "bought") return true; // Show for non-bought assets

      const entryPrice = ta.entryPrice || 0;
      const currentPrice = ta.asset.currentPrice || 0;
      const currency = ta.asset.currency;
      const currentPriceEur = toEur(currentPrice, currency);

      if (entryPrice <= 0) return false; // No entry price, hide signal

      const profitPct = ((currentPriceEur - entryPrice) / entryPrice) * 100;

      // Get target and stop loss from profile
      const targetPct = profile.targetProfitPct || 10;
      const stopLossPct = profile.maxLossPct || 10;

      // Only show SELL if target reached or stop loss triggered
      return profitPct >= targetPct || profitPct <= -stopLossPct;
    });

    return filteredSignals.map((s) => {
      const currency = s.tradingAsset.asset.currency;
      return {
        ...s,
        symbol: s.tradingAsset.asset.symbol,
        name: s.tradingAsset.asset.name,
        currency,
        priceAtSignalEur: toEur(s.priceAtSignal, currency),
      };
    });
  });

  // POST /api/trading/signals/:id/execute - Mark signal as executed
  fastify.post("/api/trading/signals/:id/execute", async (request, reply) => {
    const { id } = request.params as { id: string };

    const signal = await fastify.prisma.tradingSignal.findUnique({
      where: { id },
      include: {
        tradingAsset: {
          include: { profile: true },
        },
      },
    });

    if (!signal || signal.tradingAsset.profile.userId !== request.user.id) {
      return reply.status(404).send({ error: "Not found", message: "Signal not found" });
    }

    const updated = await fastify.prisma.tradingSignal.update({
      where: { id },
      data: { executed: true },
    });

    return updated;
  });

  // POST /api/trading/analyze - Analyze trading positions
  fastify.post("/api/trading/analyze", async (request, reply) => {
    try {
      // Call n8n webhook to analyze trading assets
      const n8nUrl = process.env.N8N_WEBHOOK_URL || "http://127.0.0.1:5678/webhook";
      fastify.log.info(`Calling n8n webhook at ${n8nUrl}/analyze-assets for user ${request.user.id}`);

      const response = await fetch(`${n8nUrl}/analyze-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: request.user.id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error(`n8n webhook failed with status ${response.status}: ${errorText}`);
        return reply.status(503).send({
          success: false,
          error: "AI Analysis Unavailable",
          message: "Il servizio di analisi AI non è disponibile. Riprova tra qualche minuto.",
          details: errorText
        });
      }

      const result = await response.json() as {
        success?: boolean;
        signalsGenerated?: number;
        assetsAnalyzed?: number;
        suggestions?: any[];
        message?: string;
      };

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: "AI Analysis Failed",
          message: result.message || "L'analisi AI non ha prodotto risultati.",
        });
      }

      return {
        success: true,
        signalsSent: result.signalsGenerated || 0,
        assetsAnalyzed: result.assetsAnalyzed || 0,
        suggestions: result.suggestions || [],
        message: result.message || "Analisi completata"
      };
    } catch (error: any) {
      fastify.log.error(error, "n8n webhook error");
      return reply.status(503).send({
        success: false,
        error: "AI Analysis Error",
        message: "Errore nella comunicazione con il servizio AI. Verifica che n8n sia attivo.",
        details: error.message
      });
    }
  });

  // ==================== SUGGESTIONS ====================

  // GET /api/trading/suggestions - Get pending suggestions
  fastify.get("/api/trading/suggestions", async (request) => {
    return tradingService.getSuggestions(request.user.id);
  });

  // POST /api/trading/suggestions/generate - Generate new suggestions via n8n
  fastify.post("/api/trading/suggestions/generate", async (request, reply) => {
    try {
      const n8nUrl = process.env.N8N_WEBHOOK_URL || "http://127.0.0.1:5678/webhook";
      fastify.log.info(`Calling n8n workflow at ${n8nUrl}/trading-suggestions for user ${request.user.id}`);

      const response = await fetch(`${n8nUrl}/trading-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: request.user.id }),
      });

      if (!response.ok) {
        throw new Error(`n8n webhook failed with status ${response.status}`);
      }

      const result = await response.json() as { success?: boolean; count?: number; message?: string };

      return {
        success: true,
        count: result.count || 0,
        message: result.message || "Suggerimenti generati tramite n8n"
      };
    } catch (error: any) {
      fastify.log.error(error, "n8n workflow error");
      return reply.status(500).send({
        success: false,
        error: "Generation Failed",
        message: error.message || "Errore nella generazione dei suggerimenti tramite n8n",
      });
    }
  });

  // POST /api/trading/suggestions/:id/accept - Accept a suggestion
  fastify.post("/api/trading/suggestions/:id/accept", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      status?: "watching" | "bought";
      entryPrice?: number;
      quantity?: number;
    };
    try {
      const tradingAsset = await tradingService.acceptSuggestion(id, request.user.id, body);
      return reply.status(201).send(tradingAsset);
    } catch (error: any) {
      return reply.status(400).send({ error: "Error", message: error.message });
    }
  });

  // PUT /api/trading/suggestions/:id/dismiss - Dismiss a suggestion
  fastify.put("/api/trading/suggestions/:id/dismiss", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await tradingService.dismissSuggestion(id, request.user.id);
      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ error: "Error", message: error.message });
    }
  });

  // POST /api/trading/suggestions/save - Save suggestion from n8n workflow
  fastify.post("/api/trading/suggestions/save", async (request, reply) => {
    const body = request.body as {
      profileId: string;
      assetId: string;
      reason: string;
      confidence: string;
      expectedProfit?: number;
      riskLevel?: string;
      timeframe?: string;
      criteria?: any;
    };

    if (!body.profileId || !body.assetId || !body.reason || !body.confidence) {
      return reply.status(400).send({ error: "Missing required fields" });
    }

    // Verify profile belongs to user
    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { id: body.profileId },
    });

    if (!profile || profile.userId !== request.user.id) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    // Check if suggestion already exists
    const existing = await fastify.prisma.tradingSuggestion.findFirst({
      where: {
        profileId: body.profileId,
        assetId: body.assetId,
        status: "pending",
      },
    });

    if (existing) {
      return reply.status(200).send({ message: "Suggestion already exists", id: existing.id });
    }

    // Create suggestion
    const suggestion = await fastify.prisma.tradingSuggestion.create({
      data: {
        profileId: body.profileId,
        assetId: body.assetId,
        reason: body.reason,
        confidence: body.confidence,
        expectedProfit: body.expectedProfit,
        riskLevel: body.riskLevel,
        timeframe: body.timeframe,
        criteria: body.criteria || {},
        status: "pending",
      },
    });

    return reply.status(201).send(suggestion);
  });

  // ==================== N8N WEBHOOK ====================

  // POST /api/trading/webhook/signals - Receive signals from n8n
  fastify.post("/api/trading/webhook/signals", async (request, reply) => {
    const body = request.body as any;

    // Validate basic structure
    if (!body.userId || !body.assetId || !body.action) {
      return reply.status(400).send({ error: "Invalid payload" });
    }

    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: body.userId },
    });

    if (!profile) {
      return reply.status(404).send({ error: "Profile not found" });
    }

    // Find or create trading asset
    let tradingAsset = await fastify.prisma.tradingAsset.findUnique({
      where: {
        profileId_assetId: {
          profileId: profile.id,
          assetId: body.assetId,
        },
      },
      include: { asset: true },
    });

    if (!tradingAsset) {
      tradingAsset = await tradingService.addAssetToTrading(profile.id, body.assetId);
    }

    const assetSymbol = tradingAsset.asset?.symbol || body.symbol || "Asset";

    // For SELL signals on bought assets, validate target/stop loss reached
    if (body.action === "SELL" && tradingAsset.status === "bought") {
      const currentPrice = tradingAsset.asset?.currentPrice || 0;

      // Use native currency for accurate P/L calculation (avoids exchange rate fluctuation)
      const entryPriceNative = tradingAsset.entryPriceNative;
      const entryPriceEur = tradingAsset.entryPrice || 0;

      let profitPct = 0;
      if (entryPriceNative && entryPriceNative > 0 && currentPrice > 0) {
        // Calculate using native currency (USD) - most accurate
        profitPct = ((currentPrice - entryPriceNative) / entryPriceNative) * 100;
        fastify.log.info(`P/L calc for ${assetSymbol}: (${currentPrice} - ${entryPriceNative}) / ${entryPriceNative} = ${profitPct.toFixed(2)}%`);
      } else if (entryPriceEur > 0) {
        // Fallback to EUR calculation
        const marketData = new MarketDataService(fastify);
        const currency = tradingAsset.asset?.currency || "USD";
        const eurRate = currency === "EUR" ? 1 : await marketData.getToEurRate(currency);
        const currentPriceEur = currentPrice * eurRate;
        profitPct = ((currentPriceEur - entryPriceEur) / entryPriceEur) * 100;
        fastify.log.info(`P/L calc (EUR fallback) for ${assetSymbol}: (${currentPriceEur} - ${entryPriceEur}) / ${entryPriceEur} = ${profitPct.toFixed(2)}%`);
      }

      const targetPct = profile.targetProfitPct || 10;
      const stopLossPct = profile.maxLossPct || 10;

      // Reject SELL signal if not at target or stop loss
      if (profitPct < targetPct && profitPct > -stopLossPct) {
        fastify.log.info(`Rejecting SELL signal for ${assetSymbol}: P/L ${profitPct.toFixed(2)}% not at target (${targetPct}%) or stop loss (-${stopLossPct}%)`);
        return reply.status(200).send({
          success: false,
          reason: "SELL signal rejected: target/stop loss not reached",
          profitPct: profitPct.toFixed(2),
          targetPct,
          stopLossPct
        });
      }
    }

    // Create signal
    const signal = await fastify.prisma.tradingSignal.create({
      data: {
        tradingAssetId: tradingAsset.id,
        action: body.action,
        confidence: body.confidence || "medium",
        reason: body.reason || "AI analysis",
        priceAtSignal: body.price || 0,
        criteria: body.criteria || {},
      },
    });

    // Send notification with asset symbol
    const notificationService = new (await import("./notifications")).NotificationService(fastify);

    // In-app notification
    await notificationService.notify(
      body.userId,
      ["in_app"],
      body.reason || `${body.action} signal for ${assetSymbol}`,
      {
        title: `📈 ${body.action} Signal - ${assetSymbol}`,
        type: "trading",
        data: {
          signalId: signal.id,
          tradingAssetId: tradingAsset.id,
          action: body.action,
          symbol: assetSymbol,
        },
      }
    );

    // Telegram notification
    await notificationService.notify(
      body.userId,
      ["telegram"],
      `📈 *${body.action} Signal - ${assetSymbol}*\n\n${body.reason || `${body.action} signal for ${assetSymbol}`}`,
      {
        title: `📈 ${body.action} Signal - ${assetSymbol}`,
        type: "trading",
      }
    );

    return reply.status(201).send({ success: true, signalId: signal.id });
  });
}
