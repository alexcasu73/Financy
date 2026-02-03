"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency, formatEur, formatPercent } from "@/lib/utils";
import { Briefcase, TrendingUp, TrendingDown, Euro } from "lucide-react";

export function PortfolioSummary() {
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getPortfolios()
      .then(async (data) => {
        if (data && data.length > 0) {
          const full = await api.getPortfolio(data[0].id);
          setPerformance(full.performance || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
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
    );
  }

  if (!performance) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Nessun portafoglio</p>
          <p className="text-sm">Crea un portafoglio per visualizzare il riepilogo qui.</p>
        </CardContent>
      </Card>
    );
  }

  const totalValueEur = performance.totalValueEur || 0;
  const totalCostEur = performance.totalCostEur || 0;
  const totalReturnEur = performance.totalReturnEur || 0;
  const totalReturnPercent = performance.totalReturnPercent || 0;
  const totalValueUsd = performance.totalValue || 0;

  const stats = [
    {
      label: "Valore Totale",
      value: formatEur(totalValueEur),
      subValue: formatCurrency(totalValueUsd),
      icon: Euro,
      color: "text-primary",
    },
    {
      label: "Rendimento Totale",
      value: formatEur(totalReturnEur),
      subValue: formatPercent(totalReturnPercent),
      icon: totalReturnEur >= 0 ? TrendingUp : TrendingDown,
      color: totalReturnEur >= 0 ? "text-green-500" : "text-red-500",
    },
    {
      label: "Totale Investito",
      value: formatEur(totalCostEur),
      icon: Briefcase,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </p>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className={`text-xl font-bold mt-1 ${stat.color}`}>
              {stat.value}
            </p>
            {stat.subValue && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {stat.subValue}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
