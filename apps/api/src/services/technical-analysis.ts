interface PriceData {
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface TechnicalResult {
  indicator: string;
  signal: "buy" | "sell" | "hold";
  value: number;
  description: string;
}

export class TechnicalAnalysisService {
  calculateRSI(prices: PriceData[], period: number = 14): TechnicalResult {
    if (prices.length < period + 1) {
      return { indicator: "RSI", signal: "hold", value: 50, description: "Insufficient data" };
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i].close - prices[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i].close - prices[i - 1].close;
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    let signal: "buy" | "sell" | "hold" = "hold";
    let description = `RSI(${period}) = ${rsi.toFixed(2)}`;

    if (rsi < 30) {
      signal = "buy";
      description += " - Oversold territory";
    } else if (rsi > 70) {
      signal = "sell";
      description += " - Overbought territory";
    } else {
      description += " - Neutral zone";
    }

    return { indicator: "RSI", signal, value: +rsi.toFixed(2), description };
  }

  calculateMACD(
    prices: PriceData[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): TechnicalResult {
    if (prices.length < slowPeriod + signalPeriod) {
      return { indicator: "MACD", signal: "hold", value: 0, description: "Insufficient data" };
    }

    const closes = prices.map((p) => p.close);
    const emaFast = this.calculateEMA(closes, fastPeriod);
    const emaSlow = this.calculateEMA(closes, slowPeriod);

    const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
    const validMacd = macdLine.slice(slowPeriod - 1);
    const signalLine = this.calculateEMA(validMacd, signalPeriod);

    const currentMACD = validMacd[validMacd.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const histogram = currentMACD - currentSignal;

    let signal: "buy" | "sell" | "hold" = "hold";
    let description = `MACD = ${currentMACD.toFixed(4)}, Signal = ${currentSignal.toFixed(4)}`;

    if (currentMACD > currentSignal && histogram > 0) {
      signal = "buy";
      description += " - Bullish crossover";
    } else if (currentMACD < currentSignal && histogram < 0) {
      signal = "sell";
      description += " - Bearish crossover";
    }

    return { indicator: "MACD", signal, value: +currentMACD.toFixed(4), description };
  }

  calculateBollingerBands(
    prices: PriceData[],
    period: number = 20,
    stdDev: number = 2
  ): TechnicalResult {
    if (prices.length < period) {
      return { indicator: "BB", signal: "hold", value: 0, description: "Insufficient data" };
    }

    const closes = prices.map((p) => p.close);
    const recentCloses = closes.slice(-period);
    const sma = recentCloses.reduce((a, b) => a + b, 0) / period;
    const variance =
      recentCloses.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);

    const upper = sma + stdDev * sd;
    const lower = sma - stdDev * sd;
    const currentPrice = closes[closes.length - 1];

    let signal: "buy" | "sell" | "hold" = "hold";
    let description = `BB(${period}): Upper=${upper.toFixed(2)}, Middle=${sma.toFixed(2)}, Lower=${lower.toFixed(2)}`;

    if (currentPrice <= lower) {
      signal = "buy";
      description += " - Price at lower band";
    } else if (currentPrice >= upper) {
      signal = "sell";
      description += " - Price at upper band";
    }

    return { indicator: "BB", signal, value: +sma.toFixed(2), description };
  }

  calculateAll(prices: PriceData[]): TechnicalResult[] {
    return [
      this.calculateRSI(prices),
      this.calculateMACD(prices),
      this.calculateBollingerBands(prices),
    ];
  }

  private calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [data[0]];

    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  }
}
