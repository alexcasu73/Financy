import { FastifyInstance } from "fastify";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "http://127.0.0.1:5678/webhook";

export class SchedulerService {
  private fastify: FastifyInstance;
  private analysisTimer: NodeJS.Timeout | null = null;
  private suggestionTimer: NodeJS.Timeout | null = null;
  private alertSuggestionTimer: NodeJS.Timeout | null = null;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  start() {
    // Check every 5 minutes for users who need analysis/suggestions
    this.analysisTimer = setInterval(() => this.runAnalysisCheck(), 5 * 60 * 1000);
    this.suggestionTimer = setInterval(() => this.runSuggestionCheck(), 5 * 60 * 1000);
    this.alertSuggestionTimer = setInterval(() => this.runAlertSuggestionCheck(), 5 * 60 * 1000);

    this.fastify.log.info("Scheduler service started - checking every 5 minutes");

    // Run initial check after 1 minute
    setTimeout(() => {
      this.runAnalysisCheck();
      this.runSuggestionCheck();
      this.runAlertSuggestionCheck();
    }, 60 * 1000);
  }

  stop() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
    if (this.suggestionTimer) {
      clearInterval(this.suggestionTimer);
      this.suggestionTimer = null;
    }
    if (this.alertSuggestionTimer) {
      clearInterval(this.alertSuggestionTimer);
      this.alertSuggestionTimer = null;
    }
    this.fastify.log.info("Scheduler service stopped");
  }

  private async runAnalysisCheck() {
    try {
      // Find profiles that need analysis
      const profiles = await this.fastify.prisma.tradingProfile.findMany({
        where: {
          analysisInterval: { gt: 0 }, // Only if interval is set
        },
        include: {
          tradingAssets: {
            where: {
              status: { in: ["watching", "bought"] },
            },
          },
        },
      });

      const now = new Date();

      for (const profile of profiles) {
        // Skip if no active assets
        if (profile.tradingAssets.length === 0) continue;

        // Check if enough time has passed since last analysis
        const lastAnalysis = profile.lastAnalysisAt;
        const intervalMs = profile.analysisInterval * 60 * 1000;

        if (!lastAnalysis || (now.getTime() - lastAnalysis.getTime()) >= intervalMs) {
          this.fastify.log.info(`Running scheduled analysis for user ${profile.userId}`);
          await this.triggerAnalysis(profile.userId, profile.id);
        }
      }
    } catch (error) {
      this.fastify.log.error(error, "Error in analysis scheduler");
    }
  }

  private async runSuggestionCheck() {
    try {
      // Find profiles that need suggestions
      const profiles = await this.fastify.prisma.tradingProfile.findMany({
        where: {
          suggestionInterval: { gt: 0 }, // Only if interval is set
        },
      });

      const now = new Date();

      for (const profile of profiles) {
        // Check if enough time has passed since last suggestion generation
        const lastSuggestion = profile.lastSuggestionAt;
        const intervalMs = profile.suggestionInterval * 60 * 1000;

        if (!lastSuggestion || (now.getTime() - lastSuggestion.getTime()) >= intervalMs) {
          this.fastify.log.info(`Running scheduled suggestions for user ${profile.userId}`);
          await this.triggerSuggestions(profile.userId, profile.id);
        }
      }
    } catch (error) {
      this.fastify.log.error(error, "Error in suggestion scheduler");
    }
  }

  private async triggerAnalysis(userId: string, profileId: string) {
    try {
      const response = await fetch(`${N8N_WEBHOOK_URL}/analyze-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // Update last analysis timestamp
        await this.fastify.prisma.tradingProfile.update({
          where: { id: profileId },
          data: { lastAnalysisAt: new Date() },
        });
        this.fastify.log.info(`Analysis completed for user ${userId}`);
      } else {
        this.fastify.log.warn(`Analysis failed for user ${userId}: ${response.status}`);
      }
    } catch (error) {
      this.fastify.log.error(error, `Failed to trigger analysis for user ${userId}`);
    }
  }

  private async triggerSuggestions(userId: string, profileId: string) {
    try {
      const response = await fetch(`${N8N_WEBHOOK_URL}/trading-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // Update last suggestion timestamp
        await this.fastify.prisma.tradingProfile.update({
          where: { id: profileId },
          data: { lastSuggestionAt: new Date() },
        });
        this.fastify.log.info(`Suggestions generated for user ${userId}`);
      } else {
        this.fastify.log.warn(`Suggestions failed for user ${userId}: ${response.status}`);
      }
    } catch (error) {
      this.fastify.log.error(error, `Failed to trigger suggestions for user ${userId}`);
    }
  }

  private async runAlertSuggestionCheck() {
    try {
      // Find user settings that need alert suggestions
      const settings = await this.fastify.prisma.userSettings.findMany({
        where: {
          alertSuggestionInterval: { gt: 0 }, // Only if interval is set
        },
      });

      const now = new Date();

      for (const setting of settings) {
        // Check if enough time has passed since last alert suggestion generation
        const lastAlertSuggestion = setting.lastAlertSuggestionAt;
        const intervalMs = setting.alertSuggestionInterval * 60 * 1000;

        if (!lastAlertSuggestion || (now.getTime() - lastAlertSuggestion.getTime()) >= intervalMs) {
          this.fastify.log.info(`Running scheduled alert suggestions for user ${setting.userId}`);
          await this.triggerAlertSuggestions(setting.userId, setting.id);
        }
      }
    } catch (error) {
      this.fastify.log.error(error, "Error in alert suggestion scheduler");
    }
  }

  private async triggerAlertSuggestions(userId: string, settingsId: string) {
    try {
      const response = await fetch(`${N8N_WEBHOOK_URL}/alert-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // Update last alert suggestion timestamp
        await this.fastify.prisma.userSettings.update({
          where: { id: settingsId },
          data: { lastAlertSuggestionAt: new Date() },
        });
        this.fastify.log.info(`Alert suggestions generated for user ${userId}`);
      } else {
        this.fastify.log.warn(`Alert suggestions failed for user ${userId}: ${response.status}`);
      }
    } catch (error) {
      this.fastify.log.error(error, `Failed to trigger alert suggestions for user ${userId}`);
    }
  }
}
