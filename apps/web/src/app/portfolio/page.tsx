"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { PortfolioPie } from "@/components/charts/portfolio-pie";
import { AddHoldingDialog } from "@/components/portfolio/add-holding-dialog";
import { EditHoldingDialog } from "@/components/portfolio/edit-holding-dialog";
import { api } from "@/lib/api";
import { formatCurrency, formatEur, formatPercent } from "@/lib/utils";
import { Briefcase, TrendingUp, TrendingDown, Euro, Activity, EyeOff, RotateCcw } from "lucide-react";

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editHolding, setEditHolding] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      let portfolios = await api.getPortfolios();

      // Auto-create portfolio if none exists
      if (!portfolios || portfolios.length === 0) {
        await api.createPortfolio({ name: "My Portfolio" });
        portfolios = await api.getPortfolios();
      }

      if (portfolios && portfolios.length > 0) {
        const full = await api.getPortfolio(portfolios[0].id);
        setPortfolio(full);
        setPerformance(full.performance || null);
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddHolding = async (data: { assetId: string; quantity: number; avgBuyPrice: number }) => {
    if (!portfolio) return;
    try {
      await api.addHolding(portfolio.id, data);
      fetchData();
    } catch {
      // Handle error
    }
  };

  const handleEdit = (holding: any) => {
    setEditHolding(holding);
    setEditOpen(true);
  };

  const handleSaveEdit = async (id: string, data: { assetId?: string; quantity: number; avgBuyPrice: number }) => {
    try {
      await api.updateHolding(id, data);
      fetchData();
    } catch {
      // Handle error
    }
  };

  const handleDelete = async (holdingId: string) => {
    try {
      await api.deleteHolding(holdingId);
      fetchData();
    } catch {
      // Handle error
    }
  };

  // Toggle exclude handler - must be before conditional returns
  const handleToggleExclude = useCallback((holdingId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(holdingId)) {
        next.delete(holdingId);
      } else {
        next.add(holdingId);
      }
      return next;
    });
  }, []);

  // Reset all exclusions
  const handleResetExclusions = useCallback(() => {
    setExcludedIds(new Set());
  }, []);

  const perf = performance || {};
  const holdings = perf.holdings || [];

  // Calculate filtered totals (excluding excluded holdings) - must be before conditional returns
  const filteredTotals = useMemo(() => {
    if (excludedIds.size === 0) {
      return {
        totalValueEur: perf.totalValueEur || 0,
        totalCostEur: perf.totalCostEur || 0,
        totalReturnEur: perf.totalReturnEur || 0,
        totalReturnPercent: perf.totalReturnPercent || 0,
        dailyChangeEur: perf.dailyChangeEur || 0,
        dailyChangePercent: perf.dailyChangePercent || 0,
        totalValueUsd: perf.totalValue || 0,
        totalCostUsd: perf.totalCost || 0,
        totalReturnUsd: perf.totalReturn || 0,
      };
    }

    // Recalculate excluding filtered holdings
    let totalValueEur = 0;
    let totalCostEur = 0;
    let totalValueUsd = 0;
    let totalCostUsd = 0;
    let prevTotalValueEur = 0;

    for (const h of holdings) {
      if (excludedIds.has(h.holdingId)) continue;

      totalValueEur += h.currentValueEur || 0;
      totalCostEur += h.totalCostEur || 0;
      totalValueUsd += h.currentValue || 0;
      totalCostUsd += h.totalCost || 0;

      // For daily change, estimate previous value
      const changePercent = h.dailyChangePercent || 0;
      const prevValue = (h.currentValueEur || 0) / (1 + changePercent / 100);
      prevTotalValueEur += prevValue;
    }

    const totalReturnEur = totalValueEur - totalCostEur;
    const totalReturnPercent = totalCostEur > 0 ? (totalReturnEur / totalCostEur) * 100 : 0;
    const totalReturnUsd = totalValueUsd - totalCostUsd;
    const dailyChangeEur = totalValueEur - prevTotalValueEur;
    const dailyChangePercent = prevTotalValueEur > 0 ? (dailyChangeEur / prevTotalValueEur) * 100 : 0;

    return {
      totalValueEur,
      totalCostEur,
      totalReturnEur,
      totalReturnPercent,
      dailyChangeEur,
      dailyChangePercent,
      totalValueUsd,
      totalCostUsd,
      totalReturnUsd,
    };
  }, [holdings, excludedIds, perf]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Portafoglio</h1>
          <p className="text-muted-foreground">Gestisci il tuo portafoglio di investimenti</p>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-6 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Use filtered totals
  const totalValueEur = filteredTotals.totalValueEur;
  const totalCostEur = filteredTotals.totalCostEur;
  const totalReturnEur = filteredTotals.totalReturnEur;
  const totalReturnPercent = filteredTotals.totalReturnPercent;
  const dailyChangeEur = filteredTotals.dailyChangeEur;
  const dailyChangePercent = filteredTotals.dailyChangePercent;
  const totalValueUsd = filteredTotals.totalValueUsd;
  const totalCostUsd = filteredTotals.totalCostUsd;
  const totalReturnUsd = filteredTotals.totalReturnUsd;

  // Map performance holdings to table format
  const tableHoldings = holdings.map((h: any) => ({
    id: h.holdingId,
    assetId: h.assetId,
    symbol: h.symbol,
    name: h.name,
    type: h.type,
    quantity: h.quantity,
    avgBuyPrice: h.avgBuyPrice,
    currentPrice: h.currentPrice,
    currentValue: h.currentValue,
    profitLossPercent: h.profitLossPercent,
    weight: h.weight,
    currency: h.currency,
    currentPriceEur: h.currentPriceEur,
    currentValueEur: h.currentValueEur,
    totalCostEur: h.totalCostEur,
    profitLossEur: h.profitLossEur,
  }));

  // Filter holdings for pie chart (exclude excluded)
  const pieHoldings = tableHoldings.filter((h: any) => !excludedIds.has(h.id));

  const hasExcluded = excludedIds.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portafoglio</h1>
          <p className="text-muted-foreground">Gestisci il tuo portafoglio di investimenti</p>
        </div>
        <AddHoldingDialog onAdd={handleAddHolding} />
      </div>

      {hasExcluded && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <EyeOff className="h-4 w-4" />
            <span className="text-sm font-medium">
              Simulazione: {excludedIds.size} asset esclus{excludedIds.size === 1 ? 'o' : 'i'} dal calcolo
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetExclusions}
            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Ripristina
          </Button>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className={hasExcluded ? "ring-2 ring-amber-300 dark:ring-amber-700" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Valore Totale {hasExcluded && "(simulato)"}
              </p>
              <Euro className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold mt-1 text-primary">
              {formatEur(totalValueEur)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(totalValueUsd)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Rendimento Totale</p>
              {totalReturnEur >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className={`text-xl font-bold mt-1 ${totalReturnEur >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatEur(totalReturnEur)}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${totalReturnPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatPercent(totalReturnPercent)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalReturnUsd)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Variazione Giornaliera</p>
              {dailyChangeEur >= 0 ? (
                <Activity className="h-4 w-4 text-green-500" />
              ) : (
                <Activity className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className={`text-xl font-bold mt-1 ${dailyChangeEur >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatEur(dailyChangeEur)}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${dailyChangeEur >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatPercent(dailyChangePercent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Totale Investito</p>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold mt-1">
              {formatEur(totalCostEur)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(totalCostUsd)}
            </p>
          </CardContent>
        </Card>
      </div>

      {tableHoldings.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HoldingsTable
              holdings={tableHoldings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              excludedIds={excludedIds}
              onToggleExclude={handleToggleExclude}
            />
          </div>
          <PortfolioPie holdings={pieHoldings} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="font-medium">Nessuna posizione</p>
            <p className="text-sm">Aggiungi la tua prima posizione per iniziare a monitorare il portafoglio.</p>
          </CardContent>
        </Card>
      )}

      <EditHoldingDialog
        holding={editHolding}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
