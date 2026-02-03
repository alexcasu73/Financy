"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, TrendingUp, TrendingDown, AlertCircle, Sparkles, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useSocket } from "@/lib/socket-context";
import { timeAgo, formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: {
    alertId?: string;
    assetId?: string;
    symbol?: string;
    currentPrice?: number;
    threshold?: number;
    alertType?: string;
    action?: string;
    confidence?: string;
    symbols?: string[];
    count?: number;
    currency?: string;
  };
  createdAt: string;
}

interface TrackData {
  price: number;
  threshold: number;
  recordedAt: string;
}

interface TrackingInfo {
  isTracking: boolean;
  trackingStartedAt: string | null;
  symbol: string;
  alertType: string;
  threshold: number;
  currentPrice: number | null;
}

// Helper to detect notification category and styling
function getNotificationStyle(notification: Notification) {
  const title = notification.title.toLowerCase();
  const message = notification.message.toLowerCase();

  // Trading signals
  if (title.includes('compra') || message.includes('compra') || title.includes('buy')) {
    return {
      icon: ShoppingCart,
      iconColor: 'text-green-600',
      borderColor: 'border-l-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      badgeColor: 'bg-green-600 text-white',
      label: 'COMPRA',
    };
  }

  if (title.includes('vendi') || message.includes('vendi') || title.includes('sell')) {
    return {
      icon: TrendingDown,
      iconColor: 'text-red-600',
      borderColor: 'border-l-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      badgeColor: 'bg-red-600 text-white',
      label: 'VENDI',
    };
  }

  // AI Suggestions
  if (title.includes('suggerimento') || title.includes('suggestion') || notification.type === 'suggestion') {
    return {
      icon: Sparkles,
      iconColor: 'text-violet-600',
      borderColor: 'border-l-violet-600',
      bgColor: 'bg-violet-50 dark:bg-violet-950/20',
      badgeColor: 'bg-violet-600 text-white',
      label: 'AI',
    };
  }

  // Price alerts
  return {
    icon: AlertCircle,
    iconColor: 'text-orange-600',
    borderColor: 'border-l-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    badgeColor: 'bg-orange-600 text-white',
    label: 'ALERT',
  };
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [trackData, setTrackData] = useState<TrackData[]>([]);
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { onNotification, isConnected } = useSocket();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.getUnreadCount();
      setUnreadCount(data.count);
    } catch {
      // silently fail
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications(20);
      setNotifications(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket real-time notifications
  useEffect(() => {
    const unsubscribe = onNotification((notification: Notification) => {
      // Update or add notification
      setNotifications((prev) => {
        const existingIndex = prev.findIndex(
          (n) => n.data?.alertId && n.data.alertId === notification.data?.alertId
        );
        if (existingIndex >= 0) {
          // Replace existing notification for same alert
          const updated = [...prev];
          updated[existingIndex] = notification;
          return updated;
        }
        // Add new notification at the top
        return [notification, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    });

    return unsubscribe;
  }, [onNotification]);

  // Initial fetch and polling fallback (if WebSocket disconnected)
  useEffect(() => {
    fetchUnreadCount();
    // Only poll if WebSocket is not connected
    if (!isConnected) {
      const interval = setInterval(fetchUnreadCount, 30_000);
      return () => clearInterval(interval);
    }
  }, [fetchUnreadCount, isConnected]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllRead();
      setUnreadCount(0);
      setNotifications([]);
    } catch {
      // silently fail
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification);
    setIsOpen(false);
    setTrackData([]);
    setTrackingInfo(null);

    // Fetch tracking data for the alert
    if (notification.data?.alertId) {
      setLoadingChart(true);
      try {
        const tracking = await api.getAlertTracking(notification.data.alertId);
        setTrackData(tracking.tracks);
        setTrackingInfo({
          isTracking: tracking.isTracking,
          trackingStartedAt: tracking.trackingStartedAt,
          symbol: tracking.symbol,
          alertType: tracking.alertType,
          threshold: tracking.threshold,
          currentPrice: tracking.currentPrice,
        });
      } catch {
        setTrackData([]);
      } finally {
        setLoadingChart(false);
      }
    }

    // Mark as read
    try {
      await api.markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  };

  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  };

  const getAlertTypeLabel = (type?: string) => {
    switch (type) {
      case "price_above":
        return "Prezzo sopra soglia";
      case "price_below":
        return "Prezzo sotto soglia";
      case "percent_change":
        return "Variazione percentuale";
      case "volume_spike":
        return "Picco di volume";
      default:
        return "Alert";
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {isConnected && (
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500" title="Real-time connesso" />
          )}
        </Button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border bg-popover shadow-xl z-50">
            <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">Notifiche</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Segna tutto letto
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Caricamento...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nessuna nuova notifica
                </div>
              ) : (
                notifications.map((n) => {
                  const style = getNotificationStyle(n);
                  const Icon = style.icon;

                  return (
                    <div
                      key={n.id}
                      className={`relative flex items-start gap-3 w-full px-4 py-3.5 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0 cursor-pointer group ${
                        !n.read ? "bg-accent/30" : ""
                      }`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {/* Indicatore colorato laterale */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.borderColor.replace('border-l-', 'bg-')}`} />

                      {/* Icona */}
                      <div className="shrink-0 mt-0.5">
                        <Icon className={`h-5 w-5 ${style.iconColor}`} />
                      </div>

                      {/* Contenuto */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Header: Badge + Titolo */}
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] px-1.5 py-0 h-5 font-bold ${style.badgeColor}`}>
                            {style.label}
                          </Badge>
                          {n.data?.symbol && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                              {n.data.symbol}
                            </Badge>
                          )}
                        </div>

                        {/* Titolo */}
                        <p className="text-sm font-semibold leading-tight">
                          {n.title}
                        </p>

                        {/* Messaggio */}
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {n.message}
                        </p>

                        {/* Info Prezzo */}
                        {n.data?.currentPrice != null && (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="text-xs">
                              <span className="text-muted-foreground">Prezzo: </span>
                              <span className="font-bold">
                                {formatCurrency(n.data.currentPrice, n.data.currency || "EUR")}
                              </span>
                            </div>
                            {n.data.threshold && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">• Soglia: </span>
                                <span className={`font-bold ${style.iconColor}`}>
                                  {formatCurrency(n.data.threshold, n.data.currency || "EUR")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Timestamp */}
                        <p className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>

                      {/* Pulsante elimina */}
                      <button
                        onClick={(e) => handleDismiss(n.id, e)}
                        className="shrink-0 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Elimina"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification Details Dialog */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification?.data?.symbol && (
                <Badge variant="outline">{selectedNotification.data.symbol}</Badge>
              )}
              {selectedNotification?.type === "trading_suggestion"
                ? "Suggerimenti Trading"
                : selectedNotification?.type === "trading"
                ? `Segnale ${selectedNotification.data?.action}`
                : getAlertTypeLabel(selectedNotification?.data?.alertType)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Trading Suggestion - Show message and symbols */}
            {selectedNotification?.type === "trading_suggestion" && (
              <>
                <p className="text-sm">{selectedNotification.message}</p>
                {selectedNotification.data?.symbols && (
                  <div className="flex flex-wrap gap-2">
                    {selectedNotification.data.symbols.map((symbol: string) => (
                      <Badge key={symbol} variant="secondary" className="font-mono">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Vai alla sezione Trading per vedere tutti i dettagli e i suggerimenti completi.
                </p>
              </>
            )}

            {/* Trading Signal - Show action and details */}
            {selectedNotification?.type === "trading" && (
              <>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Azione</span>
                    <Badge className={selectedNotification.data?.action === "BUY" ? "bg-green-600" : "bg-red-600"}>
                      {selectedNotification.data?.action === "BUY" ? "COMPRA" : "VENDI"}
                    </Badge>
                  </div>
                  {selectedNotification.data?.confidence && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Fiducia</span>
                      <span className="text-sm capitalize">{selectedNotification.data.confidence}</span>
                    </div>
                  )}
                  {selectedNotification.data?.currentPrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Prezzo</span>
                      <span className="text-sm font-bold">{formatCurrency(selectedNotification.data.currentPrice, selectedNotification.data.currency || "EUR")}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{selectedNotification.message}</p>
              </>
            )}

            {/* Price Alert - Show tracking chart */}
            {selectedNotification?.data?.alertId && (
              <>
                {/* Tracking status */}
                {trackingInfo && (
                <div className="flex items-center gap-2">
                  {trackingInfo.isTracking ? (
                    <Badge variant="default" className="bg-orange-500">
                      <span className="mr-1 h-2 w-2 rounded-full bg-white animate-pulse inline-block" />
                      Tracciamento attivo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Tracciamento completato</Badge>
                  )}
                  {trackingInfo.trackingStartedAt && (
                    <span className="text-xs text-muted-foreground">
                      dal {new Date(trackingInfo.trackingStartedAt).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}

              {/* Current status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Prezzo attuale</p>
                  <p className="text-2xl font-bold">
                    {trackingInfo?.currentPrice
                      ? formatCurrency(trackingInfo.currentPrice, "EUR")
                      : selectedNotification?.data?.currentPrice
                      ? formatCurrency(selectedNotification.data.currentPrice, selectedNotification.data.currency || "EUR")
                      : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Soglia alert</p>
                  <p className="text-lg font-semibold text-primary">
                    {trackingInfo?.threshold
                      ? formatCurrency(trackingInfo.threshold, "EUR")
                      : selectedNotification?.data?.threshold
                      ? formatCurrency(selectedNotification.data.threshold, selectedNotification.data.currency || "EUR")
                      : "-"}
                  </p>
                </div>
                {(trackingInfo?.currentPrice || selectedNotification?.data?.currentPrice) &&
                 (trackingInfo?.threshold || selectedNotification?.data?.threshold) && (
                  <div className="text-right">
                    {(trackingInfo?.currentPrice ?? selectedNotification?.data?.currentPrice ?? 0) >=
                     (trackingInfo?.threshold ?? selectedNotification?.data?.threshold ?? 0) ? (
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    )}
                  </div>
                )}
              </div>

              {/* Price chart */}
              <div className="h-64">
                {loadingChart ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : trackData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trackData}>
                      <XAxis
                        dataKey="recordedAt"
                        tickFormatter={formatChartDate}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                        width={50}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value, "EUR"), "Prezzo"]}
                        labelFormatter={(label) => new Date(label).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      />
                      {/* Threshold line */}
                      {trackingInfo?.threshold && (
                        <ReferenceLine
                          y={trackingInfo.threshold}
                          stroke="#f97316"
                          strokeDasharray="5 5"
                          label={{
                            value: `Soglia: ${formatCurrency(trackingInfo.threshold, "EUR")}`,
                            position: "right",
                            fontSize: 10,
                            fill: "#f97316",
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nessun dato di tracciamento disponibile
                  </div>
                )}
              </div>

                {/* Message */}
                <p className="text-sm text-muted-foreground">
                  {selectedNotification?.message}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
