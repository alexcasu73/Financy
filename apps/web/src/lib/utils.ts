import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1e12) {
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: decimals }).format(value / 1e12) + "T";
  }
  if (value >= 1e9) {
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: decimals }).format(value / 1e9) + "B";
  }
  if (value >= 1e6) {
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: decimals }).format(value / 1e6) + "M";
  }
  if (value >= 1e3) {
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: decimals }).format(value / 1e3) + "K";
  }
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function formatDecimal(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("it-IT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(date: string): string {
  // Use try-catch to handle invalid dates gracefully
  try {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 0) return "adesso"; // Handle future dates
    if (seconds < 60) return "adesso";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m fa`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h fa`;
    return `${Math.floor(seconds / 86400)}g fa`;
  } catch {
    return "---";
  }
}
