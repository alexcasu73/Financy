import { FastifyInstance } from "fastify";
import { NotificationService } from "./notifications";
import { MarketDataService } from "./market-data";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between notifications

export class AlertService {
  private notificationService: NotificationService;
  private marketData: MarketDataService;

  constructor(private fastify: FastifyInstance) {
    this.notificationService = new NotificationService(fastify);
    this.marketData = new MarketDataService(fastify);
  }

  async evaluateAlerts(): Promise<void> {
    const activeAlerts = await this.fastify.prisma.alert.findMany({
      where: { status: "active" },
      include: { asset: true },
    });

    // Get EUR conversion rates once for all alerts
    const eurRates = await this.marketData.getEurRates();
    const defaultRate = eurRates["USD"] || (await this.marketData.getUsdToEurRate());

    for (const alert of activeAlerts) {
      const currentPrice = alert.asset.currentPrice;
      if (!currentPrice) continue;

      // Convert current price to EUR
      const currency = alert.asset.currency || "USD";
      const eurRate = eurRates[currency] || defaultRate;
      const currentPriceEur = currency === "EUR" ? currentPrice : +(currentPrice * eurRate).toFixed(2);

      const condition = alert.condition as { threshold: number };
      const threshold = condition.threshold;

      // Check if alert condition is met (always compare in EUR)
      const isTriggered = this.checkCondition(alert.type, currentPriceEur, threshold, alert.asset);

      // If tracking, record the price
      if (alert.isTracking) {
        await this.recordPrice(alert.id, currentPriceEur, threshold);

        // Check if price returned to safe zone (stop tracking)
        if (!isTriggered) {
          await this.stopTracking(alert.id);
          this.fastify.log.info(`Alert ${alert.id}: price returned to safe zone, tracking stopped`);
        }
        continue; // Don't send new notification while tracking
      }

      // If not tracking and condition is triggered
      if (isTriggered) {
        // Check cooldown
        if (alert.lastTriggeredAt) {
          const elapsed = Date.now() - new Date(alert.lastTriggeredAt).getTime();
          if (elapsed < COOLDOWN_MS) continue;
        }

        const message = this.buildMessage(alert.type, alert.asset.symbol, currentPriceEur, threshold, alert.asset);
        const channels = (alert.channels || ["in_app"]) as string[];

        // Start tracking and record first price
        await this.fastify.prisma.$transaction([
          this.fastify.prisma.alert.update({
            where: { id: alert.id },
            data: {
              lastTriggeredAt: new Date(),
              triggerCount: { increment: 1 },
              isTracking: true,
              trackingStartedAt: new Date(),
            },
          }),
          this.fastify.prisma.alertHistory.create({
            data: {
              alertId: alert.id,
              priceAtTrigger: currentPriceEur,
              message,
              notified: channels.length > 0,
            },
          }),
          this.fastify.prisma.alertPriceTrack.create({
            data: {
              alertId: alert.id,
              price: currentPriceEur,
              threshold,
            },
          }),
        ]);

        // Send notification
        await this.notificationService.notify(alert.userId, channels, message, {
          title: `🔔 ${alert.asset.symbol}`,
          type: "alert",
          data: {
            alertId: alert.id,
            assetId: alert.assetId,
            symbol: alert.asset.symbol,
            currentPrice: currentPriceEur,
            threshold: threshold,
            alertType: alert.type,
            currency: "EUR", // Always EUR since we convert prices
          },
        });

        this.fastify.log.info(`Alert triggered: ${message}`);
      }
    }

    // Also update prices for alerts currently tracking
    await this.updateTrackingAlerts();
  }

  private checkCondition(
    type: string,
    currentPrice: number,
    threshold: number,
    asset: { changePercent?: number | null; volume?: number | null }
  ): boolean {
    switch (type) {
      case "price_above":
        return currentPrice >= threshold;
      case "price_below":
        return currentPrice <= threshold;
      case "percent_change":
        return asset.changePercent != null && Math.abs(asset.changePercent) >= threshold;
      case "volume_spike":
        return asset.volume != null && asset.volume >= threshold;
      default:
        return false;
    }
  }

  private buildMessage(
    type: string,
    symbol: string,
    currentPrice: number,
    threshold: number,
    asset: { changePercent?: number | null; volume?: number | null }
  ): string {
    switch (type) {
      case "price_above":
        return `${symbol} prezzo (€${currentPrice.toFixed(2)}) è sopra €${threshold.toFixed(2)}`;
      case "price_below":
        return `${symbol} prezzo (€${currentPrice.toFixed(2)}) è sotto €${threshold.toFixed(2)}`;
      case "percent_change":
        return `${symbol} variazione ${asset.changePercent?.toFixed(2)}% (soglia: ${threshold}%)`;
      case "volume_spike":
        return `${symbol} picco di volume: ${asset.volume?.toLocaleString()} (soglia: ${threshold.toLocaleString()})`;
      default:
        return `${symbol} alert attivato`;
    }
  }

  private async recordPrice(alertId: string, price: number, threshold: number): Promise<void> {
    await this.fastify.prisma.alertPriceTrack.create({
      data: {
        alertId,
        price,
        threshold,
      },
    });
  }

  private async stopTracking(alertId: string): Promise<void> {
    await this.fastify.prisma.alert.update({
      where: { id: alertId },
      data: {
        isTracking: false,
      },
    });
  }

  private async updateTrackingAlerts(): Promise<void> {
    // Find all alerts that are tracking but weren't processed in the main loop
    const trackingAlerts = await this.fastify.prisma.alert.findMany({
      where: {
        isTracking: true,
        status: "active",
      },
      include: { asset: true },
    });

    // Get EUR conversion rates
    const eurRates = await this.marketData.getEurRates();
    const defaultRate = eurRates["USD"] || (await this.marketData.getUsdToEurRate());

    for (const alert of trackingAlerts) {
      const currentPrice = alert.asset.currentPrice;
      if (!currentPrice) continue;

      // Convert current price to EUR
      const currency = alert.asset.currency || "USD";
      const eurRate = eurRates[currency] || defaultRate;
      const currentPriceEur = currency === "EUR" ? currentPrice : +(currentPrice * eurRate).toFixed(2);

      const condition = alert.condition as { threshold: number };
      const isStillTriggered = this.checkCondition(alert.type, currentPriceEur, condition.threshold, alert.asset);

      if (!isStillTriggered) {
        // Price returned to safe zone
        await this.stopTracking(alert.id);
        this.fastify.log.info(`Alert ${alert.id}: tracking stopped (price in safe zone)`);
      }
    }
  }

  /**
   * Get price tracking data for an alert
   */
  async getAlertTracking(alertId: string): Promise<{
    tracks: Array<{ price: number; threshold: number; recordedAt: Date }>;
    isTracking: boolean;
    trackingStartedAt: Date | null;
  }> {
    const alert = await this.fastify.prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        priceTracks: {
          orderBy: { recordedAt: "asc" },
          take: 500, // Limit to last 500 points
        },
      },
    });

    if (!alert) {
      return { tracks: [], isTracking: false, trackingStartedAt: null };
    }

    return {
      tracks: alert.priceTracks.map((t) => ({
        price: t.price,
        threshold: t.threshold,
        recordedAt: t.recordedAt,
      })),
      isTracking: alert.isTracking,
      trackingStartedAt: alert.trackingStartedAt,
    };
  }
}
