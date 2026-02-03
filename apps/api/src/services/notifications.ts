import { FastifyInstance } from "fastify";

export class NotificationService {
  constructor(private fastify: FastifyInstance) {}

  async sendTelegram(userId: string, message: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      this.fastify.log.warn("TELEGRAM_BOT_TOKEN not configured");
      return false;
    }

    try {
      // Get user's Telegram chat ID from settings
      const settings = await this.fastify.prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings?.telegramChatId || !settings?.telegramEnabled) {
        this.fastify.log.debug({ userId }, "Telegram not enabled for user");
        return false;
      }

      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: message,
            parse_mode: "Markdown",
          }),
        }
      );

      if (res.ok) {
        this.fastify.log.info({ userId }, "Telegram notification sent");
        return true;
      } else {
        const error = await res.text();
        this.fastify.log.error({ userId, error }, "Telegram API error");
        return false;
      }
    } catch (error) {
      this.fastify.log.error(error, "Failed to send Telegram notification");
      return false;
    }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    this.fastify.log.info({ to, subject }, "Email notification (not configured)");
    return false;
  }

  async sendInApp(
    userId: string,
    title: string,
    message: string,
    type: string = "alert",
    data?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      let notification;
      const alertId = data?.alertId as string | undefined;

      // If this is an alert notification, upsert (replace existing for same alert)
      if (alertId) {
        // Find existing notification for this alert
        const existing = await this.fastify.prisma.notification.findFirst({
          where: {
            userId,
            type,
            data: {
              path: ["alertId"],
              equals: alertId,
            },
          },
        });

        if (existing) {
          // Update existing notification
          notification = await this.fastify.prisma.notification.update({
            where: { id: existing.id },
            data: {
              title,
              message,
              data: data || {},
              read: false, // Mark as unread again
              dismissed: false,
              createdAt: new Date(), // Update timestamp
            },
          });
          this.fastify.log.info({ alertId, notificationId: notification.id }, "Notification updated (replaced)");
        } else {
          // Create new notification
          notification = await this.fastify.prisma.notification.create({
            data: {
              userId,
              type,
              title,
              message,
              data: data || {},
            },
          });
          this.fastify.log.info({ alertId, notificationId: notification.id }, "Notification created");
        }
      } else {
        // Non-alert notification: always create new
        notification = await this.fastify.prisma.notification.create({
          data: {
            userId,
            type,
            title,
            message,
            data: data || {},
          },
        });
        this.fastify.log.info({ notificationId: notification.id }, "Notification created");
      }

      // Emit WebSocket event to user
      this.emitToUser(userId, "notification", {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: notification.read,
        createdAt: notification.createdAt,
      });

      return true;
    } catch (error) {
      this.fastify.log.error(error, "Failed to create/update in-app notification");
      return false;
    }
  }

  private emitToUser(userId: string, event: string, data: unknown): void {
    try {
      if (this.fastify.io) {
        this.fastify.io.to(`user:${userId}`).emit(event, data);
        this.fastify.log.debug({ userId, event }, "WebSocket event emitted");
      }
    } catch (error) {
      this.fastify.log.error(error, "Failed to emit WebSocket event");
    }
  }

  async notify(
    userId: string,
    channels: string[],
    message: string,
    options?: { email?: string; title?: string; type?: string; data?: Record<string, unknown> }
  ): Promise<void> {
    const title = options?.title || "Notifica Financy";

    this.fastify.log.info({ userId, channels, title }, "notify() called");

    for (const channel of channels) {
      this.fastify.log.info({ userId, channel }, `Sending to channel: ${channel}`);
      switch (channel) {
        case "telegram":
          await this.sendTelegram(userId, message);
          break;
        case "email":
          if (options?.email) await this.sendEmail(options.email, title, message);
          break;
        case "in_app":
          await this.sendInApp(userId, title, message, options?.type || "alert", options?.data);
          break;
      }
    }
  }
}
