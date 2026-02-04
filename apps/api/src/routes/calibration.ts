import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PortfolioService } from "../services/portfolio.js";

const calibrateSchema = z.object({
  referenceValue: z.number().positive(),
  portfolioId: z.string().optional(),
});

export async function calibrationRoutes(fastify: FastifyInstance) {
  // POST /api/calibration/set-reference - Set reference portfolio value and auto-calculate adjustment factor
  fastify.post("/api/calibration/set-reference", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const parsed = calibrateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", details: parsed.error });
    }

    const { referenceValue, portfolioId } = parsed.data;

    // Get user's portfolio (use first portfolio if not specified)
    const portfolio = portfolioId
      ? await fastify.prisma.portfolio.findFirst({
          where: { id: portfolioId, userId: request.user.id },
        })
      : await fastify.prisma.portfolio.findFirst({
          where: { userId: request.user.id },
          orderBy: { createdAt: "asc" },
        });

    if (!portfolio) {
      return reply.status(404).send({ error: "Portfolio not found" });
    }

    // Calculate current portfolio value WITHOUT adjustment factor
    const portfolioService = new PortfolioService(fastify);

    // Temporarily set factor to 1.0 to get raw value
    await fastify.prisma.userSettings.upsert({
      where: { userId: request.user.id },
      create: {
        userId: request.user.id,
        eurPriceAdjustmentFactor: 1.0,
      },
      update: {
        eurPriceAdjustmentFactor: 1.0,
      },
    });

    const performance = await portfolioService.calculatePerformance(portfolio.id);
    const currentValue = performance.totalValueEur;

    // Calculate adjustment factor
    const adjustmentFactor = referenceValue / currentValue;

    fastify.log.info({
      referenceValue,
      currentValue,
      adjustmentFactor,
    }, "Calculated EUR price adjustment factor");

    // Update settings with calibration data
    const settings = await fastify.prisma.userSettings.upsert({
      where: { userId: request.user.id },
      create: {
        userId: request.user.id,
        referencePortfolioValue: referenceValue,
        eurPriceAdjustmentFactor: adjustmentFactor,
        lastCalibrationAt: new Date(),
      },
      update: {
        referencePortfolioValue: referenceValue,
        eurPriceAdjustmentFactor: adjustmentFactor,
        lastCalibrationAt: new Date(),
      },
    });

    return {
      message: "Calibration completed successfully",
      referenceValue,
      calculatedValue: currentValue,
      adjustmentFactor,
      adjustmentPercent: ((adjustmentFactor - 1) * 100).toFixed(2) + "%",
      lastCalibrationAt: settings.lastCalibrationAt,
    };
  });

  // GET /api/calibration/status - Get current calibration status
  fastify.get("/api/calibration/status", {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    const settings = await fastify.prisma.userSettings.findUnique({
      where: { userId: request.user.id },
    });

    if (!settings) {
      return {
        calibrated: false,
        adjustmentFactor: 1.0,
        adjustmentPercent: "0%",
      };
    }

    return {
      calibrated: settings.referencePortfolioValue !== null,
      referenceValue: settings.referencePortfolioValue,
      adjustmentFactor: settings.eurPriceAdjustmentFactor,
      adjustmentPercent: ((settings.eurPriceAdjustmentFactor - 1) * 100).toFixed(2) + "%",
      lastCalibrationAt: settings.lastCalibrationAt,
    };
  });

  // DELETE /api/calibration/reset - Reset calibration to default (1.0)
  fastify.delete("/api/calibration/reset", {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    await fastify.prisma.userSettings.update({
      where: { userId: request.user.id },
      data: {
        referencePortfolioValue: null,
        eurPriceAdjustmentFactor: 1.0,
        lastCalibrationAt: null,
      },
    });

    return {
      message: "Calibration reset successfully",
      adjustmentFactor: 1.0,
    };
  });
}
