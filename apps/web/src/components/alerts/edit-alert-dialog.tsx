"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Alert {
  id: string;
  symbol: string;
  name: string;
  type: string;
  condition: { threshold: number };
  channels: string[];
}

interface EditAlertDialogProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { type?: string; condition?: { threshold: number }; channels?: string[] }) => void;
}

const typeLabels: Record<string, string> = {
  price_above: "Prezzo sopra",
  price_below: "Prezzo sotto",
  percent_change: "Variazione %",
  volume_spike: "Picco volume",
};

const channelLabels: Record<string, string> = {
  in_app: "In-App",
  email: "Email",
  telegram: "Telegram",
};

export function EditAlertDialog({ alert, open, onOpenChange, onSave }: EditAlertDialogProps) {
  const [type, setType] = useState("price_above");
  const [threshold, setThreshold] = useState("");
  const [channels, setChannels] = useState<string[]>(["in_app"]);

  useEffect(() => {
    if (alert) {
      setType(alert.type);
      setThreshold(String(alert.condition.threshold));
      setChannels(alert.channels || ["in_app"]);
    }
  }, [alert]);

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const handleSubmit = () => {
    if (!alert || !threshold) return;
    onSave(alert.id, {
      type,
      condition: { threshold: parseFloat(threshold) },
      channels,
    });
    onOpenChange(false);
  };

  if (!alert) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica Alert</DialogTitle>
          <DialogDescription>
            Modifica l&apos;alert per {alert.symbol}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo di Alert</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(typeLabels).map(([value, label]) => (
                <Badge
                  key={value}
                  variant={type === value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setType(value)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Soglia</label>
            <Input
              type="number"
              placeholder="0.00"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Canali di Notifica</label>
            <div className="flex gap-2">
              {Object.entries(channelLabels).map(([value, label]) => (
                <Badge
                  key={value}
                  variant={channels.includes(value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleChannel(value)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={!threshold}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
