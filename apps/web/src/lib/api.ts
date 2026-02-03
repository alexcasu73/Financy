const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type AnalysisType = "portfolio_digest" | "market_overview" | "asset_deep_dive";

export interface UserPreferences {
  riskTolerance: "conservative" | "moderate" | "aggressive";
  timeHorizon: "short" | "medium" | "long";
  goals: "growth" | "income" | "preservation";
  preferredSectors: string[];
  baseCurrency: "EUR" | "USD";
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("financy_token", token);
      // Set cookie for middleware (7 days expiry)
      document.cookie = `financy_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("financy_token");
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("financy_token");
      // Remove cookie
      document.cookie = "financy_token=; path=/; max-age=0";
    }
  }

  async fetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${API_BASE}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) searchParams.set(key, String(value));
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      cache: "no-store", // Disable Next.js caching for real-time data
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `API Error: ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.fetch<{ user: any; accessToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.accessToken);
    return data;
  }

  async register(email: string, password: string, name: string) {
    const data = await this.fetch<{ user: any; accessToken: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.accessToken);
    return data;
  }

  async getMe() {
    return this.fetch<{ id: string; email: string; name: string }>("/api/auth/me");
  }

  // Assets
  async getAssets(params?: { type?: string; sector?: string; search?: string; page?: number; limit?: number }) {
    return this.fetch<any>("/api/assets", { params: params as any });
  }

  async searchAssets(q: string) {
    return this.fetch<{ results: { symbol: string; name: string; type: string; exchange: string; sector?: string; industry?: string }[] }>("/api/assets/search", { params: { q } });
  }

  async importAsset(data: { symbol: string; name: string; type: string; exchange?: string; sector?: string; industry?: string }) {
    return this.fetch<any>("/api/assets/import", { method: "POST", body: JSON.stringify(data) });
  }

  async deleteAsset(id: string) {
    return this.fetch<void>(`/api/assets/${id}`, { method: "DELETE" });
  }

  async getAsset(id: string) {
    return this.fetch<any>(`/api/assets/${id}`);
  }

  async getAssetPrices(id: string, period?: string) {
    return this.fetch<any[]>(`/api/assets/${id}/prices`, { params: { period } });
  }

  async getAssetSignals(id: string) {
    return this.fetch<any[]>(`/api/assets/${id}/signals`);
  }

  // Portfolios
  async getPortfolios() {
    return this.fetch<any[]>("/api/portfolios");
  }

  async createPortfolio(data: { name: string; description?: string }) {
    return this.fetch<any>("/api/portfolios", { method: "POST", body: JSON.stringify(data) });
  }

  async getPortfolio(id: string) {
    return this.fetch<any>(`/api/portfolios/${id}`);
  }

  // Holdings
  async getHoldings(portfolioId: string) {
    return this.fetch<any[]>(`/api/portfolios/${portfolioId}/holdings`);
  }

  async addHolding(portfolioId: string, data: { assetId: string; quantity: number; avgBuyPrice: number }) {
    return this.fetch<any>(`/api/portfolios/${portfolioId}/holdings`, { method: "POST", body: JSON.stringify(data) });
  }

  async updateHolding(id: string, data: { assetId?: string; quantity?: number; avgBuyPrice?: number }) {
    return this.fetch<any>(`/api/holdings/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteHolding(id: string) {
    return this.fetch<void>(`/api/holdings/${id}`, { method: "DELETE" });
  }

  // Alerts
  async getAlerts() {
    return this.fetch<any[]>("/api/alerts");
  }

  async createAlert(data: any) {
    return this.fetch<any>("/api/alerts", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAlert(id: string, data: any) {
    return this.fetch<any>(`/api/alerts/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteAlert(id: string) {
    return this.fetch<void>(`/api/alerts/${id}`, { method: "DELETE" });
  }

  async getAlertHistory(id: string) {
    return this.fetch<any[]>(`/api/alerts/${id}/history`);
  }

  async getAlertTracking(id: string) {
    return this.fetch<{
      alertId: string;
      symbol: string;
      alertType: string;
      threshold: number;
      currentPrice: number | null;
      isTracking: boolean;
      trackingStartedAt: string | null;
      tracks: Array<{
        price: number;
        threshold: number;
        recordedAt: string;
      }>;
    }>(`/api/alerts/${id}/tracking`);
  }

  // Notifications
  async getNotifications(limit?: number) {
    return this.fetch<any[]>("/api/notifications", { params: { limit } });
  }

  async getUnreadCount() {
    return this.fetch<{ count: number }>("/api/notifications/unread-count");
  }

  async markAllRead() {
    return this.fetch<{ success: boolean }>("/api/notifications/read-all", { method: "PUT" });
  }

  async markNotificationRead(id: string) {
    return this.fetch<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PUT" });
  }

  async dismissNotification(id: string) {
    return this.fetch<{ success: boolean }>(`/api/notifications/${id}`, { method: "DELETE" });
  }

  // Analysis
  async getAnalyses() {
    return this.fetch<any[]>("/api/analysis");
  }

  async getLatestAnalysis() {
    return this.fetch<any>("/api/analysis/latest");
  }

  async requestAnalysis(data: {
    type: "portfolio_digest" | "market_overview" | "asset_deep_dive" | "market_digest" | "asset_analysis";
    assetId?: string;
    assetIds?: string[];
    preferences?: {
      riskTolerance: "conservative" | "moderate" | "aggressive";
      timeHorizon: "short" | "medium" | "long";
      goals: "growth" | "income" | "preservation";
      preferredSectors: string[];
      baseCurrency: "EUR" | "USD";
    };
    prompt?: string;
  }) {
    return this.fetch<any>("/api/analysis/request", { method: "POST", body: JSON.stringify(data) });
  }

  async deleteAnalysis(id: string) {
    return this.fetch<{ success: boolean }>(`/api/analysis/${id}`, { method: "DELETE" });
  }

  // News
  async getNews(query?: string) {
    return this.fetch<any[]>("/api/news", { params: { query } });
  }

  async fetchAndTranslateNews(query?: string) {
    return this.fetch<{ imported: number; total: number }>("/api/news/fetch", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }

  async triggerNewsImport() {
    return this.fetch<{ success: boolean; imported?: number; total?: number }>("/api/news/trigger", { method: "POST" });
  }

  // Indicators
  async getIndicators() {
    return this.fetch<any[]>("/api/indicators");
  }

  // Watchlists
  async getWatchlists() {
    return this.fetch<any[]>("/api/watchlists");
  }

  async createWatchlist(data: { name: string; assetIds: string[] }) {
    return this.fetch<any>("/api/watchlists", { method: "POST", body: JSON.stringify(data) });
  }

  async updateWatchlist(id: string, data: { name?: string; assetIds?: string[] }) {
    return this.fetch<any>(`/api/watchlists/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  // Alert Suggestions
  async getAlertSuggestions() {
    return this.fetch<any[]>("/api/alert-suggestions");
  }

  async acceptSuggestion(
    id: string,
    params?: {
      type?: string;
      threshold?: number;
      channels?: string[];
    }
  ) {
    return this.fetch<any>(`/api/alert-suggestions/${id}/accept`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  }

  async dismissSuggestion(id: string) {
    return this.fetch<any>(`/api/alert-suggestions/${id}/dismiss`, { method: "PUT" });
  }

  async triggerAlertSuggestions() {
    return this.fetch<{ message: string; status: string }>("/api/alert-suggestions/trigger", { method: "POST" });
  }

  // Settings
  async getSettings() {
    return this.fetch<{
      id: string;
      userId: string;
      alertSuggestionThreshold: number;
      alertSuggestionInterval: number;
      sentimentRefreshInterval: number;
      createdAt: string;
      updatedAt: string;
    }>("/api/settings");
  }

  async updateSettings(data: { alertSuggestionThreshold?: number; alertSuggestionInterval?: number; sentimentRefreshInterval?: number }) {
    return this.fetch<{
      id: string;
      userId: string;
      alertSuggestionThreshold: number;
      alertSuggestionInterval: number;
      sentimentRefreshInterval: number;
      createdAt: string;
      updatedAt: string;
    }>("/api/settings", { method: "PUT", body: JSON.stringify(data) });
  }

  // Sentiment
  async getSentiment() {
    return this.fetch<{
      overall: {
        value: number;
        label: string;
        classification: string;
      };
      fearGreedIndex: { value: number; label: string; source: string } | null;
      newsSentiment: { value: number; label: string; source: string } | null;
      technicalSentiment: { value: number; label: string; source: string } | null;
      portfolioSentiment: { value: number; label: string; source: string } | null;
      lastUpdated: string;
    }>("/api/sentiment");
  }

  // Trading
  async getTradingProfile() {
    return this.fetch<{
      id: string;
      userId: string;
      horizon: string;
      riskTolerance: string;
      targetProfitPct: number;
      maxLossPct: number;
      preferredSectors: string[];
      investmentPerTrade: number | null;
      analysisInterval: number;
      suggestionInterval: number;
      createdAt: string;
      updatedAt: string;
    } | null>("/api/trading/profile");
  }

  async createTradingProfile(data: {
    horizon: "short" | "medium" | "long";
    riskTolerance: "conservative" | "moderate" | "aggressive";
    targetProfitPct: number;
    maxLossPct: number;
    preferredSectors: string[];
    investmentPerTrade?: number;
    analysisInterval?: number;
    suggestionInterval?: number;
    resuggestDismissedAfterDays?: number;
  }) {
    return this.fetch<any>("/api/trading/profile", { method: "POST", body: JSON.stringify(data) });
  }

  async updateTradingProfile(data: Partial<{
    horizon: string;
    riskTolerance: string;
    targetProfitPct: number;
    maxLossPct: number;
    preferredSectors: string[];
    investmentPerTrade: number;
    analysisInterval: number;
    suggestionInterval: number;
    resuggestDismissedAfterDays: number;
  }>) {
    return this.fetch<any>("/api/trading/profile", { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteTradingProfile() {
    return this.fetch<void>("/api/trading/profile", { method: "DELETE" });
  }

  // Trading Cash Balance
  async getTradingBalance() {
    return this.fetch<{ cashBalance: number }>("/api/trading/balance");
  }

  async depositFunds(amount: number) {
    return this.fetch<{ cashBalance: number; deposited: number }>("/api/trading/balance/deposit", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async withdrawFunds(amount: number) {
    return this.fetch<{ cashBalance: number; withdrawn: number }>("/api/trading/balance/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async getTradingAssets() {
    return this.fetch<any[]>("/api/trading/assets");
  }

  async addTradingAsset(assetId: string) {
    return this.fetch<any>("/api/trading/assets", { method: "POST", body: JSON.stringify({ assetId }) });
  }

  async executeBuy(tradingAssetId: string, quantity: number) {
    return this.fetch<any>(`/api/trading/assets/${tradingAssetId}/buy`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    });
  }

  async executeSell(tradingAssetId: string) {
    return this.fetch<any>(`/api/trading/assets/${tradingAssetId}/sell`, { method: "PUT" });
  }

  async removeTradingAsset(id: string) {
    return this.fetch<void>(`/api/trading/assets/${id}`, { method: "DELETE" });
  }

  async getTradingSignals() {
    return this.fetch<any[]>("/api/trading/signals");
  }

  async executeSignal(signalId: string) {
    return this.fetch<any>(`/api/trading/signals/${signalId}/execute`, { method: "POST" });
  }

  async triggerTradingAnalysis() {
    return this.fetch<{
      success: boolean;
      message: string;
      suggestions?: Array<{
        symbol: string;
        name: string;
        action: "BUY" | "SELL" | "HOLD";
        confidence: string;
        reason: string;
        currentPrice: number;
        status: string;
      }>;
    }>("/api/trading/analyze", { method: "POST" });
  }

  // Trading Suggestions
  async getTradingSuggestions() {
    return this.fetch<any[]>("/api/trading/suggestions");
  }

  async generateTradingSuggestions() {
    return this.fetch<{ success: boolean; count: number; message: string }>("/api/trading/suggestions/generate", { method: "POST" });
  }

  async acceptTradingSuggestion(
    id: string,
    params?: {
      status?: "watching" | "bought";
      entryPrice?: number;
      quantity?: number;
    }
  ) {
    return this.fetch<any>(`/api/trading/suggestions/${id}/accept`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  }

  async dismissTradingSuggestion(id: string) {
    return this.fetch<{ success: boolean }>(`/api/trading/suggestions/${id}/dismiss`, { method: "PUT" });
  }
}

export const api = new ApiClient();
