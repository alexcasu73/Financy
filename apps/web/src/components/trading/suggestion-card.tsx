"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Check, X, Loader2, Sparkles } from "lucide-react";
import { formatCurrency, formatEur, formatPercent, formatDecimal } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

interface TradingSuggestionCardProps {
  suggestion: {
    id: string;
    assetId: string;
    symbol: string;
    name: string;
    currency?: string;
    currentPrice: number | null;
    currentPriceEur?: number | null;
    changePercent: number | null;
    sector: string | null;
    type: string;
    reason: string;
    confidence: string;
    expectedProfit: number | null;
    riskLevel: string | null;
    timeframe: string | null;
  };
  onAccept: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

const confidenceColors: Record<string, "success" | "warning" | "secondary"> = {
  high: "success",
  medium: "warning",
  low: "secondary",
};

const confidenceLabels: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Bassa",
};

const riskColors: Record<string, string> = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-red-600",
};

const riskLabels: Record<string, string> = {
  low: "Basso",
  medium: "Medio",
  high: "Alto",
};

const timeframeLabels: Record<string, { label: string; range: string; desc: string }> = {
  days: {
    label: "Breve termine",
    range: "1-5 giorni",
    desc: "Operazione rapida, chiudi entro pochi giorni"
  },
  weeks: {
    label: "Medio termine",
    range: "1-4 settimane",
    desc: "Mantieni per alcune settimane"
  },
  months: {
    label: "Lungo termine",
    range: "1-6 mesi",
    desc: "Investimento a lungo periodo"
  },
};

export function TradingSuggestionCard({ suggestion, onAccept, onDismiss }: TradingSuggestionCardProps) {
  const [priceData, setPriceData] = useState<{ date: string; close: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [actionLoading, setActionLoading] = useState<"accept" | "dismiss" | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await api.getAssetPrices(suggestion.assetId, "1M");
        setPriceData(prices || []);
      } catch {
        setPriceData([]);
      } finally {
        setLoadingChart(false);
      }
    };
    fetchPrices();
  }, [suggestion.assetId]);

  const chartColor = priceData.length > 1
    ? priceData[priceData.length - 1].close >= priceData[0].close
      ? "#22c55e"
      : "#ef4444"
    : "#8b5cf6";

  // Calculate EUR conversion rate from current prices
  const eurRate = suggestion.currentPrice && suggestion.currentPriceEur
    ? suggestion.currentPriceEur / suggestion.currentPrice
    : 1;
  const isEurAsset = !suggestion.currency || suggestion.currency === "EUR";

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
        <div style={{ fontSize: "10px", opacity: 0.7 }}>{formatCurrency(value, suggestion.currency || "USD")}</div>
      </div>
    );
  };

  const handleAccept = async () => {
    setActionLoading("accept");
    try {
      await onAccept(suggestion.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async () => {
    setActionLoading("dismiss");
    try {
      await onDismiss(suggestion.id);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card className="border-dashed border-violet-300 dark:border-violet-700">
      <CardContent className="p-3">
        <div>
          <div className="flex items-center gap-3">
            {/* Left: Asset info */}
            <div className="shrink-0 space-y-2" style={{ width: '170px' }}>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="font-bold text-base">{suggestion.symbol}</span>
                <Badge variant={confidenceColors[suggestion.confidence]} className="text-xs py-0">
                  {confidenceLabels[suggestion.confidence] || suggestion.confidence}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {suggestion.name}
              </p>
            </div>

            {(suggestion.currentPriceEur || suggestion.currentPrice) && (
              <div className="bg-muted/50 rounded px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Prezzo</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">
                    {formatEur(suggestion.currentPriceEur ?? suggestion.currentPrice ?? 0)}
                  </span>
                  {suggestion.changePercent != null && (
                    <span className={`text-xs flex items-center gap-0.5 ${
                      suggestion.changePercent >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {suggestion.changePercent >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {formatPercent(suggestion.changePercent)}
                    </span>
                  )}
                </div>
                {suggestion.currency && suggestion.currency !== "EUR" && suggestion.currentPrice != null && (
                  <p className="text-xs text-muted-foreground/70">
                    {formatCurrency(suggestion.currentPrice, suggestion.currency)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 text-xs text-muted-foreground">
              {suggestion.sector && (
                <p><span className="font-medium">Settore:</span> {suggestion.sector}</p>
              )}
              {suggestion.expectedProfit && (
                <p className="text-green-600 font-medium">Target: +{suggestion.expectedProfit}%</p>
              )}
              {suggestion.riskLevel && (
                <p className={riskColors[suggestion.riskLevel] + " font-medium"}>
                  Rischio: {riskLabels[suggestion.riskLevel]}
                </p>
              )}
              {suggestion.timeframe && timeframeLabels[suggestion.timeframe] && (
                <div className="p-1.5 bg-violet-50 dark:bg-violet-950/20 rounded border border-violet-200 dark:border-violet-800">
                  <p className="font-medium text-violet-700 dark:text-violet-400 text-xs">
                    {timeframeLabels[suggestion.timeframe].label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeframeLabels[suggestion.timeframe].range}
                  </p>
                </div>
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
              size="sm"
              onClick={handleAccept}
              disabled={actionLoading !== null}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {actionLoading === "accept" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Accetta
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={actionLoading !== null}
            >
              {actionLoading === "dismiss" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Ignora
                </>
              )}
            </Button>
          </div>
          </div>

          {/* Bottom: Reason aligned with chart */}
          <div className="w-full -mt-[17px] pb-1" style={{ marginLeft: '182px' }}>
            <div className="border-t border-border"></div>
            <p className="text-xs text-muted-foreground pt-0.5">
              {suggestion.reason}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
