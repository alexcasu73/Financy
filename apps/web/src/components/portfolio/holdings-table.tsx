"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatEur, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, Pencil, Trash2, EyeOff } from "lucide-react";
import Link from "next/link";

interface Holding {
  id: string;
  assetId?: string;
  symbol: string;
  name: string;
  type?: string;
  quantity: number;
  currency?: string;
  weight?: number;
  // EUR (primary) — avgBuyPrice stored in EUR
  avgBuyPrice: number;
  currentPriceEur?: number;
  currentValueEur?: number;
  totalCostEur?: number;
  profitLossEur?: number;
  profitLossPercent: number;
  // Native (secondary)
  currentPrice: number;
  currentValue: number;
}

interface HoldingsTableProps {
  holdings: Holding[];
  onEdit?: (holding: Holding) => void;
  onDelete?: (holdingId: string) => void;
  excludedIds?: Set<string>;
  onToggleExclude?: (holdingId: string) => void;
}

export function HoldingsTable({ holdings, onEdit, onDelete, excludedIds, onToggleExclude }: HoldingsTableProps) {
  const hasExcluded = excludedIds && excludedIds.size > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Posizioni</CardTitle>
        {hasExcluded && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" />
            <span>{excludedIds.size} esclus{excludedIds.size === 1 ? 'o' : 'i'} dal calcolo</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {onToggleExclude && (
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground w-10">
                    <span className="sr-only">Includi</span>
                  </th>
                )}
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Asset</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Qtà</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Prezzo Medio</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Attuale</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valore</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">P&L</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Peso</th>
                {(onEdit || onDelete) && (
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Azioni</th>
                )}
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const curr = h.currency || "USD";
                const showNative = curr !== "EUR";
                const plEur = h.profitLossEur ?? 0;
                const isExcluded = excludedIds?.has(h.id) ?? false;

                return (
                  <tr
                    key={h.id}
                    className={`border-b hover:bg-accent/50 transition-colors ${isExcluded ? "opacity-40" : ""}`}
                  >
                    {onToggleExclude && (
                      <td className="py-3 px-2 text-center">
                        <Checkbox
                          checked={!isExcluded}
                          onCheckedChange={() => onToggleExclude(h.id)}
                          aria-label={isExcluded ? "Includi nel calcolo" : "Escludi dal calcolo"}
                        />
                      </td>
                    )}
                    <td className="py-3 px-2">
                      <Link href={`/assets/${h.symbol}`} className={`hover:underline ${isExcluded ? "line-through" : ""}`}>
                        <p className="font-medium">{h.symbol}</p>
                        <p className="text-xs text-muted-foreground">{h.name}</p>
                      </Link>
                    </td>
                    <td className="text-right py-3 px-2">{h.quantity.toFixed(4)}</td>
                    <td className="text-right py-3 px-2">
                      <p className="font-medium">{formatEur(h.avgBuyPrice)}</p>
                    </td>
                    <td className="text-right py-3 px-2">
                      <p className="font-medium">
                        {formatEur(h.currentPriceEur ?? h.currentPrice)}
                      </p>
                      {showNative && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(h.currentPrice, curr)}
                        </p>
                      )}
                    </td>
                    <td className="text-right py-3 px-2">
                      <p className="font-medium">
                        {formatEur(h.currentValueEur ?? h.currentValue)}
                      </p>
                      {showNative && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(h.currentValue, curr)}
                        </p>
                      )}
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        {plEur >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <div>
                          <p className={`font-medium ${plEur >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {formatEur(Math.abs(plEur))}
                          </p>
                          <p className={`text-xs ${h.profitLossPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {formatPercent(h.profitLossPercent)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      {(h.weight || 0).toFixed(1)}%
                    </td>
                    {(onEdit || onDelete) && (
                      <td className="text-right py-3 px-2">
                        <div className="flex items-center justify-end gap-1">
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onEdit(h)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => onDelete(h.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
