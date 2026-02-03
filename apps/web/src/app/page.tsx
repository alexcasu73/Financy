"use client";

import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { RecentAlerts } from "@/components/dashboard/recent-alerts";
import { SentimentGauge } from "@/components/dashboard/sentiment-gauge";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bentornato. Ecco la tua panoramica finanziaria.
        </p>
      </div>

      <PortfolioSummary />

      <div className="grid gap-6 lg:grid-cols-2">
        <MarketOverview />
        <SentimentGauge />
      </div>

      <RecentAlerts />
    </div>
  );
}
