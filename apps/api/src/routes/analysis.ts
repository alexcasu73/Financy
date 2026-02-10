import { FastifyInstance } from "fastify";
import { z } from "zod";

const preferencesSchema = z.object({
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  timeHorizon: z.enum(["short", "medium", "long"]),
  goals: z.enum(["growth", "income", "preservation"]),
  preferredSectors: z.array(z.string()),
  baseCurrency: z.enum(["EUR", "USD"]),
});

const requestSchema = z.object({
  type: z.enum([
    "portfolio_digest",
    "market_overview",
    "asset_deep_dive",
  ]),
  assetId: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  preferences: preferencesSchema.optional(),
});

export async function analysisRoutes(fastify: FastifyInstance) {
  // n8n webhook URL
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || "http://localhost:5678";

  // Internal endpoint for n8n workflow to save analysis (NO AUTH - uses internal key)
  const saveAnalysisSchema = z.object({
    type: z.string(),
    title: z.string(),
    summary: z.string(),
    content: z.string(),
    sentiment: z.string().optional(),
    recommendations: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  fastify.post("/api/analysis/save", async (request, reply) => {
    // Verify internal API key
    const internalKey = request.headers["x-internal-key"];
    if (internalKey !== (process.env.INTERNAL_API_KEY || "financy-internal-key")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parsed = saveAnalysisSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Validation error", message: parsed.error.message });
    }

    const { type, title, summary, content, sentiment, recommendations, metadata } =
      parsed.data;

    const analysis = await fastify.prisma.analysis.create({
      data: {
        type,
        title,
        summary,
        content,
        sentiment: sentiment || "neutral",
        metadata: {
          ...(metadata || {}),
          recommendations: recommendations || [],
        },
      },
    });

    return reply.status(201).send({
      ...analysis,
      recommendations: recommendations || [],
    });
  });

  // Protect all other routes (except /api/analysis/save which uses internal key)
  fastify.addHook("onRequest", async (request, reply) => {
    // Skip auth for internal n8n endpoint
    if (request.url.startsWith("/api/analysis/save")) {
      return;
    }
    await fastify.authenticate(request, reply);
  });

  fastify.get("/api/analysis", async () => {
    const analyses = await fastify.prisma.analysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    // Extract recommendations from metadata for frontend compatibility
    return analyses.map((a) => ({
      ...a,
      recommendations: (a.metadata as any)?.recommendations || [],
    }));
  });

  fastify.get("/api/analysis/latest", async () => {
    const latest = await fastify.prisma.analysis.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!latest) return null;
    return {
      ...latest,
      recommendations: (latest.metadata as any)?.recommendations || [],
    };
  });

  // DELETE /api/analysis/:id - elimina un'analisi
  fastify.delete("/api/analysis/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await fastify.prisma.analysis.delete({
        where: { id },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({ error: "Not Found", message: "Analysis not found" });
    }
  });

  // Main analysis request endpoint - ALL types go through n8n
  fastify.post("/api/analysis/request", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Validation error", message: parsed.error.message });
    }

    const { type, assetId, assetIds, preferences } = parsed.data;
    const user = request.user;

    // Validation for asset_deep_dive
    if (type === "asset_deep_dive" && !assetId && !assetIds?.length) {
      return reply.status(400).send({
        error: "Missing Asset",
        message: "assetId is required for asset_deep_dive analysis",
      });
    }

    // Default preferences
    const userPreferences = preferences || {
      riskTolerance: "moderate",
      timeHorizon: "medium",
      goals: "growth",
      preferredSectors: [],
      baseCurrency: "EUR",
    };

    // Call n8n webhook for ALL analysis types
    fastify.log.info(`Calling n8n generate-analysis for type: ${type}, user: ${user.id}`);

    const response = await fetch(`${n8nWebhookUrl}/webhook/generate-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        userId: user.id,
        assetId: assetId || assetIds?.[0],
        preferences: userPreferences,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      fastify.log.error({ status: response.status, body: errorText }, "n8n webhook failed");
      return reply.status(503).send({
        error: "Service Unavailable",
        message: "Servizio di analisi AI non disponibile",
      });
    }

    const result = await response.json() as { success?: boolean; analysis?: any };

    // n8n returns { success: true, analysis: {...} }
    if (result.success && result.analysis) {
      return reply.status(201).send(result.analysis);
    }

    // If n8n returns the analysis directly
    return reply.status(201).send(result);
  });
}
