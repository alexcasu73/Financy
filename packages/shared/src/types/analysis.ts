export type AnalysisType =
  | "portfolio_digest"
  | "market_overview"
  | "asset_deep_dive"
  | "market_digest"
  | "asset_analysis"
  | "portfolio_review"
  | "news_sentiment";

export type Sentiment = "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";

export interface UserPreferences {
  riskTolerance: "conservative" | "moderate" | "aggressive";
  timeHorizon: "short" | "medium" | "long";
  goals: "growth" | "income" | "preservation";
  preferredSectors: string[];
  baseCurrency: "EUR" | "USD";
}

export interface Analysis {
  id: string;
  type: AnalysisType;
  title: string;
  summary: string;
  content: string;
  sentiment?: Sentiment;
  recommendations?: string[];
  assets?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AnalysisRequest {
  type: AnalysisType;
  assetId?: string;
  assetIds?: string[];
  preferences?: UserPreferences;
  prompt?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl?: string;
  sentiment?: Sentiment;
  relatedAssets?: string[];
  publishedAt: string;
  fetchedAt: string;
}

export interface EconomicIndicator {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  unit: string;
  country: string;
  source: string;
  date: string;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWatchlistInput {
  name: string;
  assetIds: string[];
}

export interface UpdateWatchlistInput {
  name?: string;
  assetIds?: string[];
}
