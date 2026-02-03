import TelegramBot from "node-telegram-bot-api";
import { FastifyInstance } from "fastify";

export class TelegramService {
  private bot: TelegramBot | null = null;

  constructor(private fastify: FastifyInstance) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        this.bot = new TelegramBot(token, { polling: false });
        this.fastify.log.info("Telegram bot initialized");
      } catch (error) {
        this.fastify.log.error(error, "Failed to initialize Telegram bot");
      }
    } else {
      this.fastify.log.warn("TELEGRAM_BOT_TOKEN not configured");
    }
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: string, message: string): Promise<boolean> {
    if (!this.bot) {
      this.fastify.log.warn("Telegram bot not initialized");
      return false;
    }

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      this.fastify.log.info({ chatId }, "Telegram message sent");
      return true;
    } catch (error: any) {
      this.fastify.log.error(error, "Failed to send Telegram message");
      return false;
    }
  }

  /**
   * Get bot info (for verification)
   */
  async getBotInfo(): Promise<any> {
    if (!this.bot) {
      return null;
    }

    try {
      return await this.bot.getMe();
    } catch (error) {
      this.fastify.log.error(error, "Failed to get bot info");
      return null;
    }
  }

  /**
   * Get updates to help user find their chat ID
   */
  async getUpdates(): Promise<any[]> {
    if (!this.bot) {
      return [];
    }

    try {
      return await this.bot.getUpdates();
    } catch (error) {
      this.fastify.log.error(error, "Failed to get updates");
      return [];
    }
  }
}
