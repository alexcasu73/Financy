"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatEur } from "@/lib/utils";

interface AcceptAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: {
    id: string;
    symbol: string;
    name: string;
    type: string;
    threshold: number;
    currentPrice?: number;
    reason: string;
    asset?: {
      currency?: string;
    };
  } | null;
  onConfirm: (suggestionId: string, params: {
    type: string;
    threshold: number;
    channels: string[];
  }) => Promise<void>;
}

const typeLabels: Record<string, string> = {
  price_above: "Prezzo sopra",
  price_below: "Prezzo sotto",
  percent_change: "Variazione %",
  volume_spike: "Picco volume",
};

const channelLabels: Record<string, string> = {
  in_app: "In-App",
  telegram: "Telegram",
  email: "Email",
};

export function AcceptAlertDialog({
  open,
  onOpenChange,
  suggestion,
  onConfirm,
}: AcceptAlertDialogProps) {
  const [type, setType] = useState("");
  const [threshold, setThreshold] = useState("");
  const [channels, setChannels] = useState<string[]>(["in_app"]);
  const [loading, setLoading] = useState(false);

  // Pre-compila i campi quando il suggerimento cambia
  useEffect(() => {
    if (suggestion && open) {
      setType(suggestion.type);
      setThreshold(suggestion.threshold.toFixed(2));
      setChannels(["in_app"]);
    }
  }, [suggestion, open]);

  const handleSubmit = async () => {
    if (!suggestion) return;

    if (!type) {
      alert("Seleziona un tipo di alert");
      return;
    }

    const thresholdValue = parseFloat(threshold);
    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      alert("Inserisci una soglia valida");
      return;
    }

    if (channels.length === 0) {
      alert("Seleziona almeno un canale di notifica");
      return;
    }

    setLoading(true);
    try {
      await onConfirm(suggestion.id, {
        type,
        threshold: thresholdValue,
        channels,
      });
      onOpenChange(false);

      // Reset form
      setType("");
      setThreshold("");
      setChannels(["in_app"]);
    } catch (error) {
      console.error("Error accepting alert:", error);
      alert("Errore nell'accettazione dell'alert");
    } finally {
      setLoading(false);
    }
  };

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && suggestion) {
      setType(suggestion.type);
      setThreshold(suggestion.threshold.toFixed(2));
      setChannels(["in_app"]);
    }
    onOpenChange(newOpen);
  };

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  if (!suggestion) return null;

  // Currency handling
  const currency = suggestion.asset?.currency || "USD";
  const isEurAsset = currency === "EUR";
  const eurRate = isEurAsset ? 1 : 0.92;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Configura Alert</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Asset info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-lg">{suggestion.symbol}</p>
                <p className="text-sm text-muted-foreground">{suggestion.name}</p>
              </div>
              {suggestion.currentPrice && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Prezzo attuale</p>
                  <p className="font-bold">{formatEur(suggestion.currentPrice * eurRate)}</p>
                  {!isEurAsset && (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(suggestion.currentPrice, currency)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {typeLabels[suggestion.type] || suggestion.type}
            </p>
          </div>

          {/* Reason */}
          <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1">
              Motivo del suggerimento:
            </p>
            <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
          </div>

          {/* Alert Type */}
          <div className="space-y-2">
            <Label>Tipo di Alert</Label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(typeLabels).map(([value, label]) => (
                <Badge
                  key={value}
                  variant={type === value ? "default" : "outline"}
                  className="cursor-pointer font-normal select-none"
                  onClick={() => setType(value)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Threshold */}
          <div className="space-y-2">
            <Label htmlFor="threshold">Soglia Alert</Label>
            <Input
              id="threshold"
              type="number"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={suggestion.threshold.toFixed(2)}
              autoFocus={false}
            />
            <p className="text-xs text-muted-foreground">
              Valore di prezzo che attiverà l'alert
            </p>
          </div>

          {/* Notification channels */}
          <div className="space-y-2">
            <Label>Canali di Notifica</Label>
            <div className="flex gap-2">
              {Object.entries(channelLabels).map(([value, label]) => (
                <Badge
                  key={value}
                  variant={channels.includes(value) ? "default" : "outline"}
                  className="cursor-pointer font-normal select-none"
                  onClick={() => toggleChannel(value)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creazione..." : "Crea Alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
