"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
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

export default function AdvisorPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<InvestmentSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const handleAddToPortfolio = async (assetId: string) => {
    try {
      // TODO: Implementare aggiunta al portfolio
      console.log("Adding to portfolio:", assetId);
    } catch (err: any) {
      alert(err.message || "Errore durante l'aggiunta al portfolio");
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
                        {formatCurrency(suggestion.currentPrice, suggestion.currency)}
                      </p>
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
                      asChild
                    >
                      <a href={`/assets?symbol=${suggestion.symbol}`}>
                        Dettagli
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </a>
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
    </div>
  );
}
