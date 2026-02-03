"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency, formatEur, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

const POLL_INTERVAL = 60000; // 1 minute

export function MarketOverview() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAssets = useCallback(() => {
    api
      .getAssets({ limit: 8 })
      .then((res) => {
        setAssets(res.data || []);
        setLastUpdate(new Date());
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAssets();
    const interval = setInterval(fetchAssets, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAssets]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Panoramica Mercato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Panoramica Mercato</CardTitle>
        {lastUpdate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: "3s" }} />
            <span>{lastUpdate.toLocaleTimeString()}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {asset.symbol.slice(0, 3)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-sm">{asset.symbol}</p>
                  <p className="text-xs text-muted-foreground">{asset.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-sm">
                  {formatEur(asset.currentPriceEur ?? asset.currentPrice ?? 0)}
                </p>
                {asset.currency !== "EUR" && asset.currentPrice != null && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(asset.currentPrice)}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1">
                  {(asset.changePercent || 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      (asset.changePercent || 0) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {formatPercent(asset.changePercent || 0)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
