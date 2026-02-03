"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { Bell, ArrowUp, ArrowDown, Activity } from "lucide-react";

interface Alert {
  id: string;
  symbol: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
}

export function RecentAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAlerts()
      .then((data) => {
        const recent = (data || [])
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5);
        setAlerts(recent);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "price_above":
        return ArrowUp;
      case "price_below":
        return ArrowDown;
      default:
        return Activity;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alert Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-3 rounded-lg bg-accent/50">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alert Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Nessun alert</p>
            <p className="text-sm">Crea degli alert per ricevere notifiche sulle variazioni di prezzo.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Recent Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-accent/50"
              >
                <div className="mt-0.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{alert.symbol}</span>
                    <Badge
                      variant={alert.status === "triggered" ? "destructive" : "secondary"}
                    >
                      {alert.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {alert.message}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
                  {timeAgo(alert.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
