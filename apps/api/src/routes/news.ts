import { FastifyInstance } from "fastify";
import { NewsService } from "../services/news.js";
import { translateToItalian } from "../services/translation.js";

export async function newsRoutes(fastify: FastifyInstance) {
  const newsService = new NewsService(fastify);
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || "http://127.0.0.1:5678/webhook";

  // POST /api/news/trigger - trigger n8n workflow
  fastify.post("/api/news/trigger", async (request, reply) => {
    try {
      const response = await fetch(`${n8nWebhookUrl}/import-news`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error({ status: response.status, body: errorText }, "n8n webhook failed");
        return reply.status(502).send({ error: "n8n workflow failed", details: errorText });
      }

      const result = await response.json();
      return { success: true, ...result };
    } catch (error) {
      fastify.log.error(error, "Failed to trigger n8n news workflow");
      return reply.status(500).send({ error: "Failed to trigger workflow" });
    }
  });

  fastify.get("/api/news", async (request) => {
    const { query } = request.query as { query?: string };

    // Try database first
    const dbNews = await fastify.prisma.newsItem.findMany({
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: { relatedAssets: { include: { asset: true } } },
    });

    if (dbNews.length > 0) {
      return dbNews.map((n) => ({
        id: n.id,
        title: n.title,
        titleOriginal: n.titleOriginal,
        summary: n.summary,
        summaryOriginal: n.summaryOriginal,
        url: n.url,
        source: n.source,
        imageUrl: n.imageUrl,
        sentiment: n.sentiment,
        publishedAt: n.publishedAt,
        relatedAssets: n.relatedAssets.map((ra) => ra.asset.symbol),
      }));
    }

    // Fallback to external API (English only)
    const externalNews = await newsService.getFinancialNews(query);

    // Return with original fields (both same since not translated)
    return externalNews.map((n) => ({
      ...n,
      titleOriginal: n.title,
      summaryOriginal: n.summary,
    }));
  });

  // POST /api/news/fetch - Internal endpoint used by n8n workflow
  fastify.post("/api/news/fetch", async (request, reply) => {
    const { query } = request.body as { query?: string };

    try {
      const externalNews = await newsService.getFinancialNews(query);

      if (externalNews.length === 0) {
        return reply.send({ imported: 0, message: "No news found" });
      }

      // Translate to Italian
      const textsToTranslate = externalNews.map((n) => ({
        title: n.title,
        summary: n.summary,
      }));

      fastify.log.info(`Translating ${textsToTranslate.length} news items...`);
      const translations = await translateToItalian(textsToTranslate);

      // Save to database
      let imported = 0;
      for (let i = 0; i < externalNews.length; i++) {
        const news = externalNews[i];
        const translation = translations[i];

        try {
          await fastify.prisma.newsItem.upsert({
            where: { url: news.url },
            update: {
              title: translation.title,
              titleOriginal: news.title,
              summary: translation.summary,
              summaryOriginal: news.summary,
              sentiment: null,
            },
            create: {
              title: translation.title,
              titleOriginal: news.title,
              summary: translation.summary,
              summaryOriginal: news.summary,
              url: news.url,
              source: news.source,
              imageUrl: news.imageUrl,
              sentiment: null,
              publishedAt: new Date(news.publishedAt),
            },
          });
          imported++;
        } catch (err) {
          fastify.log.warn({ url: news.url }, "Failed to import news item");
        }
      }

      return reply.send({ imported, total: externalNews.length });
    } catch (error) {
      fastify.log.error(error, "Failed to fetch and translate news");
      return reply.status(500).send({ error: "Failed to fetch news" });
    }
  });
}
