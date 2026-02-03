"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatEur, formatPercent, formatNumber } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

interface AssetCardProps {
  asset: {
    id: string;
    symbol: string;
    name: string;
    type: string;
    sector?: string;
    currency?: string;
    currentPrice?: number;
    currentPriceEur?: number;
    changePercent?: number;
    marketCap?: number;
    volume?: number;
  };
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

export function AssetCard({ asset, onDelete, deleting }: AssetCardProps) {
  const [priceData, setPriceData] = useState<{ date: string; close: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await api.getAssetPrices(asset.id, "1M");
        setPriceData(prices || []);
      } catch {
        setPriceData([]);
      } finally {
        setLoadingChart(false);
      }
    };
    fetchPrices();
  }, [asset.id]);

  // Determine chart color based on price trend
  const chartColor = priceData.length > 1
    ? priceData[priceData.length - 1].close >= priceData[0].close
      ? "#22c55e" // green
      : "#ef4444" // red
    : "#3b82f6"; // blue default

  const formatChartDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <Link href={`/assets/${asset.symbol}`} className="block cursor-pointer">
          {/* Header: Symbol and Price */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{asset.symbol}</span>
                <Badge variant="secondary" className="capitalize text-xs">
                  {asset.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {asset.name}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">
                {formatEur(asset.currentPriceEur ?? asset.currentPrice ?? 0)}
              </p>
              {asset.currency !== "EUR" && asset.currentPrice != null && (
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(asset.currentPrice)}
                </p>
              )}
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {(asset.changePercent || 0) >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-sm font-medium ${
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

          {/* Chart */}
          <div className="h-20 w-full mt-3">
            {loadingChart ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-pulse bg-muted rounded w-full h-full" />
              </div>
            ) : priceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 8 }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    width={35}
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
                    formatter={(value: number) => [formatCurrency(value), "Prezzo"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke={chartColor}
                    strokeWidth={1.5}
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
        </Link>

        {/* Footer: Metadata and Delete */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {asset.sector && <span>{asset.sector}</span>}
            {asset.marketCap && (
              <span>MCap: {formatNumber(asset.marketCap)}</span>
            )}
            {asset.volume && (
              <span>Vol: {formatNumber(asset.volume)}</span>
            )}
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(asset.id);
              }}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
