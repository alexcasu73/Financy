import { FastifyInstance } from "fastify";

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl?: string;
  publishedAt: string;
}

export class NewsService {
  constructor(private fastify: FastifyInstance) {}

  private async cacheGet(key: string): Promise<string | null> {
    if (!this.fastify.redis) return null;
    try {
      return await this.fastify.redis.get(key);
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, ttl: number, value: string): Promise<void> {
    if (!this.fastify.redis) return;
    try {
      await this.fastify.redis.setex(key, ttl, value);
    } catch {
      // Ignore cache errors
    }
  }

  async getFinancialNews(query?: string): Promise<NewsArticle[]> {
    const cacheKey = `news:${query || "general"}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      this.fastify.log.warn("NEWS_API_KEY not configured");
      return [];
    }

    try {
      const q = query || "finance stock market cryptocurrency";
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`
      );
      const data = await res.json();

      const articles: NewsArticle[] = (data.articles || []).map(
        (a: any) => ({
          title: a.title,
          summary: a.description || "",
          url: a.url,
          source: a.source?.name || "Unknown",
          imageUrl: a.urlToImage,
          publishedAt: a.publishedAt,
        })
      );

      await this.cacheSet(cacheKey, 900, JSON.stringify(articles));
      return articles;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch news");
      return [];
    }
  }

  async getAssetNews(symbol: string): Promise<NewsArticle[]> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      this.fastify.log.warn("FINNHUB_API_KEY not configured");
      return [];
    }

    try {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const to = now.toISOString().split("T")[0];

      const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`
      );
      const data = await res.json();

      return (data || []).slice(0, 20).map((a: any) => ({
        title: a.headline,
        summary: a.summary,
        url: a.url,
        source: a.source,
        imageUrl: a.image,
        publishedAt: new Date(a.datetime * 1000).toISOString(),
      }));
    } catch (error) {
      this.fastify.log.error(error, `Failed to fetch news for ${symbol}`);
      return [];
    }
  }
}
