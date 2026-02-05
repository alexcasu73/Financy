import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PortfolioService } from "../services/portfolio.js";

const calibrateSchema = z.object({
  referenceValue: z.number().positive(),
  portfolioId: z.string().optional(),
});

const assetCalibrateSchema = z.object({
  assetId: z.string(),
  adjustmentFactor: z.number().positive().optional(),
  referencePrice: z.number().positive().optional(),
}).refine(
  (data) => data.adjustmentFactor !== undefined || data.referencePrice !== undefined,
  { message: "Either adjustmentFactor or referencePrice must be provided" }
);

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

  // POST /api/calibration/asset - Set calibration for a specific asset
  fastify.post("/api/calibration/asset", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const parsed = assetCalibrateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation error", details: parsed.error });
    }

    const { assetId, adjustmentFactor, referencePrice } = parsed.data;

    // Verify asset exists
    const asset = await fastify.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return reply.status(404).send({ error: "Asset not found" });
    }

    let finalAdjustmentFactor = adjustmentFactor;

    // If referencePrice provided, calculate adjustment factor
    if (referencePrice !== undefined) {
      const currentPrice = asset.currentPrice || 0;
      if (currentPrice === 0) {
        return reply.status(400).send({ error: "Asset has no current price" });
      }
      finalAdjustmentFactor = referencePrice / currentPrice;
    }

    // Upsert asset calibration
    const calibration = await fastify.prisma.assetCalibration.upsert({
      where: {
        userId_assetId: {
          userId: request.user.id,
          assetId,
        },
      },
      create: {
        userId: request.user.id,
        assetId,
        adjustmentFactor: finalAdjustmentFactor!,
        referencePrice,
      },
      update: {
        adjustmentFactor: finalAdjustmentFactor!,
        referencePrice,
      },
    });

    return {
      message: "Asset calibration set successfully",
      assetId,
      symbol: asset.symbol,
      name: asset.name,
      currentPrice: asset.currentPrice,
      referencePrice: calibration.referencePrice,
      adjustmentFactor: calibration.adjustmentFactor,
      adjustmentPercent: ((calibration.adjustmentFactor - 1) * 100).toFixed(2) + "%",
    };
  });

  // GET /api/calibration/assets - Get all asset calibrations
  fastify.get("/api/calibration/assets", {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    const calibrations = await fastify.prisma.assetCalibration.findMany({
      where: { userId: request.user.id },
      include: { asset: true },
      orderBy: { updatedAt: "desc" },
    });

    return {
      count: calibrations.length,
      calibrations: calibrations.map((c) => ({
        assetId: c.assetId,
        symbol: c.asset.symbol,
        name: c.asset.name,
        currentPrice: c.asset.currentPrice,
        referencePrice: c.referencePrice,
        adjustmentFactor: c.adjustmentFactor,
        adjustmentPercent: ((c.adjustmentFactor - 1) * 100).toFixed(2) + "%",
        updatedAt: c.updatedAt,
      })),
    };
  });

  // DELETE /api/calibration/asset/:assetId - Reset calibration for a specific asset
  fastify.delete("/api/calibration/asset/:assetId", {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { assetId } = request.params as { assetId: string };

    const deleted = await fastify.prisma.assetCalibration.deleteMany({
      where: { userId: request.user.id, assetId },
    });

    if (deleted.count === 0) {
      return reply.status(404).send({ error: "Asset calibration not found" });
    }

    return {
      message: "Asset calibration reset successfully",
      assetId,
    };
  });
}
