export type AlertType = "price_above" | "price_below" | "percent_change" | "volume_spike" | "technical_signal";
export type AlertStatus = "active" | "triggered" | "paused" | "expired";
export type NotificationChannel = "email" | "telegram" | "in_app";

export interface Alert {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  name: string;
  type: AlertType;
  condition: AlertCondition;
  status: AlertStatus;
  channels: NotificationChannel[];
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertCondition {
  threshold: number;
  indicator?: string;
  signal?: string;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  triggeredAt: string;
  priceAtTrigger: number;
  message: string;
  notified: boolean;
}

export interface CreateAlertInput {
  assetId: string;
  type: AlertType;
  condition: AlertCondition;
  channels: NotificationChannel[];
}

export interface UpdateAlertInput {
  type?: AlertType;
  condition?: AlertCondition;
  status?: AlertStatus;
  channels?: NotificationChannel[];
}
