export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  totalValue?: number;
  totalCost?: number;
  totalReturn?: number;
  totalReturnPercent?: number;
  holdings?: Holding[];
  createdAt: string;
  updatedAt: string;
}

export interface Holding {
  id: string;
  portfolioId: string;
  assetId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice?: number;
  currentValue?: number;
  totalCost: number;
  profitLoss?: number;
  profitLossPercent?: number;
  weight?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortfolioInput {
  name: string;
  description?: string;
}

export interface AddHoldingInput {
  assetId: string;
  quantity: number;
  avgBuyPrice: number;
}

export interface UpdateHoldingInput {
  quantity?: number;
  avgBuyPrice?: number;
}

export interface PortfolioPerformance {
  portfolioId: string;
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
  holdings: HoldingPerformance[];
}

export interface HoldingPerformance {
  holdingId: string;
  symbol: string;
  name: string;
  weight: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}
