"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Brain, TrendingUp, TrendingDown, Newspaper, BarChart3, Briefcase, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SentimentScore {
  value: number;
  label: string;
  source: string;
}

interface AggregatedSentiment {
  overall: {
    value: number;
    label: string;
    classification: string;
  };
  fearGreedIndex: SentimentScore | null;
  newsSentiment: SentimentScore | null;
  technicalSentiment: SentimentScore | null;
  portfolioSentiment: SentimentScore | null;
  lastUpdated: string;
}

function SentimentBar({ value, label, source, icon: Icon }: { value: number; label: string; source: string; icon: any }) {
  const getColor = (val: number) => {
    if (val >= 60) return "bg-green-500";
    if (val >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {source}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function SentimentGauge() {
  const [sentiment, setSentiment] = useState<AggregatedSentiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(5);
  const [nextRefresh, setNextRefresh] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSentiment = useCallback(async () => {
    try {
      const data = await api.getSentiment();
      setSentiment(data);
    } catch {
      // Fallback: try to get from latest analysis
      try {
        const analysis = await api.getLatestAnalysis();
        if (analysis?.sentiment) {
          const classificationToValue: Record<string, number> = {
            very_bullish: 85,
            bullish: 70,
            neutral: 50,
            bearish: 30,
            very_bearish: 15,
          };
          setSentiment({
            overall: {
              value: classificationToValue[analysis.sentiment] || 50,
              label: analysis.sentiment === "very_bullish" ? "Molto Rialzista" :
                     analysis.sentiment === "bullish" ? "Rialzista" :
                     analysis.sentiment === "bearish" ? "Ribassista" :
                     analysis.sentiment === "very_bearish" ? "Molto Ribassista" : "Neutrale",
              classification: analysis.sentiment,
            },
            fearGreedIndex: null,
            newsSentiment: null,
            technicalSentiment: null,
            portfolioSentiment: null,
            lastUpdated: analysis.createdAt,
          });
        }
      } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch settings and sentiment on mount
  useEffect(() => {
    api.getSettings()
      .then((settings) => {
        setRefreshInterval(settings.sentimentRefreshInterval);
      })
      .catch(() => {});
    fetchSentiment();
  }, [fetchSentiment]);

  // Setup auto-refresh interval
  useEffect(() => {
    // Clear existing intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (refreshInterval > 0) {
      const intervalMs = refreshInterval * 60 * 1000;

      // Set next refresh time
      setNextRefresh(refreshInterval * 60);

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setNextRefresh((prev) => {
          if (prev === null || prev <= 1) return refreshInterval * 60;
          return prev - 1;
        });
      }, 1000);

      // Refresh interval
      intervalRef.current = setInterval(() => {
        fetchSentiment();
        setNextRefresh(refreshInterval * 60);
      }, intervalMs);
    } else {
      setNextRefresh(null);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [refreshInterval, fetchSentiment]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSentiment();
    if (refreshInterval > 0) {
      setNextRefresh(refreshInterval * 60);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Sentiment di Mercato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-3 bg-muted rounded-full" />
            <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
            <div className="space-y-3">
              <div className="h-2 bg-muted rounded-full" />
              <div className="h-2 bg-muted rounded-full" />
              <div className="h-2 bg-muted rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sentiment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Sentiment di Mercato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Nessun dato disponibile</p>
            <p className="text-sm">Genera un'analisi AI per visualizzare il sentiment.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { overall, fearGreedIndex, newsSentiment, technicalSentiment, portfolioSentiment } = sentiment;

  const getOverallColor = (val: number) => {
    if (val >= 60) return "text-green-500";
    if (val >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getIndicatorPosition = (val: number) => {
    return Math.max(5, Math.min(95, val));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Market Sentiment
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main gauge */}
        <div className="space-y-2">
          <div className="relative h-4 rounded-full overflow-hidden bg-gradient-to-r from-red-500 via-yellow-500 to-green-500">
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-foreground shadow-lg transition-all duration-500"
              style={{ left: `${getIndicatorPosition(overall.value)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            <span>Estrema Paura</span>
            <span>Neutrale</span>
            <span>Estrema Avidità</span>
          </div>
        </div>

        {/* Overall score */}
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-2">
            {overall.value >= 50 ? (
              <TrendingUp className={`h-6 w-6 ${getOverallColor(overall.value)}`} />
            ) : (
              <TrendingDown className={`h-6 w-6 ${getOverallColor(overall.value)}`} />
            )}
            <span className={`text-3xl font-bold ${getOverallColor(overall.value)}`}>
              {overall.value}
            </span>
          </div>
          <p className={`text-sm font-medium ${getOverallColor(overall.value)}`}>
            {overall.label}
          </p>
        </div>

        {/* Individual sources */}
        <div className="space-y-3 pt-2 border-t">
          <p className="text-xs text-muted-foreground font-medium">Fonti del sentiment:</p>

          {fearGreedIndex && (
            <SentimentBar
              value={fearGreedIndex.value}
              label={fearGreedIndex.label}
              source={fearGreedIndex.source}
              icon={Brain}
            />
          )}

          {newsSentiment && (
            <SentimentBar
              value={newsSentiment.value}
              label={newsSentiment.label}
              source={newsSentiment.source}
              icon={Newspaper}
            />
          )}

          {technicalSentiment && (
            <SentimentBar
              value={technicalSentiment.value}
              label={technicalSentiment.label}
              source={technicalSentiment.source}
              icon={BarChart3}
            />
          )}

          {portfolioSentiment && (
            <SentimentBar
              value={portfolioSentiment.value}
              label={portfolioSentiment.label}
              source={portfolioSentiment.source}
              icon={Briefcase}
            />
          )}

          {!fearGreedIndex && !newsSentiment && !technicalSentiment && !portfolioSentiment && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Dati dettagliati non disponibili
            </p>
          )}
        </div>

        {/* Last updated & next refresh */}
        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground">
            Aggiornato: {new Date(sentiment.lastUpdated).toLocaleString("it-IT")}
          </p>
          {nextRefresh !== null && (
            <Badge variant="outline" className="text-[10px]">
              Prossimo refresh: {formatCountdown(nextRefresh)}
            </Badge>
          )}
          {refreshInterval === 0 && (
            <Badge variant="secondary" className="text-[10px]">
              Auto-refresh disabilitato
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
