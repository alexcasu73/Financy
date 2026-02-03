"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceChart } from "@/components/charts/price-chart";
import { IndicatorChart } from "@/components/charts/indicator-chart";
import { RefreshControl } from "@/components/ui/refresh-control";
import { api } from "@/lib/api";
import { formatCurrency, formatEur, formatPercent, formatNumber } from "@/lib/utils";
import { usePolling } from "@/hooks/use-polling";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

export default function AssetDetailPage() {
  const params = useParams();
  const symbol = params.symbol as string;

  const [asset, setAsset] = useState<any>(null);
  const [prices, setPrices] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const assetsResult = await api.getAssets({ search: symbol });
      const found = (assetsResult.data || []).find(
        (a: any) => a.symbol.toUpperCase() === symbol.toUpperCase()
      );
      if (found) {
        setAsset(found);
        const [priceData, signalData] = await Promise.all([
          api.getAssetPrices(found.id).catch(() => []),
          api.getAssetSignals(found.id).catch(() => []),
        ]);
        setPrices(priceData);
        setSignals(signalData);
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const { lastUpdate } = usePolling(fetchData);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-2" />
          <div className="h-4 bg-muted rounded w-1/3" />
        </div>
        <div className="h-[400px] bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Asset non trovato</h2>
        <p className="text-muted-foreground">Nessun asset trovato per il simbolo: {symbol}</p>
      </div>
    );
  }

  const changePositive = (asset.changePercent || 0) >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{asset.symbol}</h1>
            <Badge variant="secondary" className="capitalize">
              {asset.type}
            </Badge>
          </div>
          <p className="text-muted-foreground">{asset.name}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">
            {formatEur(asset.currentPriceEur ?? asset.currentPrice ?? 0)}
          </p>
          {asset.currency !== "EUR" && asset.currentPrice != null && (
            <p className="text-lg text-muted-foreground">
              {formatCurrency(asset.currentPrice)}
            </p>
          )}
          <div className="flex items-center justify-end gap-1 mt-1">
            {changePositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={`text-lg font-medium ${
                changePositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatPercent(asset.changePercent || 0)}
            </span>
          </div>
          <div className="mt-2">
            <RefreshControl lastUpdate={lastUpdate} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Chiusura Prec.</p>
            <p className="text-lg font-bold">
              {formatEur(asset.previousCloseEur ?? asset.previousClose ?? 0)}
            </p>
            {asset.currency !== "EUR" && asset.previousClose != null && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(asset.previousClose)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Capitalizzazione</p>
            <p className="text-lg font-bold">
              {asset.marketCapEur
                ? `€${formatNumber(asset.marketCapEur)}`
                : asset.marketCap
                  ? `€${formatNumber(asset.marketCap)}`
                  : "N/A"}
            </p>
            {asset.currency !== "EUR" && asset.marketCap != null && (
              <p className="text-xs text-muted-foreground">
                ${formatNumber(asset.marketCap)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Volume</p>
            <p className="text-lg font-bold">
              {asset.volume ? formatNumber(asset.volume) : "N/A"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Settore</p>
            <p className="text-lg font-bold">{asset.sector || asset.type}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">Grafico Prezzi</TabsTrigger>
          <TabsTrigger value="indicators">Indicatori Tecnici</TabsTrigger>
        </TabsList>
        <TabsContent value="chart">
          {prices.length > 0 ? (
            <PriceChart data={prices} title={`${asset.symbol} Storico Prezzi`} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nessuno storico prezzi disponibile
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="indicators">
          <IndicatorChart signals={signals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
