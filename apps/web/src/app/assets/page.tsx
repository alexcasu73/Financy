"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshControl } from "@/components/ui/refresh-control";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AssetCard } from "@/components/assets/asset-card";
import { api } from "@/lib/api";
import { formatCurrency, formatEur, formatPercent, formatNumber } from "@/lib/utils";
import { usePolling } from "@/hooks/use-polling";
import { Search, TrendingUp, TrendingDown, Plus, Loader2 } from "lucide-react";

const assetTypes = ["all", "stock", "crypto", "etf", "bond", "commodity"];

interface YahooResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  sector?: string;
  industry?: string;
  currentPrice?: number | null;
  currentPriceEur?: number | null;
  previousClose?: number | null;
  changePercent?: number | null;
  volume?: number | null;
  currency?: string;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Yahoo search
  const [yahooResults, setYahooResults] = useState<YahooResult[]>([]);
  const [yahooSearching, setYahooSearching] = useState(false);
  const [importingSymbol, setImportingSymbol] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<{ id: string; symbol: string } | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await api.getAssets({
        type: typeFilter === "all" ? undefined : typeFilter,
        search: search || undefined,
        limit: 50,
      });
      setAssets(res.data || []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  const { lastUpdate } = usePolling(fetchAssets);

  // Debounced Yahoo search when user types a query
  useEffect(() => {
    if (!search || search.length < 2) {
      setYahooResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setYahooSearching(true);
      try {
        const res = await api.searchAssets(search);
        setYahooResults(res.results || []);
      } catch {
        setYahooResults([]);
      } finally {
        setYahooSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  // Filter Yahoo results to exclude assets already in DB
  const dbSymbols = new Set(assets.map((a) => a.symbol.toUpperCase()));
  const newYahooResults = yahooResults.filter(
    (r) => !dbSymbols.has(r.symbol.toUpperCase())
  );

  const handleImport = async (result: YahooResult) => {
    setImportingSymbol(result.symbol);
    try {
      await api.importAsset({
        symbol: result.symbol,
        name: result.name,
        type: result.type,
        exchange: result.exchange,
        sector: result.sector,
        industry: result.industry,
      });
      // Re-fetch to show the new asset in the main list
      await fetchAssets();
      // Remove from Yahoo results
      setYahooResults((prev) => prev.filter((r) => r.symbol !== result.symbol));
    } catch {
      // ignore
    } finally {
      setImportingSymbol(null);
    }
  };

  const handleDelete = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    setAssetToDelete({ id, symbol: asset?.symbol || "asset" });
  };

  const confirmDelete = async () => {
    if (!assetToDelete) return;
    setDeletingId(assetToDelete.id);
    setAssetToDelete(null);
    try {
      await api.deleteAsset(assetToDelete.id);
      setAssets((prev) => prev.filter((a) => a.id !== assetToDelete.id));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Asset</h1>
          <p className="text-muted-foreground">Esplora e cerca strumenti finanziari</p>
        </div>
        <RefreshControl lastUpdate={lastUpdate} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per simbolo o nome..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {assetTypes.map((type) => (
            <Badge
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-6 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Tracked assets from DB */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
                deleting={deletingId === asset.id}
              />
            ))}
            {assets.length === 0 && !search && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nessun asset monitorato. Cerca un asset per aggiungerlo.
              </div>
            )}
          </div>

          {/* Yahoo Finance results (not yet in DB) */}
          {search.length >= 2 && (newYahooResults.length > 0 || yahooSearching) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Yahoo Finance</h2>
                {yahooSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {newYahooResults.map((r) => (
                  <Card key={r.symbol} className="border-dashed">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{r.symbol}</span>
                            <Badge variant="outline" className="capitalize text-xs">
                              {r.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {r.name}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          {r.currentPriceEur != null ? (
                            <>
                              <p className="font-bold text-lg">
                                {formatEur(r.currentPriceEur)}
                              </p>
                              {r.currentPrice != null && r.currency !== "EUR" && (
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(r.currentPrice, r.currency || "USD")}
                                </p>
                              )}
                              {r.changePercent != null && (
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  {r.changePercent >= 0 ? (
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                  )}
                                  <span
                                    className={`text-sm font-medium ${
                                      r.changePercent >= 0
                                        ? "text-green-500"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {formatPercent(r.changePercent)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">--</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{r.exchange}</span>
                          {r.sector && <span>{r.sector}</span>}
                          {r.volume != null && r.volume > 0 && (
                            <span>Vol: {formatNumber(r.volume)}</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={importingSymbol === r.symbol}
                          onClick={() => handleImport(r)}
                        >
                          {importingSymbol === r.symbol ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Traccia
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No results at all */}
          {search && assets.length === 0 && newYahooResults.length === 0 && !yahooSearching && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              Nessun asset trovato per &quot;{search}&quot;.
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!assetToDelete} onOpenChange={(open) => { if (!open) setAssetToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rimuovere {assetToDelete?.symbol}?</DialogTitle>
            <DialogDescription>
              Questo asset verrà rimosso dalla tua lista. Eventuali posizioni e alert associati verranno eliminati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetToDelete(null)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Rimuovi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
