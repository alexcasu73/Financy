import { FastifyInstance } from "fastify";

interface SentimentScore {
  value: number; // 0-100 (0 = extreme fear, 100 = extreme greed)
  label: string;
  source: string;
}

interface AggregatedSentiment {
  overall: {
    value: number;
    label: string;
    classification: string;
  };
  fearGreedIndex: SentimentScore | null;
  newsSentiment: SentimentScore | null;
  technicalSentiment: SentimentScore | null;
  portfolioSentiment: SentimentScore | null;
  lastUpdated: string;
}

export class SentimentService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Fetch Fear & Greed Index from Alternative.me (crypto) and CNN (stocks)
   */
  async getFearGreedIndex(): Promise<SentimentScore | null> {
    try {
      // Alternative.me Fear & Greed Index (crypto-focused but widely used)
      const response = await fetch("https://api.alternative.me/fng/?limit=1");
      if (!response.ok) return null;

      const data = await response.json();
      const fng = data.data?.[0];

      if (!fng) return null;

      return {
        value: parseInt(fng.value, 10),
        label: fng.value_classification,
        source: "Fear & Greed Index",
      };
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch Fear & Greed Index");
      return null;
    }
  }

  /**
   * Calculate sentiment from recent news
   */
  async getNewsSentiment(): Promise<SentimentScore | null> {
    try {
      const recentNews = await this.fastify.prisma.newsItem.findMany({
        where: {
          publishedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
          sentiment: { not: null },
        },
        select: { sentiment: true },
      });

      if (recentNews.length === 0) return null;

      // Map sentiment labels to scores
      const sentimentScores: Record<string, number> = {
        very_positive: 90,
        positive: 70,
        neutral: 50,
        negative: 30,
        very_negative: 10,
        // Alternative labels
        bullish: 75,
        bearish: 25,
      };

      let totalScore = 0;
      let count = 0;

      for (const news of recentNews) {
        const score = sentimentScores[news.sentiment?.toLowerCase() || ""] ?? 50;
        totalScore += score;
        count++;
      }

      const avgScore = Math.round(totalScore / count);
      const label = this.getLabel(avgScore);

      return {
        value: avgScore,
        label,
        source: `News (${count} articoli)`,
      };
    } catch (error) {
      this.fastify.log.error(error, "Failed to calculate news sentiment");
      return null;
    }
  }

  /**
   * Calculate sentiment from technical indicators
   */
  async getTechnicalSentiment(): Promise<SentimentScore | null> {
    try {
      const recentSignals = await this.fastify.prisma.technicalSignal.findMany({
        where: {
          calculatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: { signal: true },
      });

      if (recentSignals.length === 0) return null;

      // Map signals to scores
      const signalScores: Record<string, number> = {
        strong_buy: 90,
        buy: 70,
        neutral: 50,
        hold: 50,
        sell: 30,
        strong_sell: 10,
      };

      let totalScore = 0;
      let count = 0;

      for (const sig of recentSignals) {
        const score = signalScores[sig.signal?.toLowerCase() || ""] ?? 50;
        totalScore += score;
        count++;
      }

      const avgScore = Math.round(totalScore / count);
      const label = this.getLabel(avgScore);

      return {
        value: avgScore,
        label,
        source: `Indicatori tecnici (${count})`,
      };
    } catch (error) {
      this.fastify.log.error(error, "Failed to calculate technical sentiment");
      return null;
    }
  }

  /**
   * Calculate sentiment for user's portfolio
   */
  async getPortfolioSentiment(userId: string): Promise<SentimentScore | null> {
    try {
      const portfolios = await this.fastify.prisma.portfolio.findMany({
        where: { userId },
        include: {
          holdings: {
            include: { asset: true },
          },
        },
      });

      const allHoldings = portfolios.flatMap((p) => p.holdings);
      if (allHoldings.length === 0) return null;

      let totalWeight = 0;
      let weightedScore = 0;

      for (const holding of allHoldings) {
        const value = holding.quantity * (holding.asset.currentPrice || 0);
        const changePercent = holding.asset.changePercent || 0;

        // Convert price change to sentiment score (capped at -10% to +10%)
        const normalizedChange = Math.max(-10, Math.min(10, changePercent));
        const score = 50 + normalizedChange * 5; // -10% = 0, 0% = 50, +10% = 100

        weightedScore += score * value;
        totalWeight += value;
      }

      if (totalWeight === 0) return null;

      const avgScore = Math.round(weightedScore / totalWeight);
      const label = this.getLabel(avgScore);

      return {
        value: avgScore,
        label,
        source: `Portfolio (${allHoldings.length} asset)`,
      };
    } catch (error) {
      this.fastify.log.error(error, "Failed to calculate portfolio sentiment");
      return null;
    }
  }

  /**
   * Get aggregated sentiment from all sources
   */
  async getAggregatedSentiment(userId?: string): Promise<AggregatedSentiment> {
    const [fearGreed, news, technical, portfolio] = await Promise.all([
      this.getFearGreedIndex(),
      this.getNewsSentiment(),
      this.getTechnicalSentiment(),
      userId ? this.getPortfolioSentiment(userId) : null,
    ]);

    // Calculate weighted average
    const sources: { score: number; weight: number }[] = [];

    if (fearGreed) sources.push({ score: fearGreed.value, weight: 3 }); // Higher weight for F&G
    if (news) sources.push({ score: news.value, weight: 2 });
    if (technical) sources.push({ score: technical.value, weight: 2 });
    if (portfolio) sources.push({ score: portfolio.value, weight: 1 });

    let overallValue = 50; // Default neutral
    if (sources.length > 0) {
      const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
      overallValue = Math.round(
        sources.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight
      );
    }

    return {
      overall: {
        value: overallValue,
        label: this.getLabel(overallValue),
        classification: this.getClassification(overallValue),
      },
      fearGreedIndex: fearGreed,
      newsSentiment: news,
      technicalSentiment: technical,
      portfolioSentiment: portfolio,
      lastUpdated: new Date().toISOString(),
    };
  }

  private getLabel(score: number): string {
    if (score >= 80) return "Estrema Avidità";
    if (score >= 60) return "Avidità";
    if (score >= 40) return "Neutrale";
    if (score >= 20) return "Paura";
    return "Estrema Paura";
  }

  private getClassification(score: number): string {
    if (score >= 80) return "very_bullish";
    if (score >= 60) return "bullish";
    if (score >= 40) return "neutral";
    if (score >= 20) return "bearish";
    return "very_bearish";
  }
}
