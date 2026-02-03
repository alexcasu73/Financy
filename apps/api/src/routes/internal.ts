import { FastifyInstance } from "fastify";
import { TradingService } from "../services/trading";
import { NotificationService } from "../services/notifications";
import { AIAnalysisService, UserPreferences } from "../services/ai-analysis";
import { NewsService } from "../services/news";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "financy-internal-key";

export async function internalRoutes(fastify: FastifyInstance) {
  const tradingService = new TradingService(fastify);
  const aiService = new AIAnalysisService(fastify);
  const newsService = new NewsService(fastify);

  // Middleware to check internal API key
  const checkInternalKey = async (request: any, reply: any) => {
    const apiKey = request.headers["x-internal-key"] || request.headers["x-api-key"];
    if (apiKey !== INTERNAL_API_KEY) {
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid internal API key" });
    }
  };

  // ==================== AI ANALYSIS ENDPOINT FOR N8N ====================

  // POST /api/internal/analysis/generate - Generate AI analysis (called by n8n)
  fastify.post("/api/internal/analysis/generate", {
    onRequest: checkInternalKey,
  }, async (request, reply) => {
    const body = request.body as {
      type: string;
      userId: string;
      assetId?: string;
      preferences?: UserPreferences;
    };

    const { type, userId, assetId, preferences } = body;

    const userPreferences: UserPreferences = preferences || {
      riskTolerance: "moderate",
      timeHorizon: "medium",
      goals: "growth",
      preferredSectors: [],
      baseCurrency: "EUR",
    };

    fastify.log.info(`Generating ${type} analysis for user ${userId}`);

    try {
      // Portfolio Digest
      if (type === "portfolio_digest") {
        const portfolios = await fastify.prisma.portfolio.findMany({
          where: { userId },
          include: {
            holdings: {
              include: { asset: true },
            },
          },
        });

        const allHoldings = portfolios.flatMap((p) => p.holdings);
        if (allHoldings.length === 0) {
          return reply.status(400).send({
            error: "No Holdings",
            message: "Nessun asset nel portfolio",
          });
        }

        const totalValue = allHoldings.reduce(
          (sum, h) => sum + h.quantity * (h.asset.currentPrice || 0),
          0
        );

        const holdings = allHoldings.map((h) => {
          const currentPrice = h.asset.currentPrice || 0;
          const totalHoldingValue = h.quantity * currentPrice;
          const costBasis = h.quantity * h.avgBuyPrice;
          const profitLoss = totalHoldingValue - costBasis;
          const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

          return {
            symbol: h.asset.symbol,
            name: h.asset.name,
            type: h.asset.type,
            quantity: h.quantity,
            avgPrice: h.avgBuyPrice,
            currentPrice,
            changePercent: h.asset.changePercent || 0,
            totalValue: totalHoldingValue,
            profitLoss,
            profitLossPercent,
            weight: totalValue > 0 ? (totalHoldingValue / totalValue) * 100 : 0,
          };
        });

        // Fetch available assets for suggestions
        const ownedAssetIds = allHoldings.map((h) => h.assetId);
        const availableAssets = await fastify.prisma.asset.findMany({
          where: { id: { notIn: ownedAssetIds } },
          take: 30,
          orderBy: { marketCap: "desc" },
        });

        const availableAssetsData = availableAssets.map((a) => ({
          symbol: a.symbol,
          name: a.name,
          price: a.currentPrice || 0,
          changePercent: a.changePercent || 0,
          sector: a.sector || undefined,
          type: a.type || undefined,
        }));

        // Fetch news
        const newsItems = await fastify.prisma.newsItem.findMany({
          orderBy: { publishedAt: "desc" },
          take: 10,
        });

        const news = newsItems.map((n) => ({
          title: n.title,
          summary: n.summary,
          publishedAt: n.publishedAt.toISOString(),
          sentiment: n.sentiment || undefined,
        }));

        const result = await aiService.generatePortfolioDigest(
          holdings,
          news,
          userPreferences,
          availableAssetsData
        );

        const { recommendations, ...analysisData } = result;

        const analysis = await fastify.prisma.analysis.create({
          data: {
            type,
            ...analysisData,
            assets: allHoldings.map((h) => h.assetId),
            metadata: {
              preferences: userPreferences,
              recommendations,
              portfolioValue: totalValue,
              holdingsCount: allHoldings.length,
              generatedBy: "n8n",
            },
          },
        });

        return { success: true, analysis: { ...analysis, recommendations } };
      }

      // Market Overview
      if (type === "market_overview") {
        const assets = await fastify.prisma.asset.findMany({
          take: 40,
          orderBy: { marketCap: "desc" },
        });

        const assetsData = assets.map((a) => ({
          symbol: a.symbol,
          name: a.name,
          price: a.currentPrice || 0,
          changePercent: a.changePercent || 0,
          sector: a.sector || undefined,
          type: a.type || undefined,
        }));

        const newsItems = await fastify.prisma.newsItem.findMany({
          orderBy: { publishedAt: "desc" },
          take: 15,
        });

        const news = newsItems.map((n) => ({
          title: n.title,
          summary: n.summary,
          publishedAt: n.publishedAt.toISOString(),
          sentiment: n.sentiment || undefined,
        }));

        const result = await aiService.generateMarketOverview(
          assetsData,
          news,
          userPreferences
        );

        const { recommendations, ...analysisData } = result;

        const analysis = await fastify.prisma.analysis.create({
          data: {
            type,
            ...analysisData,
            assets: assets.map((a) => a.id),
            metadata: {
              preferences: userPreferences,
              recommendations,
              assetsCount: assets.length,
              generatedBy: "n8n",
            },
          },
        });

        return { success: true, analysis: { ...analysis, recommendations } };
      }

      // Asset Deep Dive
      if (type === "asset_deep_dive") {
        if (!assetId) {
          return reply.status(400).send({
            error: "Missing Asset",
            message: "assetId is required for asset_deep_dive",
          });
        }

        const asset = await fastify.prisma.asset.findUnique({
          where: { id: assetId },
        });

        if (!asset) {
          return reply.status(404).send({ error: "Asset not found" });
        }

        const signals = await fastify.prisma.technicalSignal.findMany({
          where: { assetId: asset.id },
          orderBy: { calculatedAt: "desc" },
          take: 10,
        });

        const newsItems = await fastify.prisma.newsItem.findMany({
          where: { relatedAssets: { some: { assetId: asset.id } } },
          orderBy: { publishedAt: "desc" },
          take: 10,
        });

        let news = newsItems.map((n) => ({
          title: n.title,
          summary: n.summary,
          publishedAt: n.publishedAt.toISOString(),
          sentiment: n.sentiment || undefined,
          symbol: asset.symbol,
        }));

        if (news.length === 0) {
          const externalNews = await newsService.getAssetNews(asset.symbol);
          news = externalNews.map((n) => ({
            title: n.title,
            summary: n.summary,
            publishedAt: n.publishedAt,
            symbol: asset.symbol,
          }));
        }

        const assetData = {
          symbol: asset.symbol,
          name: asset.name,
          price: asset.currentPrice || 0,
          changePercent: asset.changePercent || 0,
          sector: asset.sector || undefined,
        };

        const technicalSignals = signals.map((s) => ({
          indicator: s.indicator,
          signal: s.signal,
          value: s.value,
        }));

        const result = await aiService.generateAssetDeepDive(
          assetData,
          technicalSignals,
          news,
          userPreferences
        );

        const { recommendations, ...analysisData } = result;

        const analysis = await fastify.prisma.analysis.create({
          data: {
            type,
            ...analysisData,
            assets: [asset.id],
            metadata: {
              preferences: userPreferences,
              recommendations,
              assetSymbol: asset.symbol,
              signalsCount: signals.length,
              generatedBy: "n8n",
            },
          },
        });

        return { success: true, analysis: { ...analysis, recommendations } };
      }

      return reply.status(400).send({
        error: "Invalid type",
        message: "Tipo di analisi non supportato",
      });
    } catch (error: any) {
      fastify.log.error(error, "AI analysis generation failed");

      // Check for specific error types
      let userMessage = error.message || "Errore nella generazione dell'analisi";

      if (error.message?.includes("usage limits")) {
        userMessage = "⚠️ Limite API raggiunto. Il servizio AI ha esaurito il credito disponibile. Riprova tra qualche ora o contatta il supporto per aumentare il limite.";
      } else if (error.message?.includes("Failed to parse")) {
        userMessage = "Errore nel processamento della risposta AI. Riprova tra qualche minuto.";
      } else if (error.message?.includes("API key")) {
        userMessage = "Errore di configurazione API. Contatta l'amministratore.";
      }

      return reply.status(500).send({
        error: "Generation failed",
        message: userMessage,
      });
    }
  });

  // ==================== ALERT SUGGESTIONS ENDPOINT FOR N8N ====================

  // POST /api/internal/alert-suggestions/generate - Generate AI alert suggestions
  fastify.post("/api/internal/alert-suggestions/generate", {
    onRequest: checkInternalKey,
  }, async (request, reply) => {
    try {
      // Get default settings
      const settings = await fastify.prisma.userSettings.findFirst();
      const threshold = settings?.alertSuggestionThreshold || 3;

      // Fetch assets with significant price movements
      const assets = await fastify.prisma.asset.findMany({
        take: 100,
        orderBy: { marketCap: "desc" },
      });

      const interestingAssets = assets.filter(
        (a) => Math.abs(a.changePercent || 0) > threshold
      );

      if (interestingAssets.length === 0) {
        return {
          success: true,
          created: 0,
          message: `Nessun asset con variazione > ${threshold}%`,
        };
      }

      // Build prompt for AI
      const assetData = interestingAssets.map((a) => ({
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        type: a.type,
        currentPrice: a.currentPrice,
        changePercent: a.changePercent,
      }));

      const prompt = `Sei un consulente finanziario. Analizza questi asset con movimenti significativi e suggerisci alert utili.

Asset data:
${JSON.stringify(assetData, null, 2)}

Per ogni asset dove vedi una buona opportunità per un alert, restituisci un oggetto JSON. Considera:
- Asset con grandi movimenti di prezzo potrebbero invertire (suggerisci price_above/price_below)
- Asset con alta volatilità possono beneficiare di alert percent_change

Restituisci SOLO un array JSON valido (niente markdown) con oggetti contenenti:
- assetId (string): l'id dell'asset
- symbol (string): simbolo ticker
- name (string): nome asset
- type (string): uno tra price_above, price_below, percent_change, volume_spike
- threshold (number): soglia prezzo o percentuale
- reason (string): spiegazione in ITALIANO di 1-2 frasi
- confidence (string): high, medium, o low

Restituisci tra 0 e 5 suggerimenti. Se non ci sono buoni suggerimenti, restituisci [].`;

      // Call AI service
      const aiResponse = await aiService.callAI(prompt);

      // Parse suggestions from AI response
      let suggestions: any[] = [];
      try {
        const cleaned = aiResponse
          .replace(/```json?\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        suggestions = JSON.parse(cleaned);
      } catch {
        const match = aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          suggestions = JSON.parse(match[0]);
        }
      }

      if (!Array.isArray(suggestions)) {
        suggestions = [];
      }

      // Validate suggestions
      const validTypes = ["price_above", "price_below", "percent_change", "volume_spike"];
      const validConfidence = ["high", "medium", "low"];
      const assetById = new Map(assets.map((a) => [a.id, a]));

      const validSuggestions = suggestions
        .filter(
          (s: any) =>
            s.assetId &&
            s.symbol &&
            s.type &&
            s.threshold != null &&
            s.reason &&
            validTypes.includes(s.type) &&
            validConfidence.includes(s.confidence || "medium") &&
            assetById.has(s.assetId)
        )
        .map((s: any) => ({
          assetId: s.assetId,
          symbol: s.symbol,
          name: assetById.get(s.assetId)?.name || s.name,
          type: s.type,
          threshold: Number(s.threshold),
          reason: s.reason,
          confidence: s.confidence || "medium",
        }));

      // Save suggestions to database
      let created = 0;
      for (const suggestion of validSuggestions) {
        // Check if similar suggestion exists
        const existing = await fastify.prisma.alertSuggestion.findFirst({
          where: {
            assetId: suggestion.assetId,
            type: suggestion.type,
            dismissed: false,
          },
        });

        if (!existing) {
          await fastify.prisma.alertSuggestion.create({
            data: {
              assetId: suggestion.assetId,
              symbol: suggestion.symbol,
              name: suggestion.name,
              type: suggestion.type,
              threshold: suggestion.threshold,
              reason: suggestion.reason,
              confidence: suggestion.confidence,
              dismissed: false,
            },
          });
          created++;
        }
      }

      return {
        success: true,
        created,
        total: validSuggestions.length,
        message: `Generati ${created} nuovi suggerimenti alert`,
      };
    } catch (error: any) {
      fastify.log.error(error, "Alert suggestions generation failed");
      return reply.status(500).send({
        error: "Generation failed",
        message: error.message || "Errore nella generazione dei suggerimenti",
      });
    }
  });

  // ==================== INTERNAL ANALYSIS ROUTES FOR N8N ====================

  // GET /api/internal/portfolio/:userId - Fetch user's portfolio with holdings
  fastify.get("/api/internal/portfolio/:userId", {
    onRequest: checkInternalKey,
  }, async (request) => {
    const { userId } = request.params as { userId: string };

    const portfolios = await fastify.prisma.portfolio.findMany({
      where: { userId },
      include: {
        holdings: {
          include: { asset: true },
        },
      },
    });

    const allHoldings = portfolios.flatMap((p) => p.holdings);

    return {
      holdings: allHoldings.map((h) => ({
        symbol: h.asset.symbol,
        name: h.asset.name,
        quantity: h.quantity,
        avgBuyPrice: h.avgBuyPrice,
        currentPrice: h.asset.currentPrice,
        changePercent: h.asset.changePercent,
        sector: h.asset.sector,
      })),
    };
  });

  // GET /api/internal/asset/:assetId - Fetch single asset with signals
  fastify.get("/api/internal/asset/:assetId", {
    onRequest: checkInternalKey,
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };

    const asset = await fastify.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return reply.status(404).send({ error: "Asset not found" });
    }

    const signals = await fastify.prisma.technicalSignal.findMany({
      where: { assetId },
      orderBy: { calculatedAt: "desc" },
      take: 10,
    });

    return {
      ...asset,
      signals: signals.map((s) => ({
        indicator: s.indicator,
        signal: s.signal,
        value: s.value,
      })),
    };
  });

  // GET /api/internal/market-overview - Fetch market overview data
  fastify.get("/api/internal/market-overview", {
    onRequest: checkInternalKey,
  }, async () => {
    const assets = await fastify.prisma.asset.findMany({
      take: 50,
      orderBy: { marketCap: "desc" },
    });

    return {
      assets: assets.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        currentPrice: a.currentPrice,
        changePercent: a.changePercent,
        sector: a.sector,
        type: a.type,
      })),
    };
  });

  // ==================== INTERNAL TRADING ROUTES FOR N8N ====================

  // GET /api/internal/trading/profile/:userId
  fastify.get("/api/internal/trading/profile/:userId", {
    onRequest: checkInternalKey,
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    fastify.log.info(`Fetching trading profile for userId: ${userId}`);

    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId },
    });

    fastify.log.info(`Profile found: ${profile ? 'yes' : 'no'}, id: ${profile?.id}`);

    // Return empty object if no profile (n8n handles this better than null)
    if (!profile) {
      return { found: false };
    }

    return { ...profile, found: true };
  });

  // GET /api/internal/trading/assets/:userId
  fastify.get("/api/internal/trading/assets/:userId", {
    onRequest: checkInternalKey,
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId },
    });

    if (!profile) return [];

    const tradingAssets = await fastify.prisma.tradingAsset.findMany({
      where: { profileId: profile.id },
      include: { asset: true },
    });

    return tradingAssets.map((ta) => ({
      ...ta,
      symbol: ta.asset.symbol,
      name: ta.asset.name,
      currentPrice: ta.asset.currentPrice,
    }));
  });

  // POST /api/internal/trading/suggestions/save
  fastify.post("/api/internal/trading/suggestions/save", {
    onRequest: checkInternalKey,
  }, async (request, reply) => {
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

  // POST /api/internal/trading/suggestions/notify/:userId - Send notification for new suggestions
  fastify.post("/api/internal/trading/suggestions/notify/:userId", {
    onRequest: checkInternalKey,
    schema: {
      body: {
        type: "object",
        additionalProperties: true,
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      // Get user's trading profile
      const profile = await fastify.prisma.tradingProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: "Profile not found" });
      }

      // Get recent suggestions (created in last 30 seconds)
      const recentSuggestions = await fastify.prisma.tradingSuggestion.findMany({
        where: {
          profileId: profile.id,
          status: "pending",
          createdAt: { gte: new Date(Date.now() - 30 * 1000) },
        },
        include: {
          asset: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      if (recentSuggestions.length === 0) {
        return reply.send({ success: true, message: "No new suggestions to notify" });
      }

      // Build Telegram message
      const confidenceEmoji = (conf: string) => conf === "high" ? "⭐⭐⭐" : conf === "medium" ? "⭐⭐" : "⭐";
      const riskEmoji = (risk: string) => risk === "high" ? "🔴" : risk === "medium" ? "🟡" : "🟢";

      let telegramMessage = `📊 *Nuovi Suggerimenti Trading*\n\nTrovati ${recentSuggestions.length} asset idonei al tuo profilo:\n`;

      for (let i = 0; i < Math.min(recentSuggestions.length, 5); i++) {
        const suggestion = recentSuggestions[i];
        const asset = suggestion.asset;

        telegramMessage += `\n*${i + 1}. ${asset.symbol}* - ${asset.name}\n`;
        telegramMessage += `💰 ${confidenceEmoji(suggestion.confidence)} Fiducia ${suggestion.confidence === "high" ? "Alta" : suggestion.confidence === "medium" ? "Media" : "Bassa"}\n`;
        if (suggestion.riskLevel) {
          telegramMessage += `${riskEmoji(suggestion.riskLevel)} Rischio ${suggestion.riskLevel === "high" ? "Alto" : suggestion.riskLevel === "medium" ? "Medio" : "Basso"}\n`;
        }
        telegramMessage += `📈 €${asset.currentPrice?.toFixed(2) || "N/A"} (${asset.changePercent ? (asset.changePercent >= 0 ? "+" : "") + asset.changePercent.toFixed(2) + "%" : "N/A"})\n`;
        telegramMessage += `💡 ${suggestion.reason}\n`;
      }

      if (recentSuggestions.length > 5) {
        telegramMessage += `\n... e altri ${recentSuggestions.length - 5} suggerimenti`;
      }

      telegramMessage += `\n🎯 Vai su *Trading > Suggerimenti* per vederli tutti!`;

      // Build in-app message
      const topAssets = recentSuggestions.slice(0, 3).map((s) => s.asset.symbol).join(", ");
      const inAppMessage = `Trovati ${recentSuggestions.length} nuovi asset idonei al tuo profilo${recentSuggestions.length <= 3 ? ": " + topAssets : " tra cui: " + topAssets}. Vai alla sezione Trading > Suggerimenti per vederli tutti.`;

      // Send notifications
      const notificationService = new NotificationService(fastify);

      // In-app notification
      await notificationService.notify(
        userId,
        ["in_app"],
        inAppMessage,
        {
          title: "Nuovi Suggerimenti Trading",
          type: "trading_suggestion",
          data: {
            count: recentSuggestions.length,
            symbols: recentSuggestions.slice(0, 5).map((s) => s.asset.symbol),
          },
        }
      );

      // Telegram notification
      await notificationService.notify(
        userId,
        ["telegram"],
        telegramMessage,
        {
          title: "Nuovi Suggerimenti Trading",
          type: "trading_suggestion",
        }
      );

      fastify.log.info({ userId, count: recentSuggestions.length }, "Trading suggestions notification sent");

      return reply.send({
        success: true,
        count: recentSuggestions.length,
        message: `Notification sent for ${recentSuggestions.length} suggestions`,
      });
    } catch (error: any) {
      fastify.log.error(error, "Failed to send suggestions notification");
      return reply.status(500).send({
        error: "Notification failed",
        message: error.message,
      });
    }
  });

  // POST /api/internal/trading/suggestions/generate/:userId - DEPRECATED: Now handled entirely in n8n
  // Kept for backward compatibility or manual testing
  fastify.post("/api/internal/trading/suggestions/generate/:userId", {
    onRequest: checkInternalKey,
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const count = await tradingService.generateSuggestions(userId);
    return { success: true, count, message: `Generated ${count} suggestions (legacy backend mode)` };
  });

  // POST /api/internal/trading/signals - Receive signals from n8n
  fastify.post("/api/internal/trading/signals", {
    onRequest: checkInternalKey,
  }, async (request, reply) => {
    const body = request.body as {
      userId: string;
      assetId: string;
      action: string;
      reason?: string;
      confidence?: string;
      price?: number;
      criteria?: any;
    };

    fastify.log.info(`🔵 Received signal request:`, {
      userId: body.userId,
      assetId: body.assetId,
      action: body.action,
      confidence: body.confidence,
      price: body.price,
    });

    if (!body.userId || !body.assetId || !body.action) {
      fastify.log.error('❌ Invalid payload - missing required fields');
      return reply.status(400).send({ error: "Invalid payload", message: "userId, assetId and action are required" });
    }

    const profile = await fastify.prisma.tradingProfile.findUnique({
      where: { userId: body.userId },
    });

    if (!profile) {
      return reply.status(404).send({ error: "Profile not found" });
    }

    // Find trading asset
    let tradingAsset = await fastify.prisma.tradingAsset.findUnique({
      where: {
        profileId_assetId: {
          profileId: profile.id,
          assetId: body.assetId,
        },
      },
    });

    if (!tradingAsset) {
      // Create trading asset if not exists
      tradingAsset = await tradingService.addAssetToTrading(profile.id, body.assetId);
    }

    // Get asset details for notification
    const asset = await fastify.prisma.asset.findUnique({
      where: { id: body.assetId },
    });

    if (!asset) {
      return reply.status(404).send({ error: "Asset not found" });
    }

    // Convert price to EUR if needed
    const marketData = new (await import("../services/market-data")).MarketDataService(fastify);
    const currency = asset.currency || "USD";
    const eurRate = currency === "EUR" ? 1 : await marketData.getToEurRate(currency);
    const priceEur = body.price ? body.price * eurRate : 0;

    // PROTECTION: Block SELL signals for recently bought assets (< 1 hour)
    if (body.action === "SELL" && tradingAsset.status === "bought" && tradingAsset.entryDate) {
      const hoursSinceBuy = (Date.now() - new Date(tradingAsset.entryDate).getTime()) / (1000 * 60 * 60);
      if (hoursSinceBuy < 1) {
        fastify.log.warn(`⚠️ Blocked SELL signal for ${asset.symbol} - bought only ${hoursSinceBuy.toFixed(1)}h ago`);
        return reply.status(400).send({
          error: "Too soon to sell",
          message: `Asset was bought ${hoursSinceBuy.toFixed(1)}h ago. Wait at least 1 hour before selling.`
        });
      }
    }

    // FIX: Recalculate profit for SELL signals to correct n8n's wrong calculation
    let correctedReason = body.reason || "AI analysis";
    if (body.action === "SELL" && tradingAsset.status === "bought") {
      const nativePrice = body.price || asset.currentPrice || 0;
      const nativeEntryPrice = tradingAsset.entryPriceNative || tradingAsset.entryPrice;
      if (nativeEntryPrice && nativePrice) {
        const actualProfit = ((nativePrice - nativeEntryPrice) / nativeEntryPrice * 100).toFixed(2);
        // Replace any wrong profit percentage in the reason with the correct one
        correctedReason = correctedReason.replace(/\+?\-?\d+\.?\d*%/g, `${Number(actualProfit) >= 0 ? '+' : ''}${actualProfit}%`);
        fastify.log.info(`✅ Corrected profit in reason: ${actualProfit}%`);
      }
    }

    // Create signal
    const signal = await fastify.prisma.tradingSignal.create({
      data: {
        tradingAssetId: tradingAsset.id,
        action: body.action,
        confidence: body.confidence || "medium",
        reason: correctedReason,
        priceAtSignal: priceEur,
        criteria: body.criteria || {},
      },
    });

    fastify.log.info(`✅ Signal created successfully:`, {
      signalId: signal.id,
      assetSymbol: asset.symbol,
      action: body.action,
      tradingAssetId: tradingAsset.id,
      userId: body.userId,
    });

    // Send notification only for BUY and SELL (not HOLD to avoid spam)
    if (body.action !== "HOLD") {
      const notificationService = new NotificationService(fastify);
      const actionLabel = body.action === "BUY" ? "COMPRA" : "VENDI";

      // Calculate P/L if bought (using native currency to avoid FX fluctuation)
      const nativePrice = body.price || asset.currentPrice || 0;
      const nativeEntryPrice = tradingAsset.entryPriceNative || tradingAsset.entryPrice;
      const profitPct = tradingAsset.status === "bought" && nativeEntryPrice && nativePrice
        ? ((nativePrice - nativeEntryPrice) / nativeEntryPrice * 100).toFixed(2)
        : null;

      const priceInfo = priceEur ? `\n💰 Prezzo: €${priceEur.toFixed(2)}` : '';
      const plInfo = profitPct ? `\n📊 P/L: ${Number(profitPct) >= 0 ? '+' : ''}${profitPct}%` : '';

      // Add thresholds info (target and stop loss in EUR)
      const targetInfo = tradingAsset.targetPrice ? `\n🎯 Target: €${tradingAsset.targetPrice.toFixed(2)}` : '';
      const stopLossInfo = tradingAsset.stopLossPrice ? `\n🛑 Stop Loss: €${tradingAsset.stopLossPrice.toFixed(2)}` : '';

      // In-app notification
      await notificationService.notify(
        body.userId,
        ["in_app"],
        correctedReason,
        {
          title: `${actionLabel} ${asset.symbol}`,
          type: "trading",
          data: {
            signalId: signal.id,
            tradingAssetId: tradingAsset.id,
            action: body.action,
            symbol: asset.symbol,
          },
        }
      );

      // Telegram notification with full details
      await notificationService.notify(
        body.userId,
        ["telegram"],
        `📈 *${actionLabel} - ${asset.symbol}*\n${asset.name}${priceInfo}${plInfo}${targetInfo}${stopLossInfo}\n\n${correctedReason}`,
        {
        title: `${actionLabel} ${asset.symbol}`,
        type: "trading",
      }
    );
    }

    fastify.log.info(`Signal created: ${signal.id} for asset ${body.assetId}, action: ${body.action}`);
    return reply.status(201).send({ success: true, signalId: signal.id });
  });

  // POST /api/internal/trading/analyze/:userId - Analyze trading assets via AI
  fastify.post("/api/internal/trading/analyze/:userId", {
    onRequest: checkInternalKey,
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      // Get user's trading profile
      const profile = await fastify.prisma.tradingProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({
          error: "No profile",
          message: "Profilo trading non trovato",
        });
      }

      // Get trading assets
      const tradingAssets = await fastify.prisma.tradingAsset.findMany({
        where: {
          profileId: profile.id,
          status: { in: ["watching", "bought"] },
        },
        include: { asset: true },
      });

      if (tradingAssets.length === 0) {
        return reply.send({
          success: true,
          signalsGenerated: 0,
          message: "Nessun asset da analizzare",
        });
      }

      // Analyze each asset and collect suggestions
      let signalsGenerated = 0;
      const suggestions: any[] = [];

      for (const tradingAsset of tradingAssets) {
        try {
          // Get the analysis result before creating the signal
          const analysis = await tradingService.analyzeAssetWithResult(tradingAsset.id);

          if (analysis) {
            // Add to suggestions list (include all: BUY, SELL, HOLD)
            suggestions.push({
              symbol: tradingAsset.asset.symbol,
              name: tradingAsset.asset.name,
              action: analysis.action,
              confidence: analysis.confidence,
              reason: analysis.reason || "Nessuna condizione particolare rilevata",
              currentPrice: tradingAsset.asset.currentPrice,
              status: tradingAsset.status,
              assetId: tradingAsset.assetId,
            });

            // Only count as signal generated if BUY or SELL
            if (analysis.action !== "HOLD") {
              signalsGenerated++;
            }
          }
        } catch (error: any) {
          fastify.log.error(error, `Failed to analyze asset ${tradingAsset.id}`);
          // Add error suggestion
          suggestions.push({
            symbol: tradingAsset.asset.symbol,
            name: tradingAsset.asset.name,
            action: "HOLD",
            confidence: "low",
            reason: "Errore nell'analisi",
            currentPrice: tradingAsset.asset.currentPrice,
            status: tradingAsset.status,
            assetId: tradingAsset.assetId,
          });
        }
      }

      return reply.send({
        success: true,
        signalsGenerated,
        assetsAnalyzed: tradingAssets.length,
        suggestions,
        message: `Analisi completata: ${signalsGenerated} segnali generati su ${tradingAssets.length} asset`,
      });
    } catch (error: any) {
      fastify.log.error(error, "Trading analysis failed");

      let userMessage = error.message || "Errore nell'analisi trading";
      if (error.message?.includes("usage limits")) {
        userMessage = "⚠️ Limite API raggiunto. Riprova più tardi.";
      }

      return reply.status(500).send({
        error: "Analysis failed",
        message: userMessage,
      });
    }
  });
}
