"use client";

import { useState, useCallback } from "react";
import { AlertCard } from "@/components/alerts/alert-card";
import { SuggestionCard } from "@/components/alerts/suggestion-card";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { EditAlertDialog } from "@/components/alerts/edit-alert-dialog";
import { AcceptAlertDialog } from "@/components/alerts/accept-alert-dialog";
import { RefreshControl } from "@/components/ui/refresh-control";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { Bell, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Labels always in Italian, toggle only changes content language
const labels = {
  title: "Alert",
  subtitle: "Gestisci i tuoi alert su prezzi e segnali tecnici",
  aiSuggestions: "Suggerimenti AI",
  generateSuggestions: "Genera Suggerimenti",
  analyzing: "Analisi...",
  noAlerts: "Nessun alert",
  noAlertsDesc: "Crea il tuo primo alert per ricevere notifiche sui movimenti di prezzo",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAlert, setEditAlert] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [alertsData, suggestionsData] = await Promise.all([
        api.getAlerts(),
        api.getAlertSuggestions(),
      ]);
      setAlerts(alertsData || []);
      setSuggestions(suggestionsData || []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastUpdate } = usePolling(fetchData);


  const handleCreate = async (data: any) => {
    try {
      await api.createAlert(data);
      fetchData();
    } catch {
      // Handle error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAlert(id);
      // Ricarica tutto per mostrare il suggerimento ripristinato
      fetchData();
    } catch {
      // Handle error
    }
  };

  const handleToggle = async (id: string, status: string) => {
    try {
      await api.updateAlert(id, { status });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch {
      // Handle error
    }
  };

  const handleEdit = (alert: any) => {
    setEditAlert(alert);
    setEditOpen(true);
  };

  const handleSaveEdit = async (id: string, data: any) => {
    try {
      await api.updateAlert(id, data);
      fetchData();
    } catch {
      // Handle error
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
      type: string;
      threshold: number;
      channels: string[];
    }
  ) => {
    // Rimuovi subito dalla UI per feedback immediato
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    try {
      await api.acceptSuggestion(suggestionId, params);
      fetchData(); // Ricarica tutto
    } catch (err) {
      console.error("Errore nell'accept:", err);
      fetchData(); // Ricarica tutto
    }
  };

  const handleDismissSuggestion = async (id: string) => {
    // Rimuovi subito dalla UI per feedback immediato
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.dismissSuggestion(id);
    } catch (err) {
      console.error("Errore nel dismiss:", err);
      fetchData(); // Ricarica tutto
    }
  };

  const handleRefreshSuggestions = async () => {
    setRefreshing(true);
    try {
      await api.triggerAlertSuggestions();
      // Aspetta un po' e poi ricarica i dati
      setTimeout(() => {
        fetchData();
        setRefreshing(false);
      }, 3000);
    } catch (err) {
      console.error("Errore nel refresh:", err);
      setRefreshing(false);
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse p-6 rounded-lg border">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
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
        <div className="flex items-center gap-4">
          <RefreshControl lastUpdate={lastUpdate} />
          <CreateAlertDialog onAdd={handleCreate} />
        </div>
      </div>

      {/* Alert Configurati - sempre in cima */}
      {alerts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">I Tuoi Alert</h2>
          </div>
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Suggerimenti AI - sotto gli alert */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <h2 className="text-lg font-semibold">{labels.aiSuggestions}</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshSuggestions}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? labels.analyzing : labels.generateSuggestions}
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={handleAcceptSuggestion}
                onDismiss={handleDismissSuggestion}
              />
            ))}
          </div>
        )}
      </div>

      {/* Messaggio se nessun alert e nessun suggerimento */}
      {alerts.length === 0 && suggestions.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold">{labels.noAlerts}</h2>
          <p className="text-muted-foreground">{labels.noAlertsDesc}</p>
        </div>
      )}

      <EditAlertDialog
        alert={editAlert}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSaveEdit}
      />

      <AcceptAlertDialog
        open={acceptDialogOpen}
        onOpenChange={setAcceptDialogOpen}
        suggestion={selectedSuggestion}
        onConfirm={handleConfirmAcceptSuggestion}
      />
    </div>
  );
}
