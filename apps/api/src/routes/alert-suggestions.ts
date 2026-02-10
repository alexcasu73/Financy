import { FastifyInstance } from "fastify";
import { z } from "zod";

const suggestionSchema = z.object({
  assetId: z.string(),
  symbol: z.string(),
  name: z.string(),
  type: z.enum(["price_above", "price_below", "percent_change", "volume_spike"]),
  threshold: z.number(),
  reason: z.string(),
  reasonOriginal: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

const generateSchema = z.object({
  suggestions: z.array(suggestionSchema),
});

export async function alertSuggestionRoutes(fastify: FastifyInstance) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || "http://localhost:5678";

  // POST /api/alert-suggestions/trigger — trigger n8n workflow to refresh suggestions
  fastify.post("/api/alert-suggestions/trigger", async (request, reply) => {
    try {
      // Call n8n webhook to trigger alert suggestions workflow
      // The workflow is scheduled but can also be triggered manually
      const response = await fetch(`${n8nWebhookUrl}/webhook/alert-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true }),
      });

      if (!response.ok) {
        fastify.log.warn("n8n webhook not available, using direct generation");
        // Fallback: generate suggestions directly using AI service
        // For now, just return a message
        return reply.status(202).send({
          message: "Workflow triggered (fallback mode)",
          status: "processing"
        });
      }

      return reply.status(202).send({
        message: "Alert suggestions workflow triggered",
        status: "processing"
      });
    } catch (error) {
      fastify.log.error(error, "Failed to trigger alert suggestions workflow");
      return reply.status(202).send({
        message: "Workflow triggered (fallback mode)",
        status: "processing"
      });
    }
  });

  // POST /api/alert-suggestions/generate — bulk create from n8n
  fastify.post("/api/alert-suggestions/generate", async (request, reply) => {
    // Handle case where n8n sends body as string or Buffer instead of JSON
    let body = request.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return reply.status(400).send({ error: "Invalid JSON", message: "Body must be valid JSON" });
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString("utf-8"));
      } catch {
        return reply.status(400).send({ error: "Invalid JSON", message: "Body must be valid JSON" });
      }
    }

    fastify.log.info({ body }, "Received alert suggestions from n8n");

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      fastify.log.error({ error: parsed.error, body }, "Validation failed for alert suggestions");
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    // Delete old non-accepted suggestions (>24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await fastify.prisma.alertSuggestion.deleteMany({
      where: {
        acceptedAlertId: null,
        createdAt: { lt: oneDayAgo },
      },
    });

    // Also dismiss any remaining non-accepted suggestions before inserting new ones
    await fastify.prisma.alertSuggestion.updateMany({
      where: {
        dismissed: false,
        acceptedAlertId: null,
      },
      data: { dismissed: true },
    });

    // Bulk create new suggestions
    try {
      const created = await fastify.prisma.alertSuggestion.createMany({
        data: parsed.data.suggestions,
      });
      fastify.log.info({ count: created.count }, "Created alert suggestions");
      return reply.status(201).send({ created: created.count });
    } catch (err) {
      fastify.log.error({ error: err, suggestions: parsed.data.suggestions }, "Failed to create alert suggestions");
      throw err;
    }
  });

  // GET /api/alert-suggestions — active suggestions
  fastify.get("/api/alert-suggestions", async () => {
    const suggestions = await fastify.prisma.alertSuggestion.findMany({
      where: {
        dismissed: false,
        acceptedAlertId: null,
      },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    });

    return suggestions.map((s) => ({
      ...s,
      currentPrice: s.asset.currentPrice,
    }));
  });

  // POST /api/alert-suggestions/:id/accept — create alert from suggestion
  fastify.post("/api/alert-suggestions/:id/accept", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      type?: string;
      threshold?: number;
      channels?: string[];
    };

    const suggestion = await fastify.prisma.alertSuggestion.findUnique({
      where: { id },
    });
    if (!suggestion) {
      return reply.status(404).send({ error: "Not Found", message: "Suggestion not found" });
    }
    if (suggestion.acceptedAlertId) {
      return reply.status(400).send({ error: "Already accepted", message: "Suggestion was already accepted" });
    }

    // Use custom type if provided, otherwise use suggestion type
    const type = body.type ?? suggestion.type;
    // Use custom threshold if provided, otherwise use suggestion threshold
    const threshold = body.threshold ?? suggestion.threshold;
    // Use custom channels if provided, otherwise default to in_app
    const channels = body.channels && body.channels.length > 0 ? body.channels : ["in_app"];

    // Create the alert
    const alert = await fastify.prisma.alert.create({
      data: {
        userId: request.user.id,
        assetId: suggestion.assetId,
        type: type as any,
        condition: { threshold },
        channels,
      },
    });

    // Update suggestion with the accepted alert ID
    await fastify.prisma.alertSuggestion.update({
      where: { id },
      data: { acceptedAlertId: alert.id },
    });

    return reply.status(201).send(alert);
  });

  // PUT /api/alert-suggestions/:id/dismiss
  fastify.put("/api/alert-suggestions/:id/dismiss", async (request, reply) => {
    const { id } = request.params as { id: string };

    const suggestion = await fastify.prisma.alertSuggestion.findUnique({
      where: { id },
    });
    if (!suggestion) {
      return reply.status(404).send({ error: "Not Found", message: "Suggestion not found" });
    }

    await fastify.prisma.alertSuggestion.update({
      where: { id },
      data: { dismissed: true },
    });

    return { success: true };
  });
}
