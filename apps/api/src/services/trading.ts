import { FastifyInstance } from "fastify";
import { NotificationService } from "./notifications";
import { MarketDataService } from "./market-data";

interface TradingCriteria {
  rsi?: number;
  macd?: string;
  macdHistogram?: number;
  priceVsMA20?: string;
  priceVsMA50?: string;
  volumeRatio?: number;
  sentiment?: number;
  targetReached?: boolean;
  stopLossReached?: boolean;
}

export class TradingService {
  private notificationService: NotificationService;

  constructor(private fastify: FastifyInstance) {
    this.notificationService = new NotificationService(fastify);
  }

  /**
   * Analyze a trading asset and generate signals
   */
  async analyzeAsset(tradingAssetId: string): Promise<void> {
    const tradingAsset = await this.fastify.prisma.tradingAsset.findUnique({
      where: { id: tradingAssetId },
      include: {
        asset: {
          include: {
            technicalSignals: {
              orderBy: { calculatedAt: "desc" },
              take: 10,
            },
          },
        },
        profile: true,
      },
    });

    if (!tradingAsset) return;

    const { asset, profile } = tradingAsset;
    const currentPrice = asset.currentPrice;
    if (!currentPrice) return;

    // Convert price to EUR for notifications
    const marketData = new MarketDataService(this.fastify);
    const currency = asset.currency || "USD";
    const eurRate = currency === "EUR" ? 1 : await marketData.getToEurRate(currency);
    const currentPriceEur = currentPrice * eurRate;

    // Gather criteria
    const criteria = await this.gatherCriteria(tradingAsset, currentPrice);

    // Determine action based on status and criteria
    const { action, confidence, reason } = this.determineAction(
      tradingAsset,
      criteria,
      profile.targetProfitPct,
      profile.maxLossPct
    );

    // Check if there's a recent similar signal (within 4 hours)
    const recentSignal = await this.fastify.prisma.tradingSignal.findFirst({
      where: {
        tradingAssetId,
        action,
        createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      },
    });

    if (recentSignal) return; // Don't duplicate signals

    // Create signal (including HOLD now)
    const signal = await this.fastify.prisma.tradingSignal.create({
      data: {
        tradingAssetId,
        action,
        confidence,
        reason: reason || "Nessuna condizione particolare rilevata",
        priceAtSignal: currentPrice,
        criteria: criteria as any,
      },
    });

    // Send notification only for BUY and SELL (not HOLD to avoid spam)
    if (action !== "HOLD") {
      const actionLabel = action === "BUY" ? "COMPRA" : "VENDI";

      // In-app notification (clean format)
      await this.notificationService.notify(
        profile.userId,
        ["in_app"],
        reason,
        {
          title: `${actionLabel} ${asset.symbol}`,
          type: "trading",
          data: {
            signalId: signal.id,
            tradingAssetId,
            assetId: asset.id,
            symbol: asset.symbol,
            action,
            confidence,
            currentPrice,
          },
        }
      );

      // Telegram notification (with emoji and details)
      // Calculate profit using NATIVE currency to avoid FX rate fluctuation errors
      const nativeCurrentPrice = asset.currentPrice || 0;
      const nativeEntryPrice = tradingAsset.entryPriceNative || tradingAsset.entryPrice;
      const profitPct = nativeEntryPrice && nativeCurrentPrice
        ? ((nativeCurrentPrice - nativeEntryPrice) / nativeEntryPrice * 100).toFixed(2)
        : null;

      const priceInfo = `\n💰 Prezzo: €${currentPriceEur.toFixed(2)}`;
      const plInfo = profitPct ? `\n📊 P/L: ${Number(profitPct) >= 0 ? '+' : ''}${profitPct}%` : '';
      const targetInfo = tradingAsset.targetPrice ? `\n🎯 Target: €${tradingAsset.targetPrice.toFixed(2)}` : '';
      const stopLossInfo = tradingAsset.stopLossPrice ? `\n🛑 Stop Loss: €${tradingAsset.stopLossPrice.toFixed(2)}` : '';

      await this.notificationService.notify(
        profile.userId,
        ["telegram"],
        `📈 *${actionLabel} - ${asset.symbol}*\n${asset.name}${priceInfo}${plInfo}${targetInfo}${stopLossInfo}\n\n${reason}`,
        {
          title: `${actionLabel} ${asset.symbol}`,
          type: "trading",
        }
      );

      // Update signal as notified
      await this.fastify.prisma.tradingSignal.update({
        where: { id: signal.id },
        data: { notified: true },
      });
    }

    this.fastify.log.info(`Trading signal: ${action} ${asset.symbol} (${confidence})`);
  }

  /**
   * Analyze a trading asset and return the result (with signal creation)
   */
  async analyzeAssetWithResult(
    tradingAssetId: string
  ): Promise<{ action: "BUY" | "SELL" | "HOLD"; confidence: string; reason: string } | null> {
    const tradingAsset = await this.fastify.prisma.tradingAsset.findUnique({
      where: { id: tradingAssetId },
      include: {
        asset: {
          include: {
            technicalSignals: {
              orderBy: { calculatedAt: "desc" },
              take: 10,
            },
          },
        },
        profile: true,
      },
    });

    if (!tradingAsset) return null;

    const { asset, profile } = tradingAsset;
    const currentPrice = asset.currentPrice;
    if (!currentPrice) return null;

    // Gather criteria
    const criteria = await this.gatherCriteria(tradingAsset, currentPrice);

    // Determine action based on status and criteria (deterministic rules)
    const { action, confidence, reason: ruleBasedReason } = this.determineAction(
      tradingAsset,
      criteria,
      profile.targetProfitPct,
      profile.maxLossPct
    );

    // Generate AI reason for ALL actions (BUY, SELL, HOLD)
    let reason = ruleBasedReason;
    try {
      const aiReason = await this.generateAIReason(
        action,
        tradingAsset,
        asset,
        criteria,
        profile
      );
      if (aiReason) {
        reason = aiReason;
      }
    } catch (error) {
      this.fastify.log.error(error, "Failed to generate AI reason, using rule-based reason");
      // Keep rule-based reason on error
      if (!reason) {
        reason = action === "HOLD" ? "Mantieni la posizione e monitora" : "Analisi in corso";
      }
    }

    // Check if there's a recent similar signal (within 4 hours)
    const recentSignal = await this.fastify.prisma.tradingSignal.findFirst({
      where: {
        tradingAssetId,
        action,
        createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      },
    });

    if (!recentSignal) {
      // Create signal (including HOLD now)
      const signal = await this.fastify.prisma.tradingSignal.create({
        data: {
          tradingAssetId,
          action,
          confidence,
          reason: reason || "Nessuna condizione particolare rilevata",
          priceAtSignal: currentPrice,
          criteria: criteria as any,
        },
      });

      // Send notification only for BUY and SELL (not HOLD to avoid spam)
      if (action !== "HOLD") {
        const actionLabel = action === "BUY" ? "COMPRA" : "VENDI";

        // In-app notification (clean format)
        await this.notificationService.notify(
          profile.userId,
          ["in_app"],
          reason,
          {
            title: `${actionLabel} ${asset.symbol}`,
            type: "trading",
            data: {
              signalId: signal.id,
              tradingAssetId,
              assetId: asset.id,
              symbol: asset.symbol,
              action,
              confidence,
              currentPrice,
            },
          }
        );

        // Telegram notification (with emoji)
        await this.notificationService.notify(
          profile.userId,
          ["telegram"],
          `📈 *${actionLabel} ${asset.symbol}*\n\n${reason}`,
          {
            title: `${actionLabel} ${asset.symbol}`,
            type: "trading",
          }
        );

        // Update signal as notified
        await this.fastify.prisma.tradingSignal.update({
          where: { id: signal.id },
          data: { notified: true },
        });
      }

      this.fastify.log.info(`Trading signal: ${action} ${asset.symbol} (${confidence})`);
    }

    // Return the analysis result (even if HOLD or duplicate)
    return { action, confidence, reason };
  }

  /**
   * Gather all criteria for analysis
   */
  private async gatherCriteria(
    tradingAsset: any,
    currentPrice: number
  ): Promise<TradingCriteria> {
    const { asset, entryPrice, targetPrice, stopLossPrice } = tradingAsset;
    const signals = asset.technicalSignals || [];

    const criteria: TradingCriteria = {};

    // Extract technical indicators
    for (const signal of signals) {
      if (signal.indicator === "RSI") {
        criteria.rsi = signal.value;
      } else if (signal.indicator === "MACD") {
        criteria.macd = signal.signal; // "bullish" or "bearish"
        criteria.macdHistogram = signal.value;
      } else if (signal.indicator === "MA20") {
        criteria.priceVsMA20 = currentPrice > signal.value ? "above" : "below";
      } else if (signal.indicator === "MA50") {
        criteria.priceVsMA50 = currentPrice > signal.value ? "above" : "below";
      }
    }

    // Volume analysis
    if (asset.volume) {
      // Assuming we have average volume stored or can calculate it
      // For now, use a simple ratio
      criteria.volumeRatio = 1.0; // Placeholder
    }

    // Check target/stop-loss if bought
    // NOTE: currentPrice is in native currency (USD, CHF, etc.)
    // targetPrice and stopLossPrice are in EUR
    // We need to convert for proper comparison
    if (tradingAsset.status === "bought" && entryPrice) {
      const marketData = new MarketDataService(this.fastify);
      const currency = asset.currency || "USD";
      const eurRate = currency === "EUR" ? 1 : await marketData.getToEurRate(currency);
      const currentPriceEur = currentPrice * eurRate;

      if (targetPrice && currentPriceEur >= targetPrice) {
        criteria.targetReached = true;
      }
      if (stopLossPrice && currentPriceEur <= stopLossPrice) {
        criteria.stopLossReached = true;
      }
    }

    // News sentiment - get recent news for this asset
    const recentNews = await this.fastify.prisma.newsAsset.findMany({
      where: { assetId: asset.id },
      include: { newsItem: true },
      take: 10,
      orderBy: { newsItem: { publishedAt: "desc" } },
    });

    if (recentNews.length > 0) {
      const sentimentScores = recentNews
        .map((na) => {
          const s = na.newsItem.sentiment;
          if (s === "positive") return 1;
          if (s === "negative") return -1;
          return 0;
        })
        .filter((s) => s !== 0);

      if (sentimentScores.length > 0) {
        criteria.sentiment =
          sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
      }
    }

    return criteria;
  }

  /**
   * Determine trading action based on criteria
   */
  private determineAction(
    tradingAsset: any,
    criteria: TradingCriteria,
    targetProfitPct: number,
    maxLossPct: number
  ): { action: "BUY" | "SELL" | "HOLD"; confidence: string; reason: string } {
    const { status, entryPrice, asset } = tradingAsset;
    const currentPrice = asset.currentPrice;
    const reasons: string[] = [];
    let buyScore = 0;
    let sellScore = 0;

    // === SELL CONDITIONS (check first if already bought) ===
    if (status === "bought" && entryPrice) {
      // Calculate profit using NATIVE currency to avoid FX rate fluctuation errors
      const nativeEntryPrice = tradingAsset.entryPriceNative || entryPrice;
      const profitPct = ((currentPrice - nativeEntryPrice) / nativeEntryPrice) * 100;

      // Target reached
      if (criteria.targetReached) {
        sellScore += 3;
        reasons.push(`Target profit raggiunto (+${profitPct.toFixed(1)}%)`);
      }

      // Stop-loss reached
      if (criteria.stopLossReached) {
        sellScore += 4; // High priority
        reasons.push(`Stop-loss raggiunto (${profitPct.toFixed(1)}%)`);
      }

      // RSI overbought
      if (criteria.rsi && criteria.rsi > 70) {
        sellScore += 1;
        reasons.push(`RSI ipercomprato (${criteria.rsi.toFixed(0)})`);
      }

      // MACD bearish
      if (criteria.macd === "bearish") {
        sellScore += 1;
        reasons.push("MACD bearish crossover");
      }

      // Negative sentiment
      if (criteria.sentiment && criteria.sentiment < -0.3) {
        sellScore += 1;
        reasons.push("Sentiment news negativo");
      }
    }

    // === BUY CONDITIONS (only if watching) ===
    if (status === "watching") {
      // RSI oversold
      if (criteria.rsi && criteria.rsi < 30) {
        buyScore += 2;
        reasons.push(`RSI ipervenduto (${criteria.rsi.toFixed(0)})`);
      } else if (criteria.rsi && criteria.rsi >= 40 && criteria.rsi <= 60) {
        buyScore += 1;
        reasons.push("RSI in zona neutrale");
      }

      // MACD bullish
      if (criteria.macd === "bullish") {
        buyScore += 2;
        reasons.push("MACD bullish crossover");
      }

      // Price above MA20
      if (criteria.priceVsMA20 === "above") {
        buyScore += 1;
        reasons.push("Prezzo sopra MA20");
      }

      // Positive sentiment
      if (criteria.sentiment && criteria.sentiment > 0.3) {
        buyScore += 1;
        reasons.push("Sentiment news positivo");
      }

      // High volume
      if (criteria.volumeRatio && criteria.volumeRatio > 1.5) {
        buyScore += 1;
        reasons.push("Volume sopra la media");
      }
    }

    // Determine action
    if (sellScore >= 2) {
      const confidence = sellScore >= 4 ? "high" : sellScore >= 3 ? "medium" : "low";
      return {
        action: "SELL",
        confidence,
        reason: reasons.join(". "),
      };
    }

    if (buyScore >= 3) {
      const confidence = buyScore >= 5 ? "high" : buyScore >= 4 ? "medium" : "low";
      return {
        action: "BUY",
        confidence,
        reason: reasons.join(". "),
      };
    }

    return { action: "HOLD", confidence: "low", reason: "" };
  }

  /**
   * Generate AI reason for BUY/SELL action
   */
  private async generateAIReason(
    action: "BUY" | "SELL",
    tradingAsset: any,
    asset: any,
    criteria: TradingCriteria,
    profile: any
  ): Promise<string | null> {
    const { entryPrice, entryPriceNative, status } = tradingAsset;
    const currentPrice = asset.currentPrice;

    // Calculate profit percentage using native currency
    let profitPct = 0;
    if (status === "bought" && entryPrice) {
      const nativeEntryPrice = entryPriceNative || entryPrice;
      profitPct = ((currentPrice - nativeEntryPrice) / nativeEntryPrice) * 100;
    }

    // Build context for AI
    const context = {
      action,
      symbol: asset.symbol,
      name: asset.name,
      status,
      currentPrice,
      profitPct: profitPct.toFixed(2),
      targetProfitPct: profile.targetProfitPct,
      maxLossPct: profile.maxLossPct,
      horizon: profile.horizon,
      riskTolerance: profile.riskTolerance,
      tradingStyle: profile.tradingStyle,
      rsi: criteria.rsi?.toFixed(0),
      macd: criteria.macd,
      priceVsMA20: criteria.priceVsMA20,
      sentiment: criteria.sentiment?.toFixed(2),
      volumeRatio: criteria.volumeRatio?.toFixed(2),
      targetReached: criteria.targetReached,
      stopLossReached: criteria.stopLossReached,
    };

    const actionInstructions = {
      BUY: "Spiega PERCHÉ è un buon momento per comprare questo asset",
      SELL: "Spiega PERCHÉ è il momento di vendere e realizzare i profitti (o limitare le perdite)",
      HOLD: "Spiega PERCHÉ conviene mantenere la posizione attuale e continuare a monitorare"
    };

    const prompt = `Sei un analista finanziario. ${actionInstructions[action]}.

ASSET: ${context.symbol} - ${context.name}
AZIONE CONSIGLIATA: ${action}
STATUS: ${status === "bought" ? "già acquistato" : "in osservazione"}
${status === "bought" ? `PROFITTO ATTUALE: ${context.profitPct}%` : ""}

PROFILO UTENTE:
- Target profitto: +${context.targetProfitPct}%
- Stop loss: -${context.maxLossPct}%
- Orizzonte: ${context.horizon}
- Tolleranza rischio: ${context.riskTolerance}
- Stile: ${context.tradingStyle}

INDICATORI TECNICI:
- RSI: ${context.rsi || "N/A"}
- MACD: ${context.macd || "N/A"}
- Prezzo vs MA20: ${context.priceVsMA20 || "N/A"}
- Sentiment news: ${context.sentiment || "N/A"}
- Volume ratio: ${context.volumeRatio || "N/A"}
${context.targetReached ? "- ✓ Target raggiunto" : ""}
${context.stopLossReached ? "- ✓ Stop loss raggiunto" : ""}

Rispondi in ITALIANO, max 2-3 frasi, spiegando il PERCHÉ basandoti sui dati sopra.
${action === "HOLD" ? "Indica quanto manca al target e cosa monitorare." : ""}
Sii conciso, chiaro e utile.`;

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        this.fastify.log.warn("ANTHROPIC_API_KEY not set, skipping AI reason generation");
        return null;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.fastify.log.error(`Anthropic API error: ${response.status} - ${errorText}`);
        return null;
      }

      const result = await response.json() as any;
      const aiReason = result.content?.[0]?.text?.trim();

      if (aiReason) {
        this.fastify.log.info(`✨ AI reason generated for ${action} ${asset.symbol}: ${aiReason.substring(0, 100)}...`);
        return aiReason;
      }

      return null;
    } catch (error) {
      this.fastify.log.error(error, "Failed to call Anthropic API");
      return null;
    }
  }

  /**
   * Analyze all trading assets for a user
   */
  async analyzeAllForUser(userId: string): Promise<void> {
    const profile = await this.fastify.prisma.tradingProfile.findUnique({
      where: { userId },
      include: {
        tradingAssets: {
          where: { status: { in: ["watching", "bought"] } },
        },
      },
    });

    if (!profile) return;

    for (const tradingAsset of profile.tradingAssets) {
      await this.analyzeAsset(tradingAsset.id);
    }
  }

  /**
   * Run analysis for all active trading profiles
   */
  async runGlobalAnalysis(): Promise<void> {
    const profiles = await this.fastify.prisma.tradingProfile.findMany({
      include: {
        tradingAssets: {
          where: { status: { in: ["watching", "bought"] } },
        },
      },
    });

    for (const profile of profiles) {
      for (const tradingAsset of profile.tradingAssets) {
        try {
          await this.analyzeAsset(tradingAsset.id);
        } catch (error) {
          this.fastify.log.error(error, `Failed to analyze trading asset ${tradingAsset.id}`);
        }
      }
    }
  }

  /**
   * Add asset to trading watchlist with calculated targets
   */
  async addAssetToTrading(
    profileId: string,
    assetId: string,
    params?: {
      status?: "watching" | "bought";
      entryPrice?: number;
      quantity?: number;
    }
  ): Promise<any> {
    const profile = await this.fastify.prisma.tradingProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) throw new Error("Trading profile not found");

    const asset = await this.fastify.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) throw new Error("Asset not found");

    // Check if trading asset already exists for this profile/asset
    const existingTradingAsset = await this.fastify.prisma.tradingAsset.findFirst({
      where: {
        profileId,
        assetId,
      },
      include: { asset: true },
    });

    const currentPrice = asset.currentPrice || 0;
    const status = params?.status || "watching";
    const entryPrice = params?.entryPrice || (status === "bought" ? currentPrice : null);

    // Calculate target and stop-loss based on profile
    // Use entryPrice for bought assets, currentPrice for watching assets
    const priceForThresholds = (status === "bought" && entryPrice) ? entryPrice : currentPrice;
    const targetPrice = priceForThresholds * (1 + profile.targetProfitPct / 100);
    const stopLossPrice = priceForThresholds * (1 - profile.maxLossPct / 100);

    // If exists and was sold, reactivate it
    if (existingTradingAsset) {
      if (existingTradingAsset.status === "sold") {
        return this.fastify.prisma.tradingAsset.update({
          where: { id: existingTradingAsset.id },
          data: {
            status,
            targetPrice,
            stopLossPrice,
            entryPrice,
            entryDate: status === "bought" ? new Date() : null,
            quantity: params?.quantity || null,
            exitPrice: null,
            exitDate: null,
            realizedProfitPct: null,
          },
          include: { asset: true },
        });
      }
      // Already watching or bought
      throw new Error("Asset already in trading list");
    }

    return this.fastify.prisma.tradingAsset.create({
      data: {
        profileId,
        assetId,
        status,
        targetPrice,
        stopLossPrice,
        entryPrice,
        entryDate: status === "bought" ? new Date() : null,
        quantity: params?.quantity || null,
      },
      include: { asset: true },
    });
  }

  /**
   * Execute a buy action
   */
  async executeBuy(
    tradingAssetId: string,
    quantity: number
  ): Promise<any> {
    const tradingAsset = await this.fastify.prisma.tradingAsset.findUnique({
      where: { id: tradingAssetId },
      include: { asset: true, profile: true },
    });

    if (!tradingAsset) throw new Error("Trading asset not found");
    if (tradingAsset.status !== "watching") throw new Error("Asset not in watching status");

    // Get real-time price from Yahoo Finance (not cached DB price)
    const marketData = new MarketDataService(this.fastify);
    const realTimeQuote = await marketData.getStockQuote(tradingAsset.asset.symbol);

    const currency = tradingAsset.asset.currency || "USD";
    const eurRate = currency === "EUR" ? 1 : await marketData.getToEurRate(currency);

    // Use real-time price if available, otherwise fall back to cached
    const currentPrice = realTimeQuote?.price || tradingAsset.asset.currentPrice || 0;
    const currentPriceEur = currentPrice * eurRate;
    const totalCostEur = currentPriceEur * quantity;

    // Update asset with real-time price
    if (realTimeQuote?.price) {
      await this.fastify.prisma.asset.update({
        where: { id: tradingAsset.assetId },
        data: {
          currentPrice: realTimeQuote.price,
          previousClose: realTimeQuote.previousClose,
          changePercent: realTimeQuote.changePercent,
        },
      });
    }

    // Check cash balance (in EUR)
    if (tradingAsset.profile.cashBalance < totalCostEur) {
      throw new Error(`Saldo insufficiente. Necessari: €${totalCostEur.toFixed(2)}, Disponibili: €${tradingAsset.profile.cashBalance.toFixed(2)}`);
    }

    // Calculate targets in EUR
    const targetPriceEur = currentPriceEur * (1 + tradingAsset.profile.targetProfitPct / 100);
    const stopLossPriceEur = currentPriceEur * (1 - tradingAsset.profile.maxLossPct / 100);

    // Get or create Trading portfolio for the user
    let tradingPortfolio = await this.fastify.prisma.portfolio.findFirst({
      where: {
        userId: tradingAsset.profile.userId,
        name: "Trading",
      },
    });

    if (!tradingPortfolio) {
      tradingPortfolio = await this.fastify.prisma.portfolio.create({
        data: {
          userId: tradingAsset.profile.userId,
          name: "Trading",
          description: "Portfolio per operazioni di trading a breve termine",
        },
      });
    }

    // Check if holding already exists to calculate weighted average
    const existingHolding = await this.fastify.prisma.holding.findUnique({
      where: {
        portfolioId_assetId: {
          portfolioId: tradingPortfolio.id,
          assetId: tradingAsset.assetId,
        },
      },
    });

    // Calculate weighted average buy price
    let newAvgBuyPrice = currentPriceEur;
    let newQuantity = quantity;
    if (existingHolding) {
      const existingCost = existingHolding.quantity * existingHolding.avgBuyPrice;
      const newCost = quantity * currentPriceEur;
      newQuantity = existingHolding.quantity + quantity;
      newAvgBuyPrice = (existingCost + newCost) / newQuantity;
    }

    // Execute in transaction
    const [updatedTradingAsset] = await this.fastify.prisma.$transaction([
      // Update trading asset status (prices stored in EUR)
      this.fastify.prisma.tradingAsset.update({
        where: { id: tradingAssetId },
        data: {
          status: "bought",
          entryPrice: currentPriceEur,
          entryPriceNative: currentPrice, // Store native currency price too
          entryDate: new Date(),
          quantity,
          targetPrice: targetPriceEur,
          stopLossPrice: stopLossPriceEur,
        },
        include: { asset: true },
      }),

      // Deduct from cash balance (in EUR)
      this.fastify.prisma.tradingProfile.update({
        where: { id: tradingAsset.profile.id },
        data: {
          cashBalance: { decrement: totalCostEur },
        },
      }),

      // Create or update holding in portfolio (avgBuyPrice in EUR - weighted average)
      this.fastify.prisma.holding.upsert({
        where: {
          portfolioId_assetId: {
            portfolioId: tradingPortfolio.id,
            assetId: tradingAsset.assetId,
          },
        },
        create: {
          portfolioId: tradingPortfolio.id,
          assetId: tradingAsset.assetId,
          quantity,
          avgBuyPrice: currentPriceEur,
          tradingAssetId: tradingAssetId,
        },
        update: {
          quantity: newQuantity,
          avgBuyPrice: newAvgBuyPrice,
          tradingAssetId: tradingAssetId,
        },
      }),
    ]);

    this.fastify.log.info(`Buy executed: ${tradingAsset.asset.symbol} x${quantity} @ €${currentPriceEur.toFixed(2)}, Total: €${totalCostEur.toFixed(2)}`);

    return updatedTradingAsset;
  }

  /**
   * Execute a sell action
   */
  async executeSell(tradingAssetId: string): Promise<any> {
    const tradingAsset = await this.fastify.prisma.tradingAsset.findUnique({
      where: { id: tradingAssetId },
      include: { asset: true, profile: true },
    });

    if (!tradingAsset) throw new Error("Trading asset not found");
    if (tradingAsset.status !== "bought") throw new Error("Asset not in bought status");

    // Get real-time price from Yahoo Finance (not cached DB price)
    const marketData = new MarketDataService(this.fastify);
    const realTimeQuote = await marketData.getStockQuote(tradingAsset.asset.symbol);

    const currency = tradingAsset.asset.currency || "USD";
    const eurRate = currency === "EUR" ? 1 : await marketData.getToEurRate(currency);

    // Use real-time price if available, otherwise fall back to cached
    const currentPrice = realTimeQuote?.price || tradingAsset.asset.currentPrice || 0;
    const currentPriceEur = currentPrice * eurRate;
    const entryPrice = tradingAsset.entryPrice || currentPriceEur; // entryPrice is already in EUR

    // Update asset with real-time price
    if (realTimeQuote?.price) {
      await this.fastify.prisma.asset.update({
        where: { id: tradingAsset.assetId },
        data: {
          currentPrice: realTimeQuote.price,
          previousClose: realTimeQuote.previousClose,
          changePercent: realTimeQuote.changePercent,
        },
      });
    }
    const quantity = tradingAsset.quantity || 0;
    const proceedsEur = currentPriceEur * quantity; // Proceeds in EUR
    const realizedProfitPct = ((currentPriceEur - entryPrice) / entryPrice) * 100;
    const realizedProfitEur = proceedsEur - (entryPrice * quantity);

    // Find the trading portfolio
    const tradingPortfolio = await this.fastify.prisma.portfolio.findFirst({
      where: {
        userId: tradingAsset.profile.userId,
        name: "Trading",
      },
    });

    // Execute in transaction
    const [updatedTradingAsset] = await this.fastify.prisma.$transaction([
      // Update trading asset status
      this.fastify.prisma.tradingAsset.update({
        where: { id: tradingAssetId },
        data: {
          status: "sold",
          exitPrice: currentPrice,
          exitDate: new Date(),
          realizedProfitPct,
        },
        include: { asset: true },
      }),

      // Add proceeds to cash balance (in EUR)
      this.fastify.prisma.tradingProfile.update({
        where: { id: tradingAsset.profile.id },
        data: {
          cashBalance: { increment: proceedsEur },
        },
      }),

      // Remove holding from portfolio (if exists)
      ...(tradingPortfolio
        ? [
            this.fastify.prisma.holding.deleteMany({
              where: {
                portfolioId: tradingPortfolio.id,
                assetId: tradingAsset.assetId,
                tradingAssetId: tradingAssetId,
              },
            }),
          ]
        : []),
    ]);

    this.fastify.log.info(`Sell executed: ${tradingAsset.asset.symbol} x${quantity} @ €${currentPriceEur.toFixed(2)}, Proceeds: €${proceedsEur.toFixed(2)}, P/L: ${realizedProfitEur >= 0 ? '+' : ''}€${realizedProfitEur.toFixed(2)} (${realizedProfitPct.toFixed(1)}%)`);

    return updatedTradingAsset;
  }

  /**
   * Generate trading suggestions for a user based on their profile
   */
  async generateSuggestions(userId: string): Promise<number> {
    this.fastify.log.info(`Generating suggestions for user ${userId}`);

    const profile = await this.fastify.prisma.tradingProfile.findUnique({
      where: { userId },
      include: {
        tradingAssets: true,
      },
    });

    if (!profile) {
      this.fastify.log.warn(`No trading profile found for user ${userId}`);
      return 0;
    }

    this.fastify.log.info(`Profile found: ${profile.id}, sectors: ${profile.preferredSectors.join(', ') || 'none'}, style: ${profile.tradingStyle}`);

    // Get assets already in trading (to exclude)
    const existingAssetSymbols = new Set<string>();
    for (const ta of profile.tradingAssets) {
      const asset = await this.fastify.prisma.asset.findUnique({ where: { id: ta.assetId } });
      if (asset) existingAssetSymbols.add(asset.symbol);
    }

    // Get pending OR recently dismissed suggestions (to exclude)
    const excludedSuggestions = await this.fastify.prisma.tradingSuggestion.findMany({
      where: {
        profileId: profile.id,
        OR: [
          { status: "pending" },
          { status: "accepted" },
          {
            status: "dismissed",
            dismissedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
      include: { asset: true },
    });
    const excludedSymbols = new Set(excludedSuggestions.map((s) => s.asset.symbol));

    // Combine all excluded symbols
    const allExcludedSymbols = new Set([...existingAssetSymbols, ...excludedSymbols]);

    // ─── FETCH CANDIDATES FROM YAHOO FINANCE ───────────────────────────
    const marketData = new MarketDataService(this.fastify);

    // Fetch from multiple Yahoo Finance sources based on trading style
    this.fastify.log.info("Fetching candidates from Yahoo Finance...");

    const [trending, gainers, losers, mostActive, undervalued, growthTech] = await Promise.all([
      marketData.getTrendingStocks(25),
      marketData.getTopGainers(20),
      marketData.getTopLosers(20),
      marketData.getMostActive(20),
      marketData.getUndervaluedLargeCaps(15),
      marketData.getGrowthTechStocks(15),
    ]);

    this.fastify.log.info(`Yahoo Finance results: trending=${trending.length}, gainers=${gainers.length}, losers=${losers.length}, active=${mostActive.length}, undervalued=${undervalued.length}, growthTech=${growthTech.length}`);

    // Combine all candidates and deduplicate by symbol
    const candidateMap = new Map<string, {
      symbol: string;
      name: string;
      price: number;
      changePercent: number;
      volume: number;
      sector?: string;
      sources: string[];
      score: number;
    }>();

    // ─── SCORING BASED ON PROFILE ──────────────────────────────────────
    //
    // Horizon scoring multipliers:
    // - short: high volatility = good, gainers/losers = great, undervalued = less relevant
    // - medium: balanced approach
    // - long: stability = good, undervalued = great, volatility = less relevant
    //
    // Risk tolerance:
    // - conservative: prefer stable, avoid high volatility
    // - moderate: balanced
    // - aggressive: embrace volatility for higher gains
    //
    const horizonScores: Record<string, { trending: number; gainers: number; losers: number; active: number; undervalued: number; growth: number; volatilityBonus: number }> = {
      short: { trending: 4, gainers: 5, losers: 4, active: 5, undervalued: 1, growth: 2, volatilityBonus: 3 },
      medium: { trending: 3, gainers: 3, losers: 3, active: 3, undervalued: 3, growth: 3, volatilityBonus: 1 },
      long: { trending: 1, gainers: 1, losers: 2, active: 1, undervalued: 5, growth: 4, volatilityBonus: 0 },
    };

    const riskMultipliers: Record<string, { volatility: number; losers: number; undervalued: number }> = {
      conservative: { volatility: 0.3, losers: 0.5, undervalued: 1.5 },
      moderate: { volatility: 1, losers: 1, undervalued: 1 },
      aggressive: { volatility: 2, losers: 1.5, undervalued: 0.7 },
    };

    const styleModifiers: Record<string, { trending: number; gainers: number; losers: number; undervalued: number; growth: number }> = {
      momentum: { trending: 1.3, gainers: 1.5, losers: 0.8, undervalued: 0.5, growth: 1 },
      value: { trending: 0.5, gainers: 0.5, losers: 1.3, undervalued: 2, growth: 0.8 },
      swing: { trending: 1, gainers: 1, losers: 1.5, undervalued: 1, growth: 1 },
      scalping: { trending: 1.5, gainers: 1.5, losers: 1, undervalued: 0.3, growth: 0.5 },
    };

    const hScores = horizonScores[profile.horizon] || horizonScores.medium;
    const rMults = riskMultipliers[profile.riskTolerance] || riskMultipliers.moderate;
    const sMods = styleModifiers[profile.tradingStyle] || styleModifiers.swing;

    // Calculate volatility score bonus based on absolute change
    const getVolatilityBonus = (changePercent: number): number => {
      const absChange = Math.abs(changePercent);
      if (absChange >= 10) return hScores.volatilityBonus * rMults.volatility * 3;
      if (absChange >= 5) return hScores.volatilityBonus * rMults.volatility * 2;
      if (absChange >= 3) return hScores.volatilityBonus * rMults.volatility;
      return 0;
    };

    const addCandidates = (list: typeof trending, source: string, baseScore: number) => {
      for (const stock of list) {
        if (allExcludedSymbols.has(stock.symbol)) continue;
        if (!stock.price || stock.price < 1) continue; // Skip penny stocks

        // Calculate total score with volatility bonus
        let stockScore = baseScore + getVolatilityBonus(stock.changePercent);

        // For short-term + aggressive: extra bonus for high movers
        if (profile.horizon === "short" && profile.riskTolerance === "aggressive") {
          if (Math.abs(stock.changePercent) >= 5) {
            stockScore += 3;
          }
        }

        const existing = candidateMap.get(stock.symbol);
        if (existing) {
          existing.score += stockScore;
          existing.sources.push(source);
        } else {
          candidateMap.set(stock.symbol, {
            ...stock,
            sources: [source],
            score: stockScore,
          });
        }
      }
    };

    // Add candidates with profile-aware scoring
    addCandidates(trending, "trending", hScores.trending * sMods.trending);
    addCandidates(gainers, "gainers", hScores.gainers * sMods.gainers);
    addCandidates(losers, "losers", hScores.losers * sMods.losers * rMults.losers);
    addCandidates(mostActive, "active", hScores.active);
    addCandidates(undervalued, "undervalued", hScores.undervalued * sMods.undervalued * rMults.undervalued);
    addCandidates(growthTech, "growth", hScores.growth * sMods.growth);

    // Filter by preferred sectors if specified
    let candidates = Array.from(candidateMap.values());
    if (profile.preferredSectors.length > 0) {
      const preferredSectorsLower = profile.preferredSectors.map(s => s.toLowerCase());
      candidates = candidates.filter((c) => {
        if (!c.sector) return true; // Include if sector unknown
        return preferredSectorsLower.some(ps => c.sector!.toLowerCase().includes(ps));
      });
    }

    // For conservative + long-term: filter out high volatility stocks
    if (profile.riskTolerance === "conservative" && profile.horizon === "long") {
      candidates = candidates.filter((c) => Math.abs(c.changePercent) < 8);
    }

    this.fastify.log.info(`After filtering: ${candidates.length} candidates (horizon=${profile.horizon}, risk=${profile.riskTolerance}, style=${profile.tradingStyle})`);

    // Sort by score and take top candidates
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, 20);

    // ─── ENSURE ASSETS EXIST IN DB ─────────────────────────────────────
    const assetIdMap = new Map<string, string>(); // symbol -> assetId

    for (const candidate of topCandidates) {
      // Check if asset already exists
      let asset = await this.fastify.prisma.asset.findFirst({
        where: { symbol: candidate.symbol },
      });

      if (!asset) {
        // Get detailed info from Yahoo
        const detailed = await marketData.getDetailedQuote(candidate.symbol);

        // Create asset in DB
        asset = await this.fastify.prisma.asset.create({
          data: {
            symbol: candidate.symbol,
            name: candidate.name,
            type: "stock",
            sector: detailed?.sector || candidate.sector,
            exchange: "US",
            currency: detailed?.currency || "USD",
            currentPrice: candidate.price,
            previousClose: candidate.price / (1 + candidate.changePercent / 100),
            changePercent: candidate.changePercent,
            volume: candidate.volume,
            marketCap: detailed?.marketCap,
          },
        });

        this.fastify.log.info(`Created asset: ${asset.symbol} (${asset.id})`);
      } else {
        // Update current price
        await this.fastify.prisma.asset.update({
          where: { id: asset.id },
          data: {
            currentPrice: candidate.price,
            changePercent: candidate.changePercent,
            volume: candidate.volume,
          },
        });
      }

      assetIdMap.set(candidate.symbol, asset.id);
    }

    // ─── GENERATE SUGGESTIONS ──────────────────────────────────────────
    const suggestions: any[] = [];

    for (const candidate of topCandidates) {
      const assetId = assetIdMap.get(candidate.symbol);
      if (!assetId) continue;

      // Analyze and generate reason
      const analysis = this.analyzeYahooCandidate(candidate, profile);

      suggestions.push({
        profileId: profile.id,
        assetId,
        reason: analysis.reason,
        confidence: analysis.confidence,
        expectedProfit: profile.targetProfitPct,
        riskLevel: analysis.riskLevel,
        timeframe: profile.horizon === "short" ? "days" : profile.horizon === "medium" ? "weeks" : "months",
        criteria: {
          sources: candidate.sources,
          score: candidate.score,
          changePercent: candidate.changePercent,
          volume: candidate.volume,
          horizon: profile.horizon,
          riskTolerance: profile.riskTolerance,
        },
        status: "pending",
      });
    }

    // Sort by confidence and take top 5
    suggestions.sort((a, b) => {
      const confOrder = { high: 3, medium: 2, low: 1 };
      return (confOrder[b.confidence as keyof typeof confOrder] || 0) -
             (confOrder[a.confidence as keyof typeof confOrder] || 0);
    });

    const topSuggestions = suggestions.slice(0, 5);

    // Save suggestions
    if (topSuggestions.length > 0) {
      await this.fastify.prisma.tradingSuggestion.createMany({
        data: topSuggestions,
        skipDuplicates: true,
      });

      // Build message for Telegram (with Markdown formatting)
      const confidenceEmoji = (conf: string) => conf === "high" ? "⭐⭐⭐" : conf === "medium" ? "⭐⭐" : "⭐";
      const riskEmoji = (risk: string) => risk === "high" ? "🔴" : risk === "medium" ? "🟡" : "🟢";

      let telegramMessage = `📊 *Nuovi Suggerimenti Trading*\n\nTrovati ${topSuggestions.length} asset idonei al tuo profilo:\n`;

      for (let i = 0; i < Math.min(topSuggestions.length, 5); i++) {
        const suggestion = topSuggestions[i];
        const candidate = topCandidates[i];

        telegramMessage += `\n*${i + 1}. ${candidate.symbol}* - ${candidate.name}\n`;
        telegramMessage += `💰 ${confidenceEmoji(suggestion.confidence)} Fiducia ${suggestion.confidence === "high" ? "Alta" : suggestion.confidence === "medium" ? "Media" : "Bassa"}\n`;
        telegramMessage += `${riskEmoji(suggestion.riskLevel)} Rischio ${suggestion.riskLevel === "high" ? "Alto" : suggestion.riskLevel === "medium" ? "Medio" : "Basso"}\n`;
        telegramMessage += `📈 €${candidate.price.toFixed(2)} (${candidate.changePercent >= 0 ? "+" : ""}${candidate.changePercent.toFixed(2)}%)\n`;
        telegramMessage += `💡 ${suggestion.reason}\n`;
      }

      telegramMessage += `\n🎯 Vai su *Trading > Suggerimenti* per vederli tutti!`;

      // Build simple message for in-app notification
      const topAssets = topCandidates.slice(0, 3).map((c) => c.symbol).join(", ");
      const inAppMessage = `Trovati ${topSuggestions.length} nuovi asset idonei al tuo profilo${topSuggestions.length <= 3 ? ": " + topAssets : " tra cui: " + topAssets}. Vai alla sezione Trading > Suggerimenti per vederli tutti.`;

      // Send in-app notification
      await this.notificationService.notify(
        userId,
        ["in_app"],
        inAppMessage,
        {
          title: "Nuovi Suggerimenti Trading",
          type: "trading_suggestion",
          data: {
            count: topSuggestions.length,
            symbols: topCandidates.slice(0, 5).map((c) => c.symbol),
          },
        }
      );

      // Send Telegram notification
      await this.notificationService.notify(
        userId,
        ["telegram"],
        telegramMessage,
        {
          title: "Nuovi Suggerimenti Trading",
          type: "trading_suggestion",
        }
      );
    }

    return topSuggestions.length;
  }

  /**
   * Analyze a Yahoo Finance candidate for suggestion
   */
  private analyzeYahooCandidate(
    candidate: { symbol: string; name: string; price: number; changePercent: number; volume: number; sector?: string; sources: string[]; score: number },
    profile: any
  ): { reason: string; confidence: string; riskLevel: string } {
    const reasons: string[] = [];
    let confidence = "medium";
    let riskLevel = "medium";
    const sources = candidate.sources;
    const absChange = Math.abs(candidate.changePercent);

    // ─── HORIZON-SPECIFIC REASONS ──────────────────────────────────────
    if (profile.horizon === "short") {
      // Short-term: emphasize volatility and momentum
      if (absChange >= 5) {
        reasons.push(`Alta volatilità (${candidate.changePercent >= 0 ? "+" : ""}${candidate.changePercent.toFixed(1)}%) - ideale per trading a breve`);
        confidence = "high";
      }
      if (sources.includes("active")) {
        reasons.push("Volume elevato - alta liquidità per entrata/uscita rapida");
      }
      if (sources.includes("gainers") && candidate.changePercent > 0) {
        reasons.push("Momentum positivo - potenziale continuazione del trend");
      }
      if (sources.includes("losers") && candidate.changePercent < 0) {
        reasons.push("Forte calo - opportunità di rimbalzo a breve");
        riskLevel = "high";
      }
    } else if (profile.horizon === "medium") {
      // Medium-term: balanced
      if (sources.includes("trending")) {
        reasons.push("Titolo in tendenza - interesse crescente del mercato");
      }
      if (sources.includes("growth")) {
        reasons.push("Potenziale di crescita nel medio periodo");
      }
      if (absChange >= 3) {
        reasons.push(`Movimento significativo (${candidate.changePercent.toFixed(1)}%)`);
      }
    } else {
      // Long-term: emphasize fundamentals
      if (sources.includes("undervalued")) {
        reasons.push("Sottovalutato - potenziale apprezzamento nel lungo periodo");
        confidence = "high";
        riskLevel = "low";
      }
      if (sources.includes("growth")) {
        reasons.push("Settore in crescita - buone prospettive a lungo termine");
      }
      if (absChange < 3) {
        reasons.push("Volatilità contenuta - adatto per investimento stabile");
        riskLevel = "low";
      }
    }

    // ─── SOURCE-BASED REASONS (if not already covered) ─────────────────
    if (sources.includes("trending") && !reasons.some(r => r.includes("tendenza"))) {
      reasons.push("Titolo in tendenza sui mercati");
    }

    // ─── RISK TOLERANCE ADJUSTMENTS ────────────────────────────────────
    if (profile.riskTolerance === "aggressive") {
      if (absChange >= 8) {
        reasons.push("Alta volatilità - adatto al tuo profilo aggressivo");
        confidence = "high";
      }
      // Aggressive can handle high risk
    } else if (profile.riskTolerance === "conservative") {
      if (riskLevel === "high") {
        riskLevel = "medium"; // Downgrade for conservative
      }
      if (absChange < 5 && sources.includes("undervalued")) {
        reasons.push("Profilo di rischio contenuto");
        confidence = "high";
      }
    }

    // ─── MULTIPLE SOURCES BONUS ────────────────────────────────────────
    if (sources.length >= 3) {
      confidence = "high";
      reasons.push(`Segnalato da ${sources.length} fonti diverse`);
    } else if (sources.length === 2) {
      if (confidence !== "high") confidence = "medium";
    }

    // ─── SCORE-BASED CONFIDENCE ────────────────────────────────────────
    if (candidate.score >= 15) {
      confidence = "high";
    } else if (candidate.score >= 8) {
      if (confidence === "low") confidence = "medium";
    }

    // ─── SECTOR MATCH ──────────────────────────────────────────────────
    if (candidate.sector && profile.preferredSectors.length > 0) {
      const sectorMatch = profile.preferredSectors.some((ps: string) =>
        candidate.sector!.toLowerCase().includes(ps.toLowerCase())
      );
      if (sectorMatch) {
        reasons.push(`Settore ${candidate.sector} in linea con le tue preferenze`);
      }
    }

    return {
      reason: reasons.join(". ") + ".",
      confidence,
      riskLevel,
    };
  }

  /**
   * Analyze an asset for potential suggestion
   */
  private analyzeAssetForSuggestion(
    asset: any,
    profile: any
  ): { score: number; confidence: string; reason: string; criteria: any } {
    const criteria: any = {};
    const reasons: string[] = [];
    let score = 0;

    const currentPrice = asset.currentPrice;
    const hasTechnicalSignals = asset.technicalSignals && asset.technicalSignals.length > 0;

    // Extract technical indicators (if available)
    for (const signal of asset.technicalSignals || []) {
      if (signal.indicator === "RSI") {
        criteria.rsi = signal.value;
        if (signal.value < 30) {
          score += 2;
          reasons.push(`RSI ipervenduto (${signal.value.toFixed(0)})`);
        } else if (signal.value >= 30 && signal.value <= 50) {
          score += 1;
          reasons.push("RSI favorevole");
        }
      } else if (signal.indicator === "MACD") {
        criteria.macd = signal.signal;
        if (signal.signal === "bullish") {
          score += 2;
          reasons.push("MACD bullish");
        }
      } else if (signal.indicator === "MA20") {
        criteria.priceVsMA20 = currentPrice > signal.value ? "above" : "below";
        if (currentPrice > signal.value) {
          score += 1;
          reasons.push("Sopra MA20");
        }
      } else if (signal.indicator === "MA50") {
        criteria.priceVsMA50 = currentPrice > signal.value ? "above" : "below";
        if (currentPrice > signal.value) {
          score += 1;
          reasons.push("Sopra MA50");
        }
      }
    }

    // === BASIC CRITERIA (work without technical signals) ===

    // Asset type scoring based on risk tolerance
    if (asset.type === "crypto") {
      criteria.assetType = "crypto";
      if (profile.riskTolerance === "aggressive") {
        score += 1;
        reasons.push("Crypto (adatto a profilo aggressivo)");
      }
    } else if (asset.type === "stock") {
      criteria.assetType = "stock";
      // Stocks are generally good for all profiles
      score += 1;
      reasons.push("Azione quotata");
    } else if (asset.type === "etf") {
      criteria.assetType = "etf";
      if (profile.riskTolerance !== "aggressive") {
        score += 1;
        reasons.push("ETF diversificato");
      }
    }

    // Positive daily change is a good sign
    if (asset.changePercent != null && asset.changePercent > 0) {
      criteria.dailyChange = asset.changePercent;
      if (asset.changePercent > 2) {
        score += 1;
        reasons.push(`Momentum positivo (+${asset.changePercent.toFixed(1)}%)`);
      } else if (asset.changePercent > 0.5) {
        score += 1;
        reasons.push("Trend giornaliero positivo");
      }
    }

    // Market cap consideration (if available)
    if (asset.marketCap) {
      criteria.marketCap = asset.marketCap;
      if (asset.marketCap > 100_000_000_000) { // > 100B = large cap
        if (profile.riskTolerance === "conservative") {
          score += 1;
          reasons.push("Large cap (stabile)");
        }
      } else if (asset.marketCap > 10_000_000_000) { // > 10B = mid cap
        score += 1;
        reasons.push("Mid cap");
      } else if (profile.riskTolerance === "aggressive") {
        score += 1;
        reasons.push("Small cap (alto potenziale)");
      }
    }

    // Analyze news sentiment
    if (asset.newsItems && asset.newsItems.length > 0) {
      const sentimentScores = asset.newsItems
        .map((na: any) => {
          const s = na.newsItem?.sentiment;
          if (s === "positive") return 1;
          if (s === "negative") return -1;
          return 0;
        })
        .filter((s: number) => s !== 0);

      if (sentimentScores.length > 0) {
        const avgSentiment = sentimentScores.reduce((a: number, b: number) => a + b, 0) / sentimentScores.length;
        criteria.sentiment = avgSentiment;
        if (avgSentiment > 0.3) {
          score += 1;
          reasons.push("Sentiment positivo");
        }
      }
    }

    // Check sector match
    if (profile.preferredSectors.length > 0 && asset.sector) {
      if (profile.preferredSectors.includes(asset.sector)) {
        score += 1;
        reasons.push(`Settore preferito (${asset.sector})`);
      }
    }

    // Volatility check based on risk tolerance
    if (asset.changePercent != null) {
      const volatility = Math.abs(asset.changePercent);
      criteria.volatility = volatility;

      if (profile.riskTolerance === "aggressive" && volatility > 3) {
        score += 1;
        reasons.push("Alta volatilità");
      } else if (profile.riskTolerance === "moderate" && volatility >= 1 && volatility <= 3) {
        score += 1;
        reasons.push("Volatilità moderata");
      } else if (profile.riskTolerance === "conservative" && volatility < 2) {
        score += 1;
        reasons.push("Bassa volatilità");
      }
    }

    // Determine confidence (adjusted thresholds when no technical signals)
    let confidence: string;
    const confidenceThreshold = hasTechnicalSignals ? { high: 5, medium: 4 } : { high: 4, medium: 3 };

    if (score >= confidenceThreshold.high) {
      confidence = "high";
    } else if (score >= confidenceThreshold.medium) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    return {
      score,
      confidence,
      reason: reasons.length > 0 ? reasons.join(". ") : "Opportunità di mercato",
      criteria,
    };
  }

  /**
   * Determine risk level of an asset
   */
  private determineRiskLevel(asset: any, profile: any): string {
    const volatility = Math.abs(asset.changePercent || 0);

    if (asset.type === "crypto") return "high";
    if (volatility > 5) return "high";
    if (volatility > 2) return "medium";
    return "low";
  }

  /**
   * Accept a trading suggestion (add to trading assets)
   */
  async acceptSuggestion(
    suggestionId: string,
    userId: string,
    params?: {
      status?: "watching" | "bought";
      entryPrice?: number;
      quantity?: number;
    }
  ): Promise<any> {
    const suggestion = await this.fastify.prisma.tradingSuggestion.findUnique({
      where: { id: suggestionId },
      include: { profile: true, asset: true },
    });

    if (!suggestion) throw new Error("Suggestion not found");
    if (suggestion.profile.userId !== userId) throw new Error("Not authorized");
    if (suggestion.status !== "pending") throw new Error("Suggestion already processed");

    // Add to trading assets
    const tradingAsset = await this.addAssetToTrading(
      suggestion.profileId,
      suggestion.assetId,
      params
    );

    // Delete any existing accepted suggestions for the same profile/asset
    // to avoid unique constraint violation
    await this.fastify.prisma.tradingSuggestion.deleteMany({
      where: {
        profileId: suggestion.profileId,
        assetId: suggestion.assetId,
        status: "accepted",
      },
    });

    // Update suggestion status
    await this.fastify.prisma.tradingSuggestion.update({
      where: { id: suggestionId },
      data: { status: "accepted", acceptedAt: new Date() },
    });

    return tradingAsset;
  }

  /**
   * Dismiss a trading suggestion
   */
  async dismissSuggestion(suggestionId: string, userId: string): Promise<void> {
    const suggestion = await this.fastify.prisma.tradingSuggestion.findUnique({
      where: { id: suggestionId },
      include: { profile: true },
    });

    if (!suggestion) throw new Error("Suggestion not found");
    if (suggestion.profile.userId !== userId) throw new Error("Not authorized");

    // Delete any existing dismissed suggestions for the same profile/asset
    // to avoid unique constraint violation
    await this.fastify.prisma.tradingSuggestion.deleteMany({
      where: {
        profileId: suggestion.profileId,
        assetId: suggestion.assetId,
        status: "dismissed",
      },
    });

    await this.fastify.prisma.tradingSuggestion.update({
      where: { id: suggestionId },
      data: { status: "dismissed", dismissedAt: new Date() },
    });
  }

  /**
   * Get pending suggestions for a user
   */
  async getSuggestions(userId: string): Promise<any[]> {
    const profile = await this.fastify.prisma.tradingProfile.findUnique({
      where: { userId },
    });

    if (!profile) return [];

    // Get assets already in trading (watching or bought)
    const tradingAssets = await this.fastify.prisma.tradingAsset.findMany({
      where: {
        profileId: profile.id,
        status: { in: ["watching", "bought"] },
      },
      select: { assetId: true },
    });
    const tradingAssetIds = new Set(tradingAssets.map((ta) => ta.assetId));

    const suggestions = await this.fastify.prisma.tradingSuggestion.findMany({
      where: {
        profileId: profile.id,
        status: "pending",
        // Exclude assets already in trading
        assetId: { notIn: Array.from(tradingAssetIds) },
      },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    });

    // Get EUR conversion rates
    const marketData = new MarketDataService(this.fastify);
    const eurRates = await marketData.getEurRates();
    const defaultRate = eurRates["USD"] || (await marketData.getUsdToEurRate());

    const toEur = (value: number, currency: string) =>
      currency === "EUR" ? value : +(value * (eurRates[currency] || defaultRate)).toFixed(2);

    return suggestions.map((s) => {
      const currency = s.asset.currency;
      const currentPrice = s.asset.currentPrice || 0;
      return {
        ...s,
        symbol: s.asset.symbol,
        name: s.asset.name,
        currency,
        currentPrice,
        currentPriceEur: toEur(currentPrice, currency),
        changePercent: s.asset.changePercent,
        sector: s.asset.sector,
        type: s.asset.type,
      };
    });
  }
}
