"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { ArrowLeft, Trash2, TrendingUp, TrendingDown, Calendar, Loader2 } from "lucide-react";
import { formatCurrency, formatEur, formatDate, formatPercent, formatDecimal } from "@/lib/utils";
import Link from "next/link";

export default function TradingHistoryPage() {
  const [soldAssets, setSoldAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const assets = await api.getTradingAssets();
      setSoldAssets((assets || []).filter((a: any) => a.status === "sold"));
    } catch (err) {
      console.error("Error fetching trading history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.removeTradingAsset(deleteId);
      setSoldAssets((prev) => prev.filter((a) => a.id !== deleteId));
    } catch (err) {
      console.error("Error deleting:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // Calculate totals
  const totalProfit = soldAssets.reduce((sum, a) => {
    const profit = a.exitPrice && a.entryPrice && a.quantity
      ? (a.exitPrice - a.entryPrice) * a.quantity
      : 0;
    return sum + profit;
  }, 0);

  const avgProfitPct = soldAssets.length > 0
    ? soldAssets.reduce((sum, a) => sum + (a.realizedProfitPct || 0), 0) / soldAssets.length
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/trading">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Trading
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Storico Vendite</h1>
            <p className="text-muted-foreground">Cronologia delle posizioni chiuse</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trading">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trading
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Storico Vendite</h1>
          <p className="text-muted-foreground">Cronologia delle posizioni chiuse</p>
        </div>
      </div>

      {/* Summary */}
      {soldAssets.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Operazioni Totali</p>
              <p className="text-2xl font-bold">{soldAssets.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Profitto/Perdita Totale</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalProfit >= 0 ? "+" : ""}{formatEur(totalProfit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Media % Profitto</p>
              <p className={`text-2xl font-bold ${avgProfitPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatPercent(avgProfitPct)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History List */}
      {soldAssets.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tutte le Operazioni</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {soldAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${asset.realizedProfitPct >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                      {asset.realizedProfitPct >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{asset.symbol}</span>
                        <span className="text-sm text-muted-foreground">{asset.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Quantità: {asset.quantity}</span>
                        <span>Acquisto: {formatEur(asset.entryPriceEur ?? asset.entryPrice)}</span>
                        <span>Vendita: {formatEur(asset.exitPriceEur ?? asset.exitPrice)}</span>
                        {asset.currency && asset.currency !== "EUR" && (
                          <span className="text-xs opacity-60">
                            ({formatCurrency(asset.entryPrice, asset.currency)} → {formatCurrency(asset.exitPrice, asset.currency)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-bold ${asset.realizedProfitPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatPercent(asset.realizedProfitPct || 0)}
                      </p>
                      {asset.exitDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(asset.exitDate)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(asset.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nessuna operazione completata</h2>
            <p className="text-muted-foreground">
              Le posizioni vendute appariranno qui
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina dal storico?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione rimuoverà definitivamente questa voce dallo storico vendite.
              L&apos;azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
