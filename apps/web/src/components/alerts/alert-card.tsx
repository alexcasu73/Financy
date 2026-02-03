"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Trash2, Pause, Play, Pencil, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatEur, formatPercent, formatDecimal, timeAgo } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  YAxis,
} from "recharts";

interface AlertCardProps {
  alert: {
    id: string;
    assetId: string;
    symbol: string;
    name: string;
    type: string;
    condition: { threshold: number };
    status: string;
    channels: string[];
    currentPrice?: number;
    currentPriceEur?: number;
    changePercent?: number;
    currency?: string;
    sector?: string;
    triggerCount: number;
    createdAt: string;
    lastTriggeredAt?: string;
  };
  onDelete?: (id: string) => void;
  onToggle?: (id: string, status: string) => void;
  onEdit?: (alert: AlertCardProps["alert"]) => void;
}

// Labels always in Italian
const typeLabels: Record<string, string> = {
  price_above: "Prezzo sopra",
  price_below: "Prezzo sotto",
  percent_change: "Variazione %",
  volume_spike: "Picco di volume",
  technical_signal: "Segnale tecnico",
};

const statusLabels: Record<string, string> = {
  active: "Attivo",
  triggered: "Scattato",
  paused: "In pausa",
  expired: "Scaduto",
};

const statusColors: Record<string, "success" | "warning" | "secondary"> = {
  active: "success",
  triggered: "warning",
  paused: "secondary",
  expired: "secondary",
};

export function AlertCard({ alert, onDelete, onToggle, onEdit }: AlertCardProps) {
  const [priceData, setPriceData] = useState<{ date: string; close: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await api.getAssetPrices(alert.assetId, "1M");
        setPriceData(prices || []);
      } catch {
        setPriceData([]);
      } finally {
        setLoadingChart(false);
      }
    };
    fetchPrices();
  }, [alert.assetId]);

  // Determine chart color based on price trend
  const chartColor = priceData.length > 1
    ? priceData[priceData.length - 1].close >= priceData[0].close
      ? "#22c55e" // green
      : "#ef4444" // red
    : "#3b82f6"; // blue default

  // Calculate EUR conversion rate from current prices
  const eurRate = alert.currentPrice && alert.currentPriceEur
    ? alert.currentPriceEur / alert.currentPrice
    : 1;
  const isEurAsset = !alert.currency || alert.currency === "EUR";

  const formatChartDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatChartPrice = (value: number) => {
    const eurValue = isEurAsset ? value : value * eurRate;
    if (isEurAsset) {
      return formatEur(eurValue);
    }
    return (
      <div>
        <div>{formatEur(eurValue)}</div>
        <div style={{ fontSize: "10px", opacity: 0.7 }}>{formatCurrency(value, alert.currency || "USD")}</div>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div>
          <div className="flex items-center gap-3">
            {/* Left: Asset info */}
            <div className="shrink-0 space-y-2" style={{ width: '170px' }}>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="font-bold text-base">{alert.symbol}</span>
                  <Badge variant={statusColors[alert.status]} className="text-xs py-0">
                    {statusLabels[alert.status] || alert.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {alert.name}
                </p>
              </div>

              {(alert.currentPriceEur || alert.currentPrice) && (
                <div className="bg-muted/50 rounded px-2 py-1.5">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Prezzo</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">
                      {formatEur(alert.currentPriceEur ?? alert.currentPrice ?? 0)}
                    </span>
                    {alert.changePercent != null && (
                      <span className={`text-xs flex items-center gap-0.5 ${
                        alert.changePercent >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {alert.changePercent >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {formatPercent(alert.changePercent)}
                      </span>
                    )}
                  </div>
                  {alert.currency && alert.currency !== "EUR" && alert.currentPrice != null && (
                    <p className="text-xs text-muted-foreground/70">
                      {formatCurrency(alert.currentPrice, alert.currency)}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5 text-xs text-muted-foreground">
                {alert.sector && (
                  <p><span className="font-medium">Settore:</span> {alert.sector}</p>
                )}
                <p className="font-medium text-primary">
                  {typeLabels[alert.type] || alert.type}
                </p>
                <div className="p-1.5 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800">
                  <p className="font-medium text-orange-700 dark:text-orange-400 text-xs mb-0.5">
                    Soglia
                  </p>
                  {/* Threshold is always in EUR */}
                  <p className="text-xs text-orange-600 dark:text-orange-300">
                    {formatEur(alert.condition.threshold)}
                  </p>
                  {!isEurAsset && (
                    <p className="text-xs text-orange-600/70 dark:text-orange-400/70">
                      ≈ {formatCurrency(alert.condition.threshold / eurRate, alert.currency || "USD")}
                    </p>
                  )}
                </div>
                {alert.channels.length > 0 && (
                  <p className="text-xs">
                    <span className="font-medium">Canali:</span> {alert.channels.join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Center: Chart */}
            <div className="flex-1 min-w-0 h-36">
              {loadingChart ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse bg-muted rounded w-full h-full" />
                </div>
              ) : priceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => formatDecimal(v, 0)}
                      width={40}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                      labelFormatter={(label) => formatChartDate(label)}
                      formatter={(value: number) => [formatChartPrice(value), "Prezzo"]}
                    />
                    <ReferenceLine
                      y={alert.condition.threshold}
                      stroke="#f97316"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke={chartColor}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, fill: chartColor }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground bg-muted/20 rounded">
                  Nessun dato
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex flex-col justify-start gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(alert)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Modifica
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggle?.(alert.id, alert.status === "active" ? "paused" : "active")}
              >
                {alert.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pausa
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Attiva
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onDelete?.(alert.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Elimina
              </Button>
            </div>
          </div>

          {/* Bottom: Additional info aligned with chart */}
          {alert.lastTriggeredAt && (
            <div className="w-full -mt-[17px] pb-1" style={{ marginLeft: '182px' }}>
              <div className="border-t border-border"></div>
              <p className="text-xs text-muted-foreground pt-0.5" suppressHydrationWarning>
                Ultimo scatto: {timeAgo(alert.lastTriggeredAt)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
