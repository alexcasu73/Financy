"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshControl } from "@/components/ui/refresh-control";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TradingSurvey } from "@/components/trading/trading-survey";
import { TradingCard } from "@/components/trading/trading-card";
import { TradingSuggestionCard } from "@/components/trading/suggestion-card";
import { AcceptSuggestionDialog } from "@/components/trading/accept-suggestion-dialog";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import {
  TrendingUp,
  Settings,
  RefreshCw,
  Plus,
  Search,
  Bell,
  Target,
  Shield,
  Clock,
  Loader2,
  Sparkles,
  History,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Star,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatEur, timeAgo, formatDecimal, formatPercent } from "@/lib/utils";

interface TradingProfile {
  id: string;
  horizon: string;
  riskTolerance: string;
  targetProfitPct: number;
  maxLossPct: number;
  preferredSectors: string[];
  analysisInterval: number;
  cashBalance?: number;
}

export default function TradingPage() {
  const [profile, setProfile] = useState<TradingProfile | null>(null);
  const [tradingAssets, setTradingAssets] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Add asset dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingAsset, setAddingAsset] = useState<string | null>(null);

  // Cash balance dialog
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Analysis suggestions dialog
  const [analysisSuggestionsOpen, setAnalysisSuggestionsOpen] = useState(false);
  const [analysisSuggestions, setAnalysisSuggestions] = useState<any[]>([]);

  // Accept suggestion dialog
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [profileData, assetsData, signalsData, suggestionsData, balanceData] = await Promise.all([
        api.getTradingProfile(),
        api.getTradingAssets(),
        api.getTradingSignals(),
        api.getTradingSuggestions(),
        api.getTradingBalance(),
      ]);
      setProfile(profileData);
      setTradingAssets(assetsData || []);
      setSignals(signalsData || []);
      setSuggestions(suggestionsData || []);
      setCashBalance(balanceData?.cashBalance || 0);
    } catch (err) {
      console.error("Error fetching trading data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastUpdate } = usePolling(fetchData);

  // Search assets
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchAssets(searchQuery);
        // Filter out assets already in trading
        const existingSymbols = new Set(tradingAssets.map((ta) => ta.symbol));
        setSearchResults((res.results || []).filter((r: any) => !existingSymbols.has(r.symbol)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, tradingAssets]);

  const handleSurveyComplete = async (data: any) => {
    setSurveyLoading(true);
    try {
      console.log("Creating profile with data:", data);
      await api.createTradingProfile(data);
      await fetchData();
      setShowSurvey(false);
    } catch (err: any) {
      console.error("Error creating profile:", err);
      alert("Errore nella creazione del profilo: " + (err.message || JSON.stringify(err)));
    } finally {
      setSurveyLoading(false);
    }
  };

  const handleAddAsset = async (result: any) => {
    setAddingAsset(result.symbol);
    try {
      // First import asset if needed
      await api.importAsset({
        symbol: result.symbol,
        name: result.name,
        type: result.type,
        exchange: result.exchange,
        sector: result.sector,
        industry: result.industry,
      });

      // Get asset ID
      const assets = await api.getAssets({ search: result.symbol });
      const asset = assets.data?.find((a: any) => a.symbol === result.symbol);

      if (asset) {
        await api.addTradingAsset(asset.id);
        await fetchData();
        setAddDialogOpen(false);
        setSearchQuery("");
      }
    } catch (err) {
      console.error("Error adding asset:", err);
    } finally {
      setAddingAsset(null);
    }
  };

  const handleBuy = async (id: string, quantity: number) => {
    try {
      await api.executeBuy(id, quantity);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Errore durante l'acquisto");
    }
  };

  const handleSell = async (id: string) => {
    try {
      await api.executeSell(id);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Errore durante la vendita");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.removeTradingAsset(id);
    } catch (err: any) {
      // Se l'asset non esiste più (404), lo rimuoviamo comunque dalla lista locale
      if (err.message?.includes("not found") || err.message?.includes("404")) {
        console.warn(`Asset ${id} not found on server, removing from local list`);
      } else {
        console.error("Error removing trading asset:", err);
        alert(err.message || "Errore durante la rimozione dell'asset");
        return; // Non aggiornare la lista se c'è un errore diverso da 404
      }
    }
    await fetchData();
  };

  const handleAnalyze = async () => {
    if (tradingAssets.filter(ta => ta.status === "watching" || ta.status === "bought").length === 0) {
      alert("Nessun asset da analizzare. Aggiungi asset in osservazione o accetta suggerimenti AI.");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await api.triggerTradingAnalysis();
      await fetchData();

      // Show suggestions dialog if available
      if (result.suggestions && result.suggestions.length > 0) {
        setAnalysisSuggestions(result.suggestions);
        setAnalysisSuggestionsOpen(true);
      } else {
        alert(result.message || "Analisi completata. Controlla i segnali.");
      }
    } catch (err) {
      console.error("Errore analisi:", err);
      alert("Errore durante l'analisi.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    console.log("Generating suggestions...");
    setGenerating(true);
    try {
      const result = await api.generateTradingSuggestions();
      console.log("Generate result:", result);
      await fetchData();
    } catch (err) {
      console.error("Error generating suggestions:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptSuggestion = async (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    if (suggestion) {
      setSelectedSuggestion(suggestion);
      setAcceptDialogOpen(true);
    }
  };

  const handleConfirmAcceptSuggestion = async (
    suggestionId: string,
    params: {
      status: "watching" | "bought";
      entryPrice?: number;
      quantity?: number;
    }
  ) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    await api.acceptTradingSuggestion(suggestionId, params);
    await fetchData();
  };

  const handleDismissSuggestion = async (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await api.dismissTradingSuggestion(id);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(balanceAmount);
    if (!amount || amount <= 0) return;
    setBalanceLoading(true);
    try {
      const result = await api.depositFunds(amount);
      setCashBalance(result.cashBalance);
      setBalanceDialogOpen(false);
      setBalanceAmount("");
    } catch (err) {
      console.error("Error depositing:", err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(balanceAmount);
    if (!amount || amount <= 0) return;
    if (amount > cashBalance) {
      alert("Saldo insufficiente");
      return;
    }
    setBalanceLoading(true);
    try {
      const result = await api.withdrawFunds(amount);
      setCashBalance(result.cashBalance);
      setBalanceDialogOpen(false);
      setBalanceAmount("");
    } catch (err) {
      console.error("Error withdrawing:", err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const horizonLabels: Record<string, string> = {
    short: "Breve termine",
    medium: "Medio termine",
    long: "Lungo termine",
  };

  const riskLabels: Record<string, string> = {
    conservative: "Conservativo",
    moderate: "Moderato",
    aggressive: "Aggressivo",
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Trading</h1>
          <p className="text-muted-foreground">Gestisci i tuoi investimenti</p>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse p-6 rounded-lg border">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show survey if no profile
  if (!profile || showSurvey) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Trading</h1>
          <p className="text-muted-foreground">
            {profile ? "Modifica il tuo profilo trading" : "Configura il tuo profilo per iniziare"}
          </p>
        </div>
        <TradingSurvey onComplete={handleSurveyComplete} loading={surveyLoading} />
        {profile && (
          <div className="text-center">
            <Button variant="ghost" onClick={() => setShowSurvey(false)}>
              Annulla
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Active trades
  const watchingAssets = tradingAssets.filter((ta) => ta.status === "watching");
  const boughtAssets = tradingAssets.filter((ta) => ta.status === "bought");
  const soldAssets = tradingAssets.filter((ta) => ta.status === "sold");
  const recentSignals = signals.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading</h1>
          <p className="text-muted-foreground">Gestisci i tuoi investimenti attivi</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshControl lastUpdate={lastUpdate} />
          <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${analyzing ? "animate-spin" : ""}`} />
            Analizza
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSurvey(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Profilo
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Aggiungi
          </Button>
        </div>
      </div>

      {/* Profile Summary & Balance */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-200 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saldo Trading</p>
                <p className="text-2xl font-bold">{formatEur(cashBalance)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setBalanceDialogOpen(true)}
                className="h-10 w-10"
              >
                <Wallet className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Summary */}
        <Card className="md:col-span-3">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{horizonLabels[profile.horizon]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>{riskLabels[profile.riskTolerance]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                <span>Target: +{profile.targetProfitPct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
                <span>Stop-loss: -{profile.maxLossPct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span>Analisi ogni {profile.analysisInterval} min</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bought Assets */}
      {boughtAssets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Posizioni Aperte ({boughtAssets.length})
          </h2>

          {/* P&L Summary Card */}
          {(() => {
            const totalInvested = boughtAssets.reduce((sum, ta) => {
              const cost = (ta.entryPrice || 0) * (ta.quantity || 0);
              return sum + cost;
            }, 0);
            const totalCurrentValue = boughtAssets.reduce((sum, ta) => {
              const value = (ta.currentPriceEur || ta.currentPrice || 0) * (ta.quantity || 0);
              return sum + value;
            }, 0);
            const totalPL = totalCurrentValue - totalInvested;
            const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
            const isPositive = totalPL >= 0;

            return (
              <Card className={`border-2 ${isPositive ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'}`}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Investito</p>
                      <p className="text-lg font-semibold">{formatEur(totalInvested)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valore Attuale</p>
                      <p className="text-lg font-semibold">{formatEur(totalCurrentValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">P&L Totale</p>
                      <p className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{formatEur(totalPL)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rendimento</p>
                      <p className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{totalPLPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {boughtAssets.map((ta) => (
            <TradingCard
              key={ta.id}
              tradingAsset={ta}
              onBuy={handleBuy}
              onSell={handleSell}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Watching Assets */}
      {watchingAssets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            In Osservazione ({watchingAssets.length})
          </h2>
          {watchingAssets.map((ta) => (
            <TradingCard
              key={ta.id}
              tradingAsset={ta}
              onBuy={handleBuy}
              onSell={handleSell}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* AI Suggestions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Suggerimenti AI
            {suggestions.length > 0 && (
              <Badge variant="secondary">{suggestions.length}</Badge>
            )}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSuggestions}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Genera Suggerimenti
              </>
            )}
          </Button>
        </div>

        {suggestions.length > 0 ? (
          suggestions.map((suggestion) => (
            <TradingSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={handleAcceptSuggestion}
              onDismiss={handleDismissSuggestion}
            />
          ))
        ) : (
          <Card className="border-dashed border-violet-300 dark:border-violet-700">
            <CardContent className="py-8 text-center">
              <Sparkles className="h-10 w-10 mx-auto text-violet-400 mb-3" />
              <p className="text-muted-foreground mb-3">
                Nessun suggerimento disponibile
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Clicca &quot;Genera Suggerimenti&quot; per ricevere asset consigliati
                <br />
                in base al tuo profilo di investimento
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Signals */}
      {recentSignals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-primary" />
              Ultimi Segnali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSignals.map((signal: any) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        signal.action === "BUY"
                          ? "success"
                          : signal.action === "SELL"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {signal.action}
                    </Badge>
                    <span className="font-medium">{signal.symbol}</span>
                    <div className="text-sm">
                      <span>{formatEur(signal.priceAtSignalEur ?? signal.priceAtSignal)}</span>
                      {signal.currency && signal.currency !== "EUR" && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({formatCurrency(signal.priceAtSignal, signal.currency)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{signal.confidence}</Badge>
                    <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {timeAgo(signal.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sold Assets (link to history) */}
      {soldAssets.length > 0 && (
        <Link href="/trading/history">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Storico Vendite</p>
                    <p className="text-sm text-muted-foreground">
                      {soldAssets.length} operazioni completate
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-semibold ${
                      soldAssets.reduce((sum, a) => sum + (a.realizedProfitPct || 0), 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatPercent(soldAssets.reduce((sum, a) => sum + (a.realizedProfitPct || 0), 0) / soldAssets.length)} avg
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Empty state */}
      {tradingAssets.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold">Nessun asset in trading</h2>
          <p className="text-muted-foreground mb-4">
            Aggiungi asset per iniziare a ricevere segnali di trading
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi Asset
          </Button>
        </div>
      )}

      {/* Add Asset Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aggiungi Asset al Trading</DialogTitle>
            <DialogDescription>
              Cerca e aggiungi asset alla tua watchlist di trading
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per simbolo o nome..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-auto space-y-2">
                {searchResults.map((result) => (
                  <div
                    key={result.symbol}
                    className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 ${result.isPrimary ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" : ""}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {result.isPrimary && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                        <span className="font-medium">{result.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.type}
                        </Badge>
                        {result.isPrimary && (
                          <Badge className="text-xs bg-yellow-500/90 hover:bg-yellow-500">
                            Principale
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{result.exchange}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {result.name}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={addingAsset === result.symbol}
                      onClick={() => handleAddAsset(result)}
                    >
                      {addingAsset === result.symbol ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nessun risultato per &quot;{searchQuery}&quot;
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Balance Dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Gestisci Saldo Trading
            </DialogTitle>
            <DialogDescription>
              Deposita o preleva fondi dal tuo saldo trading
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Saldo attuale</p>
              <p className="text-3xl font-bold">{formatEur(cashBalance)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Importo</label>
              <Input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="Es: 1000"
                min="0"
                step="0.01"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleDeposit}
                disabled={balanceLoading || !balanceAmount || parseFloat(balanceAmount) <= 0}
              >
                {balanceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 mr-1" />
                )}
                Deposita
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={handleWithdraw}
                disabled={balanceLoading || !balanceAmount || parseFloat(balanceAmount) <= 0 || parseFloat(balanceAmount) > cashBalance}
              >
                {balanceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                )}
                Preleva
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Il saldo viene utilizzato per acquistare asset nel trading. Quando vendi, i proventi tornano nel saldo.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analysis Suggestions Dialog */}
      <Dialog open={analysisSuggestionsOpen} onOpenChange={setAnalysisSuggestionsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Suggerimenti AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {analysisSuggestions.map((suggestion, idx) => {
              const actionColor =
                suggestion.action === "BUY"
                  ? "text-green-600 bg-green-50 border-green-200"
                  : suggestion.action === "SELL"
                  ? "text-red-600 bg-red-50 border-red-200"
                  : "text-gray-600 bg-gray-50 border-gray-200";

              const actionIcon =
                suggestion.action === "BUY" ? "📈" : suggestion.action === "SELL" ? "📉" : "⏸️";

              const confidenceBadge =
                suggestion.confidence === "high"
                  ? "bg-green-100 text-green-700"
                  : suggestion.confidence === "medium"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-700";

              const actionText =
                suggestion.action === "BUY"
                  ? "COMPRA"
                  : suggestion.action === "SELL"
                  ? "VENDI"
                  : "MANTIENI";

              const actionBg =
                suggestion.action === "BUY"
                  ? "bg-green-600"
                  : suggestion.action === "SELL"
                  ? "bg-red-600"
                  : "bg-gray-600";

              return (
                <Card key={idx} className={`border-2 ${actionColor} overflow-hidden`}>
                  {/* Large Action Header */}
                  <div className={`${actionBg} text-white py-3 px-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{actionIcon}</span>
                        <div>
                          <p className="text-3xl font-black tracking-tight">{actionText}</p>
                          <p className="text-sm opacity-90">
                            {suggestion.confidence === "high"
                              ? "⭐⭐⭐ Alta fiducia"
                              : suggestion.confidence === "medium"
                              ? "⭐⭐ Media fiducia"
                              : "⭐ Bassa fiducia"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs bg-white/20 text-white border-white/40">
                          {suggestion.status === "bought" ? "Acquistato" : "In osservazione"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Asset Info */}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-2xl">{suggestion.symbol}</p>
                        <p className="text-sm text-muted-foreground">{suggestion.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Prezzo attuale</p>
                        <p className="text-xl font-bold font-mono">{formatEur(suggestion.currentPrice)}</p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-semibold mb-1">Motivo:</p>
                      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              {analysisSuggestions.filter((s) => s.action !== "HOLD").length} segnali azionabili su{" "}
              {analysisSuggestions.length} asset analizzati
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accept Suggestion Dialog */}
      <AcceptSuggestionDialog
        open={acceptDialogOpen}
        onOpenChange={setAcceptDialogOpen}
        suggestion={selectedSuggestion}
        onConfirm={handleConfirmAcceptSuggestion}
      />
    </div>
  );
}
