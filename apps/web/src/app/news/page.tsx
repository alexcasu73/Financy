"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { Newspaper, Search, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Labels always in Italian, toggle only changes content language
const labels = {
  title: "Notizie",
  subtitle: "Ultime notizie finanziarie e aggiornamenti di mercato",
  searchPlaceholder: "Cerca notizie...",
  noNews: "Nessuna notizia trovata",
  noNewsDesc: "Prova una ricerca diversa o ricontrolla più tardi.",
  importNews: "Importa Notizie",
  importing: "Importazione...",
};

const sentimentColors: Record<string, string> = {
  very_bullish: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  bullish: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200",
  neutral: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-200",
  bearish: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200",
  very_bearish: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

export default function NewsPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lang, setLang] = useState<"it" | "en">("it");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async (query?: string) => {
    try {
      const data = await api.getNews(query || undefined);
      setNews(data || []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchNews(search || undefined);
    }, 500);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleImportNews = async () => {
    setImporting(true);
    setError(null);
    try {
      await api.triggerNewsImport();
      // Wait a bit for n8n to finish processing
      setTimeout(async () => {
        await fetchNews();
        setImporting(false);
      }, 3000);
    } catch (err: any) {
      console.error("Failed to trigger news import:", err);
      setError("Importazione fallita: n8n non disponibile");
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{labels.title}</h1>
          <p className="text-muted-foreground">{labels.subtitle}</p>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{labels.title}</h1>
          <p className="text-muted-foreground">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setLang("it")}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                lang === "it"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              IT
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                lang === "en"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              EN
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportNews}
            disabled={importing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${importing ? "animate-spin" : ""}`} />
            {importing ? labels.importing : labels.importNews}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={labels.searchPlaceholder}
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {news.length === 0 ? (
          <div className="text-center py-12">
            <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium">{labels.noNews}</p>
            <p className="text-sm text-muted-foreground">{labels.noNewsDesc}</p>
          </div>
        ) : (
          news.map((item, index) => {
            // Show original (EN) or translated (IT) based on lang
            const displayTitle = lang === "en"
              ? (item.titleOriginal || item.title)
              : item.title;
            const displaySummary = lang === "en"
              ? (item.summaryOriginal || item.summary)
              : item.summary;

            return (
              <Card key={item.id || index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {item.source}
                        </Badge>
                        {item.sentiment && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                              sentimentColors[item.sentiment] || ""
                            }`}
                          >
                            {item.sentiment.replace("_", " ")}
                          </span>
                        )}
                        {item.publishedAt && (
                          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                            {timeAgo(item.publishedAt)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-base mb-1">
                        {displayTitle}
                      </h3>
                      {displaySummary && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {displaySummary}
                        </p>
                      )}
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
