"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCurrency, formatEur } from "@/lib/utils";
import {
  Sparkles,
  TrendingUp,
  Loader2,
  Plus,
  AlertCircle,
  ArrowRight,
  DollarSign,
  BarChart3,
  Target,
} from "lucide-react";

interface InvestmentSuggestion {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  currency: string;
  type: string;
  sector: string;
  exchange: string;
  reason: string;
  score: number;
  expectedReturn?: number;
  riskLevel?: string;
  timeHorizon?: string;
}

const STORAGE_KEY = 'ai-advisor-state';

export default function AdvisorPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<InvestmentSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usdToEur, setUsdToEur] = useState(0.92); // Default rate, will be updated
  const [selectedAsset, setSelectedAsset] = useState<InvestmentSuggestion | null>(null);

  // Load saved state on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const { query: savedQuery, suggestions: savedSuggestions } = JSON.parse(savedState);
        if (savedQuery) setQuery(savedQuery);
        if (savedSuggestions && savedSuggestions.length > 0) {
          setSuggestions(savedSuggestions);
        }
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    }
  }, []);

  // Save state when suggestions change
  useEffect(() => {
    if (suggestions.length > 0 || query) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        query,
        suggestions,
        timestamp: Date.now(),
      }));
    }
  }, [query, suggestions]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Inserisci una descrizione del tipo di investimento che cerchi");
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const result = await api.searchInvestments(query);
      setSuggestions(result.suggestions || []);
      if (!result.suggestions || result.suggestions.length === 0) {
        setError("Nessun investimento trovato. Prova a riformulare la ricerca.");
      }
    } catch (err: any) {
      setError(err.message || "Errore durante la ricerca");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearResults = () => {
    setQuery("");
    setSuggestions([]);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleAddToPortfolio = async (assetId: string) => {
    try {
      // TODO: Implementare dialog per scegliere portfolio, quantità, prezzo
      console.log("Adding to portfolio:", assetId);
      alert("Funzionalità in arrivo: scegli portfolio, quantità e prezzo di acquisto");
    } catch (err: any) {
      alert(err.message || "Errore durante l'aggiunta al portfolio");
    }
  };

  const handleAddToTrading = async (suggestion: InvestmentSuggestion) => {
    try {
      // Create TradingSuggestion with status="accepted" using API client
      await api.createTradingSuggestion({
        assetId: suggestion.id,
        reason: suggestion.reason,
        confidence: suggestion.score >= 80 ? "high" : suggestion.score >= 60 ? "medium" : "low",
        expectedProfit: suggestion.expectedReturn,
        riskLevel: suggestion.riskLevel,
        timeframe: suggestion.timeHorizon,
        status: "accepted", // Pre-accepted from AI Advisor
        criteria: {
          source: "ai-advisor",
          aiScore: suggestion.score,
          sector: suggestion.sector,
        },
      });

      alert(`✅ ${suggestion.symbol} aggiunto al Trading!\n\nL'asset è stato aggiunto con status "Accettato" ed è pronto per essere analizzato dal sistema di trading.`);
      setSelectedAsset(null); // Close dialog
    } catch (err: any) {
      alert(`❌ ${err.message || "Errore durante l'aggiunta al trading"}`);
    }
  };

  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel?.toLowerCase()) {
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  const getRiskLabel = (riskLevel?: string) => {
    switch (riskLevel?.toLowerCase()) {
      case "low":
        return "Basso Rischio";
      case "medium":
        return "Medio Rischio";
      case "high":
        return "Alto Rischio";
      default:
        return "N/A";
    }
  };

  const convertToEur = (price: number, currency: string) => {
    if (currency === "EUR") return price;
    if (currency === "USD") return price * usdToEur;
    // For other currencies, use USD rate as approximation
    return price * usdToEur;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Advisor
        </h1>
        <p className="text-muted-foreground mt-1">
          Descrivi il tipo di investimento che cerchi e lascia che l&apos;AI trovi le migliori opportunità per te
        </p>
      </div>

      {/* Search Box */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cosa stai cercando?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Esempio: Vorrei investire in tecnologia verde con un orizzonte a lungo termine e rischio moderato. Preferisco aziende europee con buoni fondamentali..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={5}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Sii più specifico possibile: settore, rischio, orizzonte temporale, geografia, ecc.
            </p>
            <Button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ricerca in corso...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Cerca Investimenti
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Suggerimenti trovati ({suggestions.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearResults}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Nuova Ricerca
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((suggestion) => (
              <Card key={suggestion.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{suggestion.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {suggestion.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatEur(convertToEur(suggestion.currentPrice, suggestion.currency))}
                      </p>
                      {suggestion.currency !== "EUR" && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(suggestion.currentPrice, suggestion.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {suggestion.sector && (
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.sector}
                      </Badge>
                    )}
                    {suggestion.riskLevel && (
                      <Badge className={`text-xs ${getRiskColor(suggestion.riskLevel)}`}>
                        {getRiskLabel(suggestion.riskLevel)}
                      </Badge>
                    )}
                    {suggestion.timeHorizon && (
                      <Badge variant="outline" className="text-xs">
                        {suggestion.timeHorizon}
                      </Badge>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-medium mb-1 flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Perché questo investimento?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.reason}
                    </p>
                  </div>

                  {/* Metrics */}
                  {(suggestion.expectedReturn || suggestion.score) && (
                    <div className="flex items-center gap-4 text-sm">
                      {suggestion.score && (
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Score:</span>
                          <span className="font-semibold">{suggestion.score}/100</span>
                        </div>
                      )}
                      {suggestion.expectedReturn && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 font-semibold">
                            +{suggestion.expectedReturn}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAddToPortfolio(suggestion.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Aggiungi
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedAsset(suggestion)}
                    >
                      Dettagli
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && suggestions.length === 0 && !error && query.trim() === "" && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Trova il tuo prossimo investimento</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Descrivi nel campo sopra che tipo di investimento stai cercando.
              L&apos;AI analizzerà le tue preferenze e ti suggerirà le migliori opportunità disponibili.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Asset Details Dialog */}
      <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAsset && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{selectedAsset.symbol}</span>
                  <Badge variant="outline">{selectedAsset.type}</Badge>
                </DialogTitle>
                <DialogDescription className="text-lg">
                  {selectedAsset.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Price Section */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Prezzo Attuale</h3>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold">
                      {formatEur(convertToEur(selectedAsset.currentPrice, selectedAsset.currency))}
                    </span>
                    {selectedAsset.currency !== "EUR" && (
                      <span className="text-lg text-muted-foreground">
                        {formatCurrency(selectedAsset.currentPrice, selectedAsset.currency)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Asset Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Settore</h3>
                    <p className="font-medium">{selectedAsset.sector}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Exchange</h3>
                    <p className="font-medium">{selectedAsset.exchange}</p>
                  </div>
                </div>

                {/* AI Analysis */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Analisi AI
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm leading-relaxed">{selectedAsset.reason}</p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Score</div>
                    <div className="text-2xl font-bold">{selectedAsset.score}/100</div>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Rischio</div>
                    <Badge className={getRiskColor(selectedAsset.riskLevel)}>
                      {getRiskLabel(selectedAsset.riskLevel)}
                    </Badge>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Orizzonte</div>
                    <div className="text-lg font-semibold capitalize">{selectedAsset.timeHorizon || 'N/A'}</div>
                  </div>
                </div>

                {selectedAsset.expectedReturn && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-medium">Rendimento Atteso</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-300 mt-1">
                      +{selectedAsset.expectedReturn}% annuo
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleAddToPortfolio(selectedAsset.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi al Portfolio
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleAddToTrading(selectedAsset)}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Aggiungi in Trading
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full"
                    asChild
                  >
                    <a href={`/assets?symbol=${selectedAsset.symbol}`}>
                      Vai agli Asset
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
