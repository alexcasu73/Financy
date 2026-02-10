import { FastifyInstance } from "fastify";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().min(10).max(1000),
});

export async function advisorRoutes(fastify: FastifyInstance) {
  // Protect all routes
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /api/advisor/search - Search for investment suggestions based on free text
  fastify.post("/api/advisor/search", async (request, reply) => {
    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation error",
        message: "La query deve essere tra 10 e 1000 caratteri",
      });
    }

    const { query } = parsed.data;

    try {
      // Call n8n workflow for AI-powered investment search
      const n8nUrl = process.env.N8N_WEBHOOK_URL || "http://localhost:5678";
      const webhookPath = "/webhook/advisor-search";

      fastify.log.info({ query, userId: request.user.id }, "Calling n8n advisor search workflow");

      const response = await fetch(`${n8nUrl}${webhookPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: request.user.id,
          query,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        fastify.log.error(
          { status: response.status, statusText: response.statusText },
          "n8n workflow call failed"
        );
        return reply.status(500).send({
          error: "Workflow error",
          message: "Errore durante l'elaborazione della ricerca",
        });
      }

      const result = await response.json();
      fastify.log.info({ result }, "n8n workflow response received");

      // Transform n8n response to our format
      const suggestions = (result.suggestions || []).map((s: any) => ({
        id: s.id || s.assetId || `${s.symbol}-${Date.now()}`,
        symbol: s.symbol,
        name: s.name,
        currentPrice: s.currentPrice || s.price || 0,
        currency: s.currency || "EUR",
        type: s.type || "STOCK",
        sector: s.sector || "N/A",
        exchange: s.exchange || "N/A",
        reason: s.reason || s.analysis || "Match trovato in base alla tua ricerca",
        score: s.score || s.confidence || 0,
        expectedReturn: s.expectedReturn,
        riskLevel: s.riskLevel || s.risk,
        timeHorizon: s.timeHorizon || s.horizon,
      }));

      return {
        suggestions,
        query,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      fastify.log.error({ err }, "Error in advisor search");
      return reply.status(500).send({
        error: "Internal server error",
        message: err.message || "Errore durante la ricerca degli investimenti",
      });
    }
  });
}
