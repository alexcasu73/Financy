"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, ShoppingCart, Euro, Eye, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatEur, formatPercent, formatDecimal } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  ReferenceLine,
} from "recharts";

interface TradingCardProps {
  tradingAsset: {
    id: string;
    assetId: string;
    symbol: string;
    name: string;
    currency?: string;
    status: "watching" | "bought" | "sold";
    entryPrice: number | null;
    entryPriceEur?: number | null;
    entryPriceNative?: number | null;
    entryDate: string | null;
    quantity: number | null;
    targetPrice: number | null;
    targetPriceEur?: number | null;
    stopLossPrice: number | null;
    stopLossPriceEur?: number | null;
    exitPrice: number | null;
    exitDate: string | null;
    realizedProfitPct: number | null;
    currentPrice: number | null;
    currentPriceEur?: number | null;
    currentProfitPct: number | null;
    changePercent?: number | null; // daily change of the asset
    signals: any[];
  };
  onBuy: (id: string, quantity: number) => Promise<void>;
  onSell: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const statusLabels: Record<string, string> = {
  watching: "In osservazione",
  bought: "Acquistato",
  sold: "Venduto",
};

const statusColors: Record<string, "default" | "success" | "secondary"> = {
  watching: "secondary",
  bought: "success",
  sold: "default",
};

export function TradingCard({ tradingAsset, onBuy, onSell, onRemove }: TradingCardProps) {
  const [priceData, setPriceData] = useState<{ date: string; close: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await api.getAssetPrices(tradingAsset.assetId, "1M");
        setPriceData(prices || []);
      } catch {
        setPriceData([]);
      } finally {
        setLoadingChart(false);
      }
    };
    fetchPrices();
  }, [tradingAsset.assetId]);

  const chartColor = priceData.length > 1
    ? priceData[priceData.length - 1].close >= priceData[0].close
      ? "#22c55e"
      : "#ef4444"
    : "#3b82f6";

  // Calculate EUR conversion rate from current prices
  const eurRate = tradingAsset.currentPrice && tradingAsset.currentPriceEur
    ? tradingAsset.currentPriceEur / tradingAsset.currentPrice
    : 1;
  const isEurAsset = !tradingAsset.currency || tradingAsset.currency === "EUR";

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
        <div style={{ fontSize: "10px", opacity: 0.7 }}>{formatCurrency(value, tradingAsset.currency || "USD")}</div>
      </div>
    );
  };

  const handleBuy = async () => {
    if (!quantity) return;
    const investmentValue = Number(quantity);
    const priceEur = tradingAsset.currentPriceEur ?? tradingAsset.currentPrice ?? 0;
    if (priceEur <= 0) return;

    // Calculate quantity from investment value
    const calculatedQuantity = investmentValue / priceEur;

    setActionLoading(true);
    try {
      await onBuy(tradingAsset.id, calculatedQuantity);
      setBuyDialogOpen(false);
      setQuantity("");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSell = async () => {
    setActionLoading(true);
    try {
      await onSell(tradingAsset.id);
      setSellDialogOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const latestSignal = tradingAsset.signals?.[0];

  const borderClass =
    tradingAsset.status === "bought"
      ? "border-2 border-green-600/60 shadow-sm"
      : tradingAsset.status === "watching"
      ? "border-2 border-blue-600/50 shadow-sm"
      : "";

  return (
    <>
      <Card className={borderClass}>
        <CardContent className="p-4">
          <div className="flex items-stretch gap-4">
            {/* Left: Asset info */}
            <div className="shrink-0 w-48">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-bold text-lg">{tradingAsset.symbol}</span>
                <Badge variant={statusColors[tradingAsset.status]}>
                  {statusLabels[tradingAsset.status]}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {tradingAsset.name}
              </p>

              {(tradingAsset.currentPriceEur || tradingAsset.currentPrice) && (
                <div>
                  <p className="text-lg font-semibold">
                    {formatEur(tradingAsset.currentPriceEur ?? tradingAsset.currentPrice ?? 0)}
                  </p>
                  {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.currentPrice != null && (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(tradingAsset.currentPrice, tradingAsset.currency)}
                    </p>
                  )}
                  {/* Daily change of the asset */}
                  {tradingAsset.changePercent != null && (
                    <p className={`text-xs font-medium ${tradingAsset.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                      Oggi: {tradingAsset.changePercent >= 0 ? "+" : ""}{tradingAsset.changePercent.toFixed(2)}%
                    </p>
                  )}
                </div>
              )}

              {tradingAsset.status === "bought" && (tradingAsset.entryPriceEur || tradingAsset.entryPrice) && (
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="text-muted-foreground">
                    <p>Entry: {formatEur(tradingAsset.entryPriceEur ?? tradingAsset.entryPrice ?? 0)}</p>
                    {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.entryPriceNative && (
                      <p className="text-xs">
                        {formatCurrency(tradingAsset.entryPriceNative, tradingAsset.currency)}
                      </p>
                    )}
                  </div>
                  {(() => {
                    const entryPriceEur = tradingAsset.entryPriceEur ?? tradingAsset.entryPrice ?? 0;
                    const currentPriceEur = tradingAsset.currentPriceEur ?? tradingAsset.currentPrice ?? 0;
                    const qty = tradingAsset.quantity ?? 0;
                    const plEur = (currentPriceEur - entryPriceEur) * qty;
                    const plPercent = tradingAsset.currentProfitPct ?? (entryPriceEur > 0 ? ((currentPriceEur - entryPriceEur) / entryPriceEur) * 100 : 0);
                    const isPositive = plEur >= 0;

                    return (
                      <div className="mt-2 p-2 rounded bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Il tuo rendimento</p>
                        <div className={`${isPositive ? "text-green-600" : "text-red-600"} font-bold`}>
                          <span className="text-lg">{isPositive ? "+" : ""}{plPercent.toFixed(2)}%</span>
                          <span className="text-sm ml-2">({isPositive ? "+" : ""}{formatEur(plEur)})</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Target and Stop Loss - Highlighted */}
                  <div className="space-y-1.5">
                    {(tradingAsset.targetPriceEur || tradingAsset.targetPrice) && (
                      <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1.5 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Target
                        </p>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                          {formatEur(tradingAsset.targetPriceEur ?? tradingAsset.targetPrice ?? 0)}
                        </p>
                        {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.targetPrice != null && (
                          <p className="text-xs text-green-600/70 dark:text-green-400/70">
                            {formatCurrency(tradingAsset.targetPrice, tradingAsset.currency)}
                          </p>
                        )}
                      </div>
                    )}
                    {(tradingAsset.stopLossPriceEur || tradingAsset.stopLossPrice) && (
                      <div className="bg-red-50 dark:bg-red-950/20 rounded px-2 py-1.5 border border-red-200 dark:border-red-800">
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Stop Loss
                        </p>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                          {formatEur(tradingAsset.stopLossPriceEur ?? tradingAsset.stopLossPrice ?? 0)}
                        </p>
                        {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.stopLossPrice != null && (
                          <p className="text-xs text-red-600/70 dark:text-red-400/70">
                            {formatCurrency(tradingAsset.stopLossPrice, tradingAsset.currency)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tradingAsset.status === "watching" && (
                <div className="mt-2 space-y-1.5">
                  {/* Target and Stop Loss for watching assets */}
                  {(tradingAsset.targetPriceEur || tradingAsset.targetPrice) && (
                    <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1.5 border border-green-200 dark:border-green-800">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Target
                      </p>
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                        {formatEur(tradingAsset.targetPriceEur ?? tradingAsset.targetPrice ?? 0)}
                      </p>
                      {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.targetPrice != null && (
                        <p className="text-xs text-green-600/70 dark:text-green-400/70">
                          {formatCurrency(tradingAsset.targetPrice, tradingAsset.currency)}
                        </p>
                      )}
                    </div>
                  )}
                  {(tradingAsset.stopLossPriceEur || tradingAsset.stopLossPrice) && (
                    <div className="bg-red-50 dark:bg-red-950/20 rounded px-2 py-1.5 border border-red-200 dark:border-red-800">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Stop Loss
                      </p>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                        {formatEur(tradingAsset.stopLossPriceEur ?? tradingAsset.stopLossPrice ?? 0)}
                      </p>
                      {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.stopLossPrice != null && (
                        <p className="text-xs text-red-600/70 dark:text-red-400/70">
                          {formatCurrency(tradingAsset.stopLossPrice, tradingAsset.currency)}
                        </p>
                      )}
                    </div>
                  )}

                </div>
              )}

              {tradingAsset.status === "sold" && tradingAsset.realizedProfitPct !== null && (
                <div className="mt-2">
                  <p className={`text-sm font-medium ${tradingAsset.realizedProfitPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    Realizzato: {formatPercent(tradingAsset.realizedProfitPct || 0)}
                  </p>
                </div>
              )}
            </div>

            {/* Center: Chart */}
            <div className="flex-1 min-w-0 self-stretch">
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
                      width={45}
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
                    {/* Target price line */}
                    {tradingAsset.targetPrice && (
                      <ReferenceLine
                        y={tradingAsset.targetPrice}
                        stroke="#22c55e"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}
                    {/* Stop-loss line */}
                    {tradingAsset.stopLossPrice && (
                      <ReferenceLine
                        y={tradingAsset.stopLossPrice}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}
                    {/* Entry price line */}
                    {tradingAsset.entryPrice && (
                      <ReferenceLine
                        y={tradingAsset.entryPrice}
                        stroke="#f97316"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                      />
                    )}
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
            <div className="flex flex-col justify-center gap-2 shrink-0">
              {/* Signal badge */}
              {latestSignal && (
                <Badge
                  variant={
                    latestSignal.action === "BUY"
                      ? "success"
                      : latestSignal.action === "SELL"
                      ? "destructive"
                      : "secondary"
                  }
                  className="font-semibold text-center"
                >
                  {latestSignal.action}
                </Badge>
              )}

              {tradingAsset.status === "watching" && (
                <Button size="sm" onClick={() => setBuyDialogOpen(true)}>
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Acquista
                </Button>
              )}
              {tradingAsset.status === "bought" && (() => {
                const entryP = tradingAsset.entryPriceEur ?? tradingAsset.entryPrice ?? 0;
                const currentP = tradingAsset.currentPriceEur ?? tradingAsset.currentPrice ?? 0;
                const profitPct = entryP > 0 ? ((currentP - entryP) / entryP) * 100 : 0;
                const targetP = tradingAsset.targetPriceEur ?? tradingAsset.targetPrice;
                const stopLossP = tradingAsset.stopLossPriceEur ?? tradingAsset.stopLossPrice;

                // Calculate target and stop loss percentages
                const targetPct = targetP && entryP > 0 ? ((targetP - entryP) / entryP) * 100 : 10;
                const stopLossPct = stopLossP && entryP > 0 ? ((stopLossP - entryP) / entryP) * 100 : -10;

                // Show prominent SELL only if target reached or stop loss triggered
                const targetReached = profitPct >= targetPct;
                const stopLossTriggered = profitPct <= stopLossPct;
                const shouldSell = targetReached || stopLossTriggered;

                return shouldSell ? (
                  targetReached ? (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setSellDialogOpen(true)}>
                      <Euro className="h-4 w-4 mr-1" />
                      Vendi (Target!)
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => setSellDialogOpen(true)}>
                      <Euro className="h-4 w-4 mr-1" />
                      Vendi (Stop Loss!)
                    </Button>
                  )
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSellDialogOpen(true)}>
                    <Euro className="h-4 w-4 mr-1" />
                    Chiudi
                  </Button>
                );
              })()}
              {tradingAsset.status !== "bought" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => onRemove(tradingAsset.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Quantity info */}
          {tradingAsset.quantity && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
              <span>Quantità: {tradingAsset.quantity.toFixed(4)} {tradingAsset.symbol}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buy Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acquista {tradingAsset.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p>Prezzo attuale: <span className="font-medium">{formatEur(tradingAsset.currentPriceEur ?? tradingAsset.currentPrice ?? 0)}</span></p>
              {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.currentPrice != null && (
                <p className="text-xs">{formatCurrency(tradingAsset.currentPrice, tradingAsset.currency)}</p>
              )}
            </div>
            <div>
              <Label htmlFor="investmentValue">Importo da investire (€)</Label>
              <Input
                id="investmentValue"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Es: 500"
                className="mt-2"
                min="0"
                step="0.01"
              />
            </div>
            {quantity && (tradingAsset.currentPriceEur || tradingAsset.currentPrice) && (
              <div className="text-sm space-y-1 p-3 bg-muted/50 rounded">
                <p>
                  Quantità: <span className="font-medium">
                    {(Number(quantity) / (tradingAsset.currentPriceEur ?? tradingAsset.currentPrice ?? 1)).toFixed(4)}
                  </span> {tradingAsset.symbol}
                </p>
                <p>
                  Investimento: <span className="font-medium">{formatEur(Number(quantity))}</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleBuy} disabled={!quantity || Number(quantity) <= 0 || actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma Acquisto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vendi {tradingAsset.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Quantit&agrave;: <span className="font-medium">{tradingAsset.quantity}</span>
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Prezzo attuale: <span className="font-medium">{formatEur(tradingAsset.currentPriceEur ?? tradingAsset.currentPrice ?? 0)}</span></p>
              {tradingAsset.currency && tradingAsset.currency !== "EUR" && tradingAsset.currentPrice != null && (
                <p className="text-xs">{formatCurrency(tradingAsset.currentPrice, tradingAsset.currency)}</p>
              )}
            </div>
            {tradingAsset.currentProfitPct !== null && (
              <p className={`text-lg font-medium ${tradingAsset.currentProfitPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                Profitto: {formatPercent(tradingAsset.currentProfitPct || 0)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialogOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleSell} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma Vendita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
