"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Bell, User, Database, Sparkles, Loader2, Brain, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const ANALYSIS_INTERVAL_OPTIONS = [
  { value: 0, label: "Disabilitato" },
  { value: 15, label: "15 minuti" },
  { value: 30, label: "30 minuti" },
  { value: 60, label: "1 ora" },
  { value: 120, label: "2 ore" },
  { value: 240, label: "4 ore" },
  { value: 480, label: "8 ore" },
];

const SUGGESTION_INTERVAL_OPTIONS = [
  { value: 0, label: "Disabilitato" },
  { value: 30, label: "30 minuti" },
  { value: 60, label: "1 ora" },
  { value: 180, label: "3 ore" },
  { value: 360, label: "6 ore" },
  { value: 720, label: "12 ore" },
  { value: 1440, label: "24 ore" },
];

const ALERT_SUGGESTION_INTERVAL_OPTIONS = [
  { value: 0, label: "Disabilitato" },
  { value: 30, label: "30 minuti" },
  { value: 60, label: "1 ora" },
  { value: 180, label: "3 ore" },
  { value: 360, label: "6 ore" },
  { value: 720, label: "12 ore" },
  { value: 1440, label: "24 ore" },
];

const REFRESH_OPTIONS = [
  { value: 0, label: "Disabilitato" },
  { value: 1, label: "1 minuto" },
  { value: 5, label: "5 minuti" },
  { value: 10, label: "10 minuti" },
  { value: 30, label: "30 minuti" },
];

const RESUGGEST_DAYS_OPTIONS = [
  { value: 0, label: "Sempre" },
  { value: 3, label: "3 giorni" },
  { value: 7, label: "7 giorni" },
  { value: 14, label: "14 giorni" },
  { value: 30, label: "30 giorni" },
  { value: 60, label: "60 giorni" },
  { value: 90, label: "90 giorni" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [threshold, setThreshold] = useState<number>(3);
  const [sentimentInterval, setSentimentInterval] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingSentiment, setSavingSentiment] = useState(false);
  const [savedSentiment, setSavedSentiment] = useState(false);
  const [analysisInterval, setAnalysisInterval] = useState<number>(30);
  const [suggestionInterval, setSuggestionInterval] = useState<number>(360);
  const [alertSuggestionInterval, setAlertSuggestionInterval] = useState<number>(360);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState(false);
  const [savingSuggestion, setSavingSuggestion] = useState(false);
  const [savedSuggestion, setSavedSuggestion] = useState(false);
  const [savingAlertSuggestion, setSavingAlertSuggestion] = useState(false);
  const [savedAlertSuggestion, setSavedAlertSuggestion] = useState(false);
  const [tradingProfile, setTradingProfile] = useState<any>(null);
  const [resuggestDismissedAfterDays, setResuggestDismissedAfterDays] = useState<number>(7);
  const [savingResuggestDismissed, setSavingResuggestDismissed] = useState(false);
  const [savedResuggestDismissed, setSavedResuggestDismissed] = useState(false);
  const [errorResuggestDismissed, setErrorResuggestDismissed] = useState<string | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);

  useEffect(() => {
    console.log("=== Loading settings and profile ===");
    Promise.all([
      api.getSettings(),
      api.getTradingProfile().catch(() => null),
    ])
      .then(([settings, profile]) => {
        console.log("Settings from API:", settings);
        console.log("Profile from API:", profile);

        setThreshold(settings.alertSuggestionThreshold);
        setAlertSuggestionInterval(settings.alertSuggestionInterval ?? 360);
        setSentimentInterval(settings.sentimentRefreshInterval);
        if (profile) {
          console.log("Setting analysisInterval to:", profile.analysisInterval);
          console.log("Setting suggestionInterval to:", profile.suggestionInterval);
          console.log("Setting resuggestDismissedAfterDays to:", profile.resuggestDismissedAfterDays);
          setTradingProfile(profile);
          setAnalysisInterval(profile.analysisInterval ?? 30);
          setSuggestionInterval(profile.suggestionInterval ?? 360);
          setResuggestDismissedAfterDays(profile.resuggestDismissedAfterDays ?? 7);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSaveThreshold = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({ alertSuggestionThreshold: threshold });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save threshold:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSentiment = async () => {
    setSavingSentiment(true);
    setSavedSentiment(false);
    try {
      await api.updateSettings({ sentimentRefreshInterval: sentimentInterval });
      setSavedSentiment(true);
      setTimeout(() => setSavedSentiment(false), 2000);
    } catch (error) {
      console.error("Failed to save sentiment interval:", error);
    } finally {
      setSavingSentiment(false);
    }
  };

  const [errorAnalysis, setErrorAnalysis] = useState<string | null>(null);
  const [errorSuggestion, setErrorSuggestion] = useState<string | null>(null);
  const [errorAlertSuggestion, setErrorAlertSuggestion] = useState<string | null>(null);

  const handleSaveAnalysisInterval = async () => {
    setSavingAnalysis(true);
    setSavedAnalysis(false);
    setErrorAnalysis(null);
    try {
      console.log("Saving analysisInterval:", analysisInterval);
      const result = await api.updateTradingProfile({ analysisInterval });
      console.log("Save result:", result);
      setSavedAnalysis(true);
      setTimeout(() => setSavedAnalysis(false), 2000);
    } catch (error: any) {
      console.error("Failed to save analysis interval:", error);
      setErrorAnalysis(error.message || "Errore nel salvataggio");
    } finally {
      setSavingAnalysis(false);
    }
  };

  const handleSaveSuggestionInterval = async () => {
    console.log("=== handleSaveSuggestionInterval CALLED ===");
    console.log("Current suggestionInterval state:", suggestionInterval);
    setSavingSuggestion(true);
    setSavedSuggestion(false);
    setErrorSuggestion(null);
    try {
      console.log("Making API call to updateTradingProfile with:", { suggestionInterval });
      const result = await api.updateTradingProfile({ suggestionInterval });
      console.log("API call successful, result:", result);
      setSavedSuggestion(true);
      setTimeout(() => setSavedSuggestion(false), 2000);
    } catch (error: any) {
      console.error("API call FAILED:", error);
      setErrorSuggestion(error.message || "Errore nel salvataggio");
    } finally {
      setSavingSuggestion(false);
      console.log("=== handleSaveSuggestionInterval FINISHED ===");
    }
  };

  const handleSaveAlertSuggestionInterval = async () => {
    console.log("=== handleSaveAlertSuggestionInterval CALLED ===");
    console.log("Current alertSuggestionInterval state:", alertSuggestionInterval);
    setSavingAlertSuggestion(true);
    setSavedAlertSuggestion(false);
    setErrorAlertSuggestion(null);
    try {
      console.log("Making API call to updateSettings with:", { alertSuggestionInterval });
      const result = await api.updateSettings({ alertSuggestionInterval });
      console.log("API call successful, result:", result);
      setSavedAlertSuggestion(true);
      setTimeout(() => setSavedAlertSuggestion(false), 2000);
    } catch (error: any) {
      console.error("API call FAILED:", error);
      setErrorAlertSuggestion(error.message || "Errore nel salvataggio");
    } finally {
      setSavingAlertSuggestion(false);
      console.log("=== handleSaveAlertSuggestionInterval FINISHED ===");
    }
  };

  const handleSaveResuggestDismissedAfterDays = async () => {
    console.log("=== handleSaveResuggestDismissedAfterDays CALLED ===");
    console.log("Current resuggestDismissedAfterDays state:", resuggestDismissedAfterDays);
    setSavingResuggestDismissed(true);
    setSavedResuggestDismissed(false);
    setErrorResuggestDismissed(null);
    try {
      console.log("Making API call to updateTradingProfile with:", { resuggestDismissedAfterDays });
      const result = await api.updateTradingProfile({ resuggestDismissedAfterDays });
      console.log("API call successful, result:", result);
      setSavedResuggestDismissed(true);
      setTimeout(() => setSavedResuggestDismissed(false), 2000);
    } catch (error: any) {
      console.error("API call FAILED:", error);
      setErrorResuggestDismissed(error.message || "Errore nel salvataggio");
    } finally {
      setSavingResuggestDismissed(false);
      console.log("=== handleSaveResuggestDismissedAfterDays FINISHED ===");
    }
  };

  const handleDeleteProfile = async () => {
    if (!confirm("Sei sicuro di voler eliminare il profilo trading? Questa azione è irreversibile.")) {
      return;
    }
    setDeletingProfile(true);
    try {
      await api.deleteTradingProfile();
      setTradingProfile(null);
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting profile:", error);
      alert("Errore nell'eliminazione del profilo: " + (error.message || "Errore sconosciuto"));
    } finally {
      setDeletingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground">Gestisci il tuo account e le preferenze</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Profilo
          </CardTitle>
          <CardDescription>Le informazioni del tuo account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input value={user?.name || ""} disabled placeholder="Il tuo nome" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={user?.email || ""} disabled placeholder="your@email.com" type="email" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Suggerimenti Alert AI
          </CardTitle>
          <CardDescription>Configura i parametri per i suggerimenti automatici degli alert</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Soglia variazione percentuale</label>
            <p className="text-xs text-muted-foreground">
              Gli asset con variazioni superiori a questa soglia verranno analizzati per suggerimenti di alert
            </p>
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Caricamento...</span>
                </div>
              ) : (
                <>
                  <Input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveThreshold} disabled={loading || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvataggio...
                </>
              ) : saved ? (
                "Salvato!"
              ) : (
                "Salva"
              )}
            </Button>
            {saved && <span className="text-sm text-green-600">Impostazione salvata con successo</span>}
          </div>

          <div className="border-t pt-4 mt-4" />

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Frequenza generazione suggerimenti</label>
              <p className="text-xs text-muted-foreground">
                Ogni quanto l&apos;AI analizza i tuoi asset per suggerirti nuovi alert
              </p>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Caricamento...</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ALERT_SUGGESTION_INTERVAL_OPTIONS.map((opt) => (
                  <Badge
                    key={opt.value}
                    variant={alertSuggestionInterval === opt.value ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => setAlertSuggestionInterval(opt.value)}
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveAlertSuggestionInterval} disabled={loading || savingAlertSuggestion}>
                {savingAlertSuggestion ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : savedAlertSuggestion ? (
                  "Salvato!"
                ) : (
                  "Salva"
                )}
              </Button>
              {savedAlertSuggestion && <span className="text-sm text-green-600">Aggiornato</span>}
              {errorAlertSuggestion && <span className="text-sm text-red-600">{errorAlertSuggestion}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Sentiment di Mercato
          </CardTitle>
          <CardDescription>Configura l'aggiornamento automatico del sentiment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Intervallo di aggiornamento</label>
            <p className="text-xs text-muted-foreground">
              Frequenza con cui il sentiment viene aggiornato automaticamente nella dashboard
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Caricamento...</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {REFRESH_OPTIONS.map((opt) => (
                  <Badge
                    key={opt.value}
                    variant={sentimentInterval === opt.value ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => setSentimentInterval(opt.value)}
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveSentiment} disabled={loading || savingSentiment}>
              {savingSentiment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvataggio...
                </>
              ) : savedSentiment ? (
                "Salvato!"
              ) : (
                "Salva"
              )}
            </Button>
            {savedSentiment && <span className="text-sm text-green-600">Impostazione salvata con successo</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Scheduler Trading AI
          </CardTitle>
          <CardDescription>Configura gli intervalli per analisi e suggerimenti automatici</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!tradingProfile ? (
            <p className="text-sm text-muted-foreground">
              Crea un profilo trading dalla pagina Trading per configurare lo scheduler.
            </p>
          ) : (
            <>
              {/* Analysis Interval */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Analisi Asset</label>
                  <p className="text-xs text-muted-foreground">
                    Frequenza con cui l&apos;AI analizza i tuoi asset in osservazione e posizioni aperte per generare segnali BUY/SELL
                  </p>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Caricamento...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ANALYSIS_INTERVAL_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={analysisInterval === opt.value ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => setAnalysisInterval(opt.value)}
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveAnalysisInterval} disabled={loading || savingAnalysis}>
                    {savingAnalysis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedAnalysis ? (
                      "Salvato!"
                    ) : (
                      "Salva"
                    )}
                  </Button>
                  {savedAnalysis && <span className="text-sm text-green-600">Aggiornato</span>}
                  {errorAnalysis && <span className="text-sm text-red-600">{errorAnalysis}</span>}
                </div>
              </div>

              <div className="border-t pt-4" />

              {/* Suggestion Interval */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Suggerimenti Nuovi Asset</label>
                  <p className="text-xs text-muted-foreground">
                    Frequenza con cui l&apos;AI genera suggerimenti per nuovi asset da aggiungere al tuo portafoglio
                  </p>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Caricamento...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTION_INTERVAL_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={suggestionInterval === opt.value ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => setSuggestionInterval(opt.value)}
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveSuggestionInterval} disabled={loading || savingSuggestion}>
                    {savingSuggestion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedSuggestion ? (
                      "Salvato!"
                    ) : (
                      "Salva"
                    )}
                  </Button>
                  {savedSuggestion && <span className="text-sm text-green-600">Aggiornato</span>}
                  {errorSuggestion && <span className="text-sm text-red-600">{errorSuggestion}</span>}
                </div>
              </div>

              <div className="border-t pt-4" />

              {/* Resuggest Dismissed After Days */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Risuggerisci Asset Scartati Dopo</label>
                  <p className="text-xs text-muted-foreground">
                    Dopo quanti giorni l&apos;AI può risuggerire asset che hai scartato (dismissed) in precedenza (0 = sempre)
                  </p>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Caricamento...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {RESUGGEST_DAYS_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={resuggestDismissedAfterDays === opt.value ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => setResuggestDismissedAfterDays(opt.value)}
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveResuggestDismissedAfterDays} disabled={loading || savingResuggestDismissed}>
                    {savingResuggestDismissed ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedResuggestDismissed ? (
                      "Salvato!"
                    ) : (
                      "Salva"
                    )}
                  </Button>
                  {savedResuggestDismissed && <span className="text-sm text-green-600">Aggiornato</span>}
                  {errorResuggestDismissed && <span className="text-sm text-red-600">{errorResuggestDismissed}</span>}
                </div>
              </div>

              <div className="border-t pt-4" />

              {/* Delete Profile */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-red-600">Zona Pericolosa</label>
                  <p className="text-xs text-muted-foreground">
                    Elimina il tuo profilo trading. Questa azione è irreversibile.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteProfile}
                  disabled={deletingProfile}
                >
                  {deletingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Eliminazione...
                    </>
                  ) : (
                    "Elimina Profilo Trading"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Chiavi API
            <span className="text-red-500 text-xl">*</span>
          </CardTitle>
          <CardDescription>Configura le chiavi API dei servizi esterni</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Alpha Vantage API Key</label>
            <Input type="password" placeholder="Inserisci chiave API" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">CoinGecko API Key</label>
            <Input type="password" placeholder="Inserisci chiave API" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">NewsAPI Key</label>
            <Input type="password" placeholder="Inserisci chiave API" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Anthropic API Key</label>
            <Input type="password" placeholder="Inserisci chiave API" disabled />
          </div>
          <Button disabled>Salva Chiavi API</Button>
        </CardContent>
      </Card>

      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifiche
            <span className="text-red-500 text-xl">*</span>
          </CardTitle>
          <CardDescription>Configura le preferenze di notifica</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Telegram Bot Token</label>
            <Input type="password" placeholder="Inserisci token bot" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Telegram Chat ID</label>
            <Input placeholder="Inserisci Chat ID" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notifiche Email</label>
            <div className="flex gap-2">
              <Badge variant="outline" className="cursor-not-allowed">Attivate</Badge>
              <Badge variant="outline" className="cursor-not-allowed">Disattivate</Badge>
            </div>
          </div>
          <Button disabled>Salva Impostazioni Notifiche</Button>
        </CardContent>
      </Card>

      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dati
            <span className="text-red-500 text-xl">*</span>
          </CardTitle>
          <CardDescription>Gestisci i tuoi dati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Esporta Dati</p>
              <p className="text-xs text-muted-foreground">Scarica tutti i dati del tuo portafoglio e alert</p>
            </div>
            <Button variant="outline" size="sm" disabled>Esporta</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-destructive">Elimina Account</p>
              <p className="text-xs text-muted-foreground">Elimina permanentemente il tuo account e tutti i dati</p>
            </div>
            <Button variant="destructive" size="sm" disabled>Elimina</Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="text-red-500">*</span> Funzionalità non ancora implementata
      </p>
    </div>
  );
}
