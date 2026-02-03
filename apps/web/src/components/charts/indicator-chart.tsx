"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface Signal {
  indicator: string;
  signal: string;
  value: number;
  description?: string;
}

export function IndicatorChart({ signals }: { signals: Signal[] }) {
  const getSignalVariant = (signal: string) => {
    switch (signal) {
      case "buy":
        return "success" as const;
      case "sell":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Indicatori Tecnici
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun segnale disponibile</p>
          ) : (
            signals.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                <div>
                  <p className="font-medium text-sm">{s.indicator}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.description || `Valore: ${s.value}`}
                  </p>
                </div>
                <Badge variant={getSignalVariant(s.signal)}>
                  {s.signal.toUpperCase()}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
