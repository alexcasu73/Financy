"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X } from "lucide-react";
import { formatCurrency, formatEur } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  YAxis,
} from "recharts";

interface SuggestionCardProps {
  suggestion: {
    id: string;
    assetId: string;
    symbol: string;
    name: string;
    type: string;
    threshold: number;
    reason: string;
    reasonOriginal?: string;
    confidence: string;
    currentPrice?: number;
    asset?: {
      currency?: string;
    };
  };
  lang?: "it" | "en";
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

// Labels always in Italian
const typeLabels: Record<string, string> = {
  price_above: "Prezzo sopra",
  price_below: "Prezzo sotto",
  percent_change: "Variazione %",
  volume_spike: "Picco di volume",
};

const confidenceVariant: Record<string, "success" | "warning" | "secondary"> = {
  high: "success",
  medium: "warning",
  low: "secondary",
};

const confidenceLabels: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Bassa",
};

export function SuggestionCard({ suggestion, lang = "it", onAccept, onDismiss }: SuggestionCardProps) {
  const [priceData, setPriceData] = useState<{ date: string; close: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  // Show original (EN) when lang is "en", otherwise show translated (IT)
  const showOriginal = lang === "en";
  const hasOriginal = suggestion.reasonOriginal && suggestion.reasonOriginal !== suggestion.reason;
  const displayedReason = showOriginal && hasOriginal ? suggestion.reasonOriginal : suggestion.reason;

  // Currency handling - assume 0.92 EUR/USD conversion if not EUR
  const currency = suggestion.asset?.currency || "USD";
  const isEurAsset = currency === "EUR";
  const eurRate = isEurAsset ? 1 : 0.92; // Simple conversion rate

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

  // Determine chart color based on price trend
  const chartColor = priceData.length > 1
    ? priceData[priceData.length - 1].close >= priceData[0].close
      ? "#22c55e" // green
      : "#ef4444" // red
    : "#8b5cf6"; // violet default

  const formatChartDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <Card className="border-dashed border-violet-300 dark:border-violet-700">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
            {/* Left: Asset info */}
            <div className="flex items-start gap-2 shrink-0" style={{ width: '170px' }}>
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0 space-y-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base">{suggestion.symbol}</span>
                    <Badge variant={confidenceVariant[suggestion.confidence] || "secondary"} className="text-xs py-0">
                      {confidenceLabels[suggestion.confidence] || suggestion.confidence}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {typeLabels[suggestion.type] || suggestion.type}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="bg-orange-50 dark:bg-orange-950/20 rounded px-2 py-1.5">
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Soglia</p>
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                      {formatEur(suggestion.threshold * eurRate)}
                    </p>
                    {!isEurAsset && (
                      <p className="text-xs text-orange-600/70 dark:text-orange-400/70">
                        {formatCurrency(suggestion.threshold, currency)}
                      </p>
                    )}
                  </div>

                  {suggestion.currentPrice != null && (
                    <div className="bg-muted/50 rounded px-2 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Attuale</p>
                      <p className="text-sm font-semibold">
                        {formatEur(suggestion.currentPrice * eurRate)}
                      </p>
                      {!isEurAsset && (
                        <p className="text-xs text-muted-foreground/70">
                          {formatCurrency(suggestion.currentPrice, currency)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          {/* Center: Chart and Description */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="h-40">
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
                    tickFormatter={(v) => `€${v.toFixed(0)}`}
                    width={40}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(label) => formatChartDate(label)}
                    formatter={(value: number) => {
                      const eurValue = value * eurRate;
                      return [
                        <>
                          {formatEur(eurValue)}
                          {!isEurAsset && (
                            <div style={{ fontSize: "10px", opacity: 0.7 }}>
                              {formatCurrency(value, currency)}
                            </div>
                          )}
                        </>,
                        "Prezzo"
                      ];
                    }}
                  />
                  <ReferenceLine
                    y={suggestion.threshold}
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
                    activeDot={{ r: 4, fill: chartColor }}
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
            <div className="border-t border-border mt-0.5 pt-0.5">
              <p className="text-xs text-muted-foreground">
                {displayedReason}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col justify-start gap-2 shrink-0">
            <Button
              variant="default"
              size="sm"
              onClick={() => onAccept(suggestion.id)}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Crea Alert
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(suggestion.id)}
            >
              <X className="h-4 w-4 mr-1" />
              Ignora
            </Button>
          </div>
          </div>
      </CardContent>
    </Card>
  );
}
