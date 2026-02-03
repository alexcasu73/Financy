export type AssetType = "stock" | "crypto" | "etf" | "bond" | "commodity";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  sector?: string;
  exchange?: string;
  currency: string;
  currentPrice?: number;
  previousClose?: number;
  changePercent?: number;
  marketCap?: number;
  volume?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricePoint {
  id: string;
  assetId: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalSignal {
  id: string;
  assetId: string;
  indicator: string;
  signal: "buy" | "sell" | "hold";
  value: number;
  description?: string;
  calculatedAt: string;
}

export interface AssetSearchParams {
  type?: AssetType;
  sector?: string;
  search?: string;
  page?: number;
  limit?: number;
}
