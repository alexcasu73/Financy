import { FastifyInstance } from "fastify";
import { z } from "zod";
import { TelegramService } from "../services/telegram";

const updateSettingsSchema = z.object({
  alertSuggestionThreshold: z.number().min(0.5).max(10).optional(),
  alertSuggestionInterval: z.number().min(0).max(1440).optional(), // 0 = disabled, max 24 hours
  sentimentRefreshInterval: z.number().min(0).max(60).optional(), // 0 = disabled, max 60 minutes
  telegramChatId: z.string().optional(),
  telegramEnabled: z.boolean().optional(),
});

export async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/settings/alert-threshold - public endpoint for n8n (no auth)
  // Must be registered BEFORE the auth hook
  fastify.get("/api/settings/alert-threshold", async () => {
    // Get the first user's settings as default for n8n workflow
    // In a multi-user scenario, this could be made more sophisticated
    const settings = await fastify.prisma.userSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });

    return { threshold: settings?.alertSuggestionThreshold ?? 3 };
  });

  // GET /api/settings - get user settings (protected)
  fastify.get("/api/settings", {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    // Use upsert to handle race conditions
    const settings = await fastify.prisma.userSettings.upsert({
      where: { userId: request.user.id },
      create: { userId: request.user.id },
      update: {},
    });

    return settings;
  });

  // PUT /api/settings - update user settings (protected)
  fastify.put("/api/settings", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    fastify.log.info({ body: request.body }, "PUT /api/settings received");

    const parsed = updateSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      fastify.log.error({ error: parsed.error }, "Validation error in PUT /api/settings");
      return reply.status(400).send({ error: "Validation error", message: parsed.error.message });
    }

    fastify.log.info({ data: parsed.data }, "Updating user settings");

    const settings = await fastify.prisma.userSettings.upsert({
      where: { userId: request.user.id },
      create: {
        userId: request.user.id,
        ...parsed.data,
      },
      update: parsed.data,
    });

    fastify.log.info({ settings }, "User settings updated");
    return settings;
  });

  // GET /api/settings/telegram/chat-id - Get user's Telegram chat ID from bot updates
  fastify.get("/api/settings/telegram/chat-id", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const telegramService = new TelegramService(fastify);

    try {
      const updates = await telegramService.getUpdates();

      if (updates.length === 0) {
        return reply.status(404).send({
          error: "No updates found",
          message: "Invia un messaggio al bot prima. Cerca @financy_alerts_bot su Telegram e invia /start",
        });
      }

      // Get the most recent message from the user
      const recentUpdate = updates[updates.length - 1];
      const chatId = recentUpdate.message?.chat?.id || recentUpdate.message?.from?.id;

      if (!chatId) {
        return reply.status(404).send({
          error: "No chat ID found",
          message: "Impossibile trovare il chat ID. Invia /start al bot su Telegram.",
        });
      }

      return {
        chatId: chatId.toString(),
        username: recentUpdate.message?.from?.username,
        firstName: recentUpdate.message?.from?.first_name,
      };
    } catch (error: any) {
      fastify.log.error(error, "Failed to get Telegram chat ID");
      return reply.status(500).send({
        error: "Failed to get chat ID",
        message: error.message || "Errore nel recupero del chat ID",
      });
    }
  });

  // POST /api/settings/telegram/test - Test Telegram notification
  fastify.post("/api/settings/telegram/test", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const settings = await fastify.prisma.userSettings.findUnique({
      where: { userId: request.user.id },
    });

    if (!settings?.telegramChatId || !settings?.telegramEnabled) {
      return reply.status(400).send({
        error: "Telegram not configured",
        message: "Configura prima il tuo Telegram Chat ID",
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return reply.status(500).send({
        error: "Bot not configured",
        message: "Il bot Telegram non è configurato sul server",
      });
    }

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: "🎉 *Test notifica Financy*\n\nLe notifiche Telegram funzionano correttamente!",
            parse_mode: "Markdown",
          }),
        }
      );

      if (res.ok) {
        return { success: true, message: "Notifica di test inviata!" };
      } else {
        const error = await res.text();
        return reply.status(500).send({
          error: "Failed to send test message",
          message: error,
        });
      }
    } catch (error: any) {
      fastify.log.error(error, "Failed to send test Telegram message");
      return reply.status(500).send({
        error: "Failed to send test message",
        message: error.message,
      });
    }
  });
}
