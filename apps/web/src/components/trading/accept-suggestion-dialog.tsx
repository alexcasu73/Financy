"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatEur } from "@/lib/utils";

interface AcceptSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: {
    id: string;
    symbol: string;
    name: string;
    currentPriceEur: number | null;
    currentPrice: number | null;
  } | null;
  onConfirm: (suggestionId: string, params: {
    status: "watching" | "bought";
    entryPrice?: number;
    quantity?: number;
  }) => Promise<void>;
}

export function AcceptSuggestionDialog({
  open,
  onOpenChange,
  suggestion,
  onConfirm,
}: AcceptSuggestionDialogProps) {
  const [status, setStatus] = useState<"watching" | "bought">("watching");
  const [entryPrice, setEntryPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);

  const currentPrice = suggestion?.currentPriceEur || suggestion?.currentPrice || 0;

  const handleSubmit = async () => {
    if (!suggestion) return;

    setLoading(true);
    try {
      const params: {
        status: "watching" | "bought";
        entryPrice?: number;
        quantity?: number;
      } = {
        status,
      };

      if (status === "bought") {
        params.entryPrice = parseFloat(entryPrice) || currentPrice;
        if (quantity) {
          params.quantity = parseFloat(quantity);
        }
      }

      await onConfirm(suggestion.id, params);
      onOpenChange(false);

      // Reset form
      setStatus("watching");
      setEntryPrice("");
      setQuantity("");
    } catch (error) {
      console.error("Error accepting suggestion:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && suggestion) {
      setStatus("watching");
      setEntryPrice(currentPrice.toFixed(2));
      setQuantity("");
    }
    onOpenChange(newOpen);
  };

  if (!suggestion) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accetta Suggerimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Asset info */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-semibold">{suggestion.symbol}</p>
            <p className="text-sm text-muted-foreground">{suggestion.name}</p>
            <p className="text-lg font-bold mt-1">{formatEur(currentPrice)}</p>
          </div>

          {/* Status selection */}
          <div className="space-y-3">
            <Label>Stato</Label>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v as "watching" | "bought")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="watching" id="watching" />
                <Label htmlFor="watching" className="font-normal cursor-pointer">
                  Solo osservazione - Tieni d'occhio senza investire
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bought" id="bought" />
                <Label htmlFor="bought" className="font-normal cursor-pointer">
                  Già acquistato - Aggiungi alla posizione
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Entry price and quantity (only if bought) */}
          {status === "bought" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="entryPrice">Prezzo di Entrata (EUR)</Label>
                <Input
                  id="entryPrice"
                  type="number"
                  step="0.01"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder={currentPrice.toFixed(2)}
                />
                <p className="text-xs text-muted-foreground">
                  Prezzo a cui hai acquistato (lascia vuoto per usare il prezzo corrente)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantità (opzionale)</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Es: 10"
                />
                <p className="text-xs text-muted-foreground">
                  Numero di azioni/unità acquistate
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvataggio..." : "Conferma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
