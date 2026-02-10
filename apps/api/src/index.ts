import Fastify from "fastify";
import { loadEnv } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";
import corsPlugin from "./plugins/cors.js";
import authPlugin from "./plugins/auth.js";
import websocketPlugin from "./plugins/websocket.js";
import { authRoutes } from "./routes/auth.js";
import { assetRoutes } from "./routes/assets.js";
import { priceRoutes } from "./routes/prices.js";
import { portfolioRoutes } from "./routes/portfolios.js";
import { holdingRoutes } from "./routes/holdings.js";
import { alertRoutes } from "./routes/alerts.js";
import { analysisRoutes } from "./routes/analysis.js";
import { newsRoutes } from "./routes/news.js";
import { indicatorRoutes } from "./routes/indicators.js";
import { watchlistRoutes } from "./routes/watchlists.js";
import { notificationRoutes } from "./routes/notifications.js";
import { alertSuggestionRoutes } from "./routes/alert-suggestions.js";
import { settingsRoutes } from "./routes/settings.js";
import { sentimentRoutes } from "./routes/sentiment.js";
import { tradingRoutes } from "./routes/trading.js";
import { internalRoutes } from "./routes/internal.js";
import { calibrationRoutes } from "./routes/calibration.js";
import { advisorRoutes } from "./routes/advisor.js";
import { getLoggerConfig } from "./utils/logger.js";
import { MarketDataService } from "./services/market-data.js";
import { AlertService } from "./services/alerts.js";
import { SchedulerService } from "./services/scheduler.js";

async function main() {
  const env = loadEnv();

  const fastify = Fastify({
    logger: getLoggerConfig(),
  });

  // Add content-type parsers for n8n compatibility (sends JSON without correct content-type)
  fastify.addContentTypeParser("text/plain", { parseAs: "string" }, (req, body, done) => {
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch {
      done(null, body);
    }
  });

  fastify.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (req, body, done) => {
    try {
      const json = JSON.parse((body as Buffer).toString("utf-8"));
      done(null, json);
    } catch {
      done(null, body);
    }
  });

  // Plugins
  await fastify.register(corsPlugin);
  await fastify.register(authPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(websocketPlugin);

  // Routes
  await fastify.register(authRoutes);
  await fastify.register(assetRoutes);
  await fastify.register(priceRoutes);
  await fastify.register(portfolioRoutes);
  await fastify.register(holdingRoutes);
  await fastify.register(alertRoutes);
  await fastify.register(analysisRoutes);
  await fastify.register(newsRoutes);
  await fastify.register(indicatorRoutes);
  await fastify.register(watchlistRoutes);
  await fastify.register(notificationRoutes);
  await fastify.register(alertSuggestionRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(sentimentRoutes);
  await fastify.register(tradingRoutes);
  await fastify.register(internalRoutes);
  await fastify.register(calibrationRoutes);
  await fastify.register(advisorRoutes);

  // Health check
  fastify.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  try {
    await fastify.listen({ port: env.API_PORT, host: "0.0.0.0" });
    fastify.log.info(`Server running on http://localhost:${env.API_PORT}`);

    // Price refresh scheduler
    const marketData = new MarketDataService(fastify);
    const alertService = new AlertService(fastify);

    const runCryptoRefresh = () => {
      marketData.refreshCryptoPrices().then((r) => {
        fastify.log.info(`Crypto refresh: ${r.updated} updated`);
        return alertService.evaluateAlerts();
      }).then(() => {
        fastify.log.info("Alert evaluation after crypto refresh completed");
      }).catch((err) => fastify.log.error(err, "Crypto refresh/alert evaluation failed"));
    };

    const runStockRefresh = () => {
      marketData.refreshStockPrices().then((r) => {
        fastify.log.info(`Stock refresh: ${r.updated} updated`);
        if (r.errors.length > 0) fastify.log.warn({ errors: r.errors }, "Stock refresh errors");
        return alertService.evaluateAlerts();
      }).then(() => {
        fastify.log.info("Alert evaluation after stock refresh completed");
      }).catch((err) => fastify.log.error(err, "Stock refresh/alert evaluation failed"));
    };

    // Initial refresh on startup
    fastify.log.info("Starting initial price refresh...");
    runCryptoRefresh();
    runStockRefresh();

    // Crypto: refresh every 2 minutes (CoinGecko = 1 batch call, well within 30 req/min)
    const cryptoInterval = setInterval(runCryptoRefresh, 2 * 60 * 1000);

    // Stocks: refresh every 1 minute (Yahoo Finance = free, real-time, no daily limit)
    const stockInterval = setInterval(runStockRefresh, 1 * 60 * 1000);

    fastify.log.info("Price refresh scheduled: crypto every 2min, stocks every 1min");

    // Trading scheduler (analysis & suggestions based on user settings)
    const scheduler = new SchedulerService(fastify);
    scheduler.start();

    // Cleanup on shutdown
    const cleanup = () => {
      clearInterval(cryptoInterval);
      clearInterval(stockInterval);
      scheduler.stop();
      fastify.close();
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
