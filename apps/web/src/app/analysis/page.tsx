"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Brain,
  Sparkles,
  PieChart,
  Globe,
  Target,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Wallet,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { AnalysisWizardDialog } from "@/components/analysis/analysis-wizard-dialog";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const sentimentColors: Record<string, string> = {
  very_bullish: "text-green-600",
  bullish: "text-green-500",
  neutral: "text-yellow-500",
  bearish: "text-red-500",
  very_bearish: "text-red-600",
};

const sentimentLabels: Record<string, string> = {
  very_bullish: "Molto Rialzista",
  bullish: "Rialzista",
  neutral: "Neutrale",
  bearish: "Ribassista",
  very_bearish: "Molto Ribassista",
};

const typeConfig: Record<
  string,
  { label: string; icon: typeof PieChart; color: string }
> = {
  portfolio_digest: {
    label: "Portfolio Digest",
    icon: PieChart,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  market_overview: {
    label: "Market Overview",
    icon: Globe,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  asset_deep_dive: {
    label: "Asset Deep Dive",
    icon: Target,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  },
  market_digest: {
    label: "Market Digest",
    icon: Globe,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  },
  asset_analysis: {
    label: "Asset Analysis",
    icon: Target,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  },
};

const preferenceLabels: Record<string, Record<string, string>> = {
  riskTolerance: {
    conservative: "Conservativo",
    moderate: "Moderato",
    aggressive: "Aggressivo",
  },
  timeHorizon: {
    short: "Breve (<1a)",
    medium: "Medio (1-5a)",
    long: "Lungo (>5a)",
  },
  goals: {
    growth: "Crescita",
    income: "Rendita",
    preservation: "Preservazione",
  },
};

export default function AnalysisPage() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  const fetchAnalyses = async () => {
    try {
      const data = await api.getAnalyses();
      const list = data || [];
      setAnalyses(list);
      if (list.length > 0 && !selectedAnalysis) {
        setSelectedAnalysis(list[0]);
      }
    } catch {
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const handleAnalysisCreated = (analysis: any) => {
    setAnalyses((prev) => [analysis, ...prev]);
    setSelectedAnalysis(analysis);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    try {
      await api.deleteAnalysis(id);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null);
      }
    } catch (err) {
      console.error("Failed to delete analysis:", err);
    }
  };

  const getTypeConfig = (type: string) => {
    return (
      typeConfig[type] || {
        label: type.replace("_", " "),
        icon: Brain,
        color: "bg-gray-100 text-gray-800",
      }
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analisi Portafoglio</h1>
          <p className="text-muted-foreground">
            Approfondimenti e analisi del tuo portafoglio con intelligenza artificiale
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analisi Portafoglio</h1>
          <p className="text-muted-foreground">
            Approfondimenti e analisi del tuo portafoglio con intelligenza artificiale
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Sparkles className="h-4 w-4 mr-2" />
          Nuova Analisi
        </Button>
      </div>

      <AnalysisWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onAnalysisCreated={handleAnalysisCreated}
      />

      {analyses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold">Nessuna analisi</h2>
            <p className="text-sm">
              Clicca &quot;Nuova Analisi&quot; per creare la tua prima analisi
              personalizzata.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Analysis List */}
          <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-auto">
            {analyses.map((analysis) => {
              const config = getTypeConfig(analysis.type);
              const Icon = config.icon;
              return (
                <Card
                  key={analysis.id}
                  className={cn(
                    "cursor-pointer transition-shadow hover:shadow-md",
                    selectedAnalysis?.id === analysis.id
                      ? "ring-2 ring-primary"
                      : ""
                  )}
                  onClick={() => {
                    setSelectedAnalysis(analysis);
                    setShowPreferences(false);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={cn("text-xs gap-1", config.color)}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                          {analysis.sentiment && (
                            <span
                              className={cn(
                                "text-xs font-medium",
                                sentimentColors[analysis.sentiment]
                              )}
                            >
                              {sentimentLabels[analysis.sentiment] ||
                                analysis.sentiment}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm line-clamp-2">
                          {analysis.title}
                        </p>
                        {analysis.createdAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(analysis.createdAt)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDelete(analysis.id, e)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Elimina analisi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Analysis Detail */}
          <div className="lg:col-span-2">
            {selectedAnalysis ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      {selectedAnalysis.title}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    {(() => {
                      const config = getTypeConfig(selectedAnalysis.type);
                      const Icon = config.icon;
                      return (
                        <Badge className={cn("gap-1", config.color)}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      );
                    })()}
                    {selectedAnalysis.sentiment && (
                      <span
                        className={cn(
                          "font-medium",
                          sentimentColors[selectedAnalysis.sentiment]
                        )}
                      >
                        {sentimentLabels[selectedAnalysis.sentiment] ||
                          selectedAnalysis.sentiment}
                      </span>
                    )}
                    {selectedAnalysis.createdAt && (
                      <span>{formatDate(selectedAnalysis.createdAt)}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preferences collapse */}
                  {selectedAnalysis.metadata?.preferences && (
                    <button
                      onClick={() => setShowPreferences(!showPreferences)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      {showPreferences ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      Preferenze utilizzate
                    </button>
                  )}
                  {showPreferences && selectedAnalysis.metadata?.preferences && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          Rischio:{" "}
                          {preferenceLabels.riskTolerance[
                            selectedAnalysis.metadata.preferences.riskTolerance
                          ] || selectedAnalysis.metadata.preferences.riskTolerance}
                        </Badge>
                        <Badge variant="outline">
                          Orizzonte:{" "}
                          {preferenceLabels.timeHorizon[
                            selectedAnalysis.metadata.preferences.timeHorizon
                          ] || selectedAnalysis.metadata.preferences.timeHorizon}
                        </Badge>
                        <Badge variant="outline">
                          Obiettivo:{" "}
                          {preferenceLabels.goals[
                            selectedAnalysis.metadata.preferences.goals
                          ] || selectedAnalysis.metadata.preferences.goals}
                        </Badge>
                        <Badge variant="outline">
                          Valuta:{" "}
                          {selectedAnalysis.metadata.preferences.baseCurrency}
                        </Badge>
                      </div>
                      {selectedAnalysis.metadata.preferences.preferredSectors
                        ?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Settori:{" "}
                          {selectedAnalysis.metadata.preferences.preferredSectors.join(
                            ", "
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Portfolio Summary */}
                  {selectedAnalysis.metadata?.portfolioValue > 0 && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Il Tuo Portfolio
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Valore Totale</p>
                          <p className="font-semibold text-lg">
                            {formatCurrency(selectedAnalysis.metadata.portfolioValue, selectedAnalysis.metadata?.preferences?.baseCurrency || "EUR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Posizioni</p>
                          <p className="font-semibold text-lg flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            {selectedAnalysis.metadata.holdingsCount} asset
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {selectedAnalysis.summary && (
                    <div className="p-4 bg-accent/50 rounded-lg">
                      <p className="text-sm font-medium">Riepilogo</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedAnalysis.summary}
                      </p>
                    </div>
                  )}

                  {/* Content with Markdown */}
                  {selectedAnalysis.content && (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
                      <ReactMarkdown
                        components={{
                          h2: ({ children }) => (
                            <h2 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold mt-3 mb-1 text-foreground">{children}</h3>
                          ),
                          p: ({ children }) => (
                            <p className="text-sm leading-relaxed mb-2 text-muted-foreground">{children}</p>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          ul: ({ children }) => (
                            <ul className="text-sm space-y-1 ml-4 list-disc">{children}</ul>
                          ),
                          li: ({ children }) => (
                            <li className="text-muted-foreground">{children}</li>
                          ),
                        }}
                      >
                        {selectedAnalysis.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Recommendations */}
                  {selectedAnalysis.recommendations &&
                    selectedAnalysis.recommendations.length > 0 && (
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">Raccomandazioni</p>
                        </div>
                        <ul className="space-y-2">
                          {selectedAnalysis.recommendations.map(
                            (rec: string, i: number) => (
                              <li
                                key={i}
                                className="text-sm text-muted-foreground flex items-start gap-2"
                              >
                                <span className="text-primary font-medium shrink-0">
                                  {i + 1}.
                                </span>
                                {rec}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4" />
                  <p>Seleziona un&apos;analisi per visualizzare i dettagli</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
