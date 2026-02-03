import { FastifyInstance } from "fastify";
import { SentimentService } from "../services/sentiment.js";

export async function sentimentRoutes(fastify: FastifyInstance) {
  const sentimentService = new SentimentService(fastify);

  // GET /api/sentiment - Get aggregated market sentiment
  fastify.get("/api/sentiment", {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    const user = request.user;
    return sentimentService.getAggregatedSentiment(user.id);
  });

  // GET /api/sentiment/fear-greed - Get Fear & Greed Index only
  fastify.get("/api/sentiment/fear-greed", async () => {
    return sentimentService.getFearGreedIndex();
  });
}
