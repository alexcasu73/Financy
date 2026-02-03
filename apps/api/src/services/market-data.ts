import { FastifyInstance } from "fastify";

interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  dayHigh?: number;
  dayLow?: number;
  currency: string;
}

interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// CoinGecko uses full names as IDs, not ticker symbols
const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  XRP: "ripple",
  DOGE: "dogecoin",
  BNB: "binancecoin",
  LTC: "litecoin",
};

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

// ISIN country code to primary exchange code (OpenFIGI format)
const ISIN_COUNTRY_TO_PRIMARY_EXCHANGE: Record<string, string[]> = {
  "US": ["US", "UN", "UQ", "UA", "UP"], // USA - NASDAQ, NYSE
  "CH": ["SW", "VX"],                    // Switzerland - SIX
  "IT": ["IM", "IC", "IF"],              // Italy - Milan
  "DE": ["GR", "GY"],                    // Germany - XETRA
  "FR": ["FP"],                          // France - Paris
  "GB": ["LN"],                          // UK - London
  "NL": ["NA"],                          // Netherlands - Amsterdam
  "ES": ["SM"],                          // Spain - Madrid
  "BE": ["BB"],                          // Belgium - Brussels
  "PT": ["PL"],                          // Portugal - Lisbon
  "AT": ["AV"],                          // Austria - Vienna
  "JP": ["JT"],                          // Japan - Tokyo
  "HK": ["HK"],                          // Hong Kong
  "AU": ["AU"],                          // Australia - ASX
  "CA": ["CT", "CN"],                    // Canada - Toronto
};

// OpenFIGI exchange codes to Yahoo Finance suffixes
const EXCHANGE_TO_YAHOO_SUFFIX: Record<string, string> = {
  // Italy
  "IM": ".MI",  // Milan
  "IC": ".MI",
  "IF": ".MI",
  // Germany
  "GR": ".DE",  // XETRA
  "GF": ".F",   // Frankfurt
  "GS": ".SG",  // Stuttgart
  // France
  "FP": ".PA",  // Paris
  // Spain
  "SM": ".MC",  // Madrid
  // Netherlands
  "NA": ".AS",  // Amsterdam
  // UK
  "LN": ".L",   // London
  // Switzerland
  "SW": ".SW",  // SIX Swiss
  // Belgium
  "BB": ".BR",  // Brussels
  // Portugal
  "PL": ".LS",  // Lisbon
  // Austria
  "AV": ".VI",  // Vienna
  // Canada
  "CT": ".TO",  // Toronto
  "CN": ".V",   // Vancouver
  // Australia
  "AU": ".AX",  // ASX
  // Japan
  "JP": ".T",   // Tokyo
  // Hong Kong
  "HK": ".HK",
};

function mapYahooType(quoteType: string): string {
  switch (quoteType) {
    case "EQUITY": return "stock";
    case "ETF": return "etf";
    case "CRYPTOCURRENCY": return "crypto";
    case "MUTUALFUND": return "fund";
    case "INDEX": return "index";
    case "CURRENCY": return "forex";
    case "FUTURE": return "commodity";
    default: return quoteType?.toLowerCase() || "other";
  }
}

export class MarketDataService {
  constructor(private fastify: FastifyInstance) {}

  // Safe cache helpers that work when Redis is unavailable
  private async cacheGet(key: string): Promise<string | null> {
    if (!this.fastify.redis) return null;
    try {
      return await this.fastify.redis.get(key);
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, ttl: number, value: string): Promise<void> {
    if (!this.fastify.redis) return;
    try {
      await this.fastify.redis.setex(key, ttl, value);
    } catch {
      // Ignore cache errors
    }
  }

  private async cacheDel(key: string): Promise<void> {
    if (!this.fastify.redis) return;
    try {
      await this.fastify.redis.del(key);
    } catch {
      // Ignore cache errors
    }
  }

  // ─── ISIN SUPPORT (OpenFIGI) ────────────────────────────────────────────────

  /**
   * Check if a string looks like an ISIN code.
   * Format: 2 letter country code + 9 alphanumeric + 1 check digit = 12 chars
   * Examples: US0378331005 (Apple), IT0003128367 (Enel), DE0007164600 (SAP)
   */
  private isIsin(query: string): boolean {
    if (query.length !== 12) return false;
    // First 2 chars must be letters (country code)
    if (!/^[A-Z]{2}/.test(query.toUpperCase())) return false;
    // Next 9 chars alphanumeric
    if (!/^[A-Z]{2}[A-Z0-9]{9}/.test(query.toUpperCase())) return false;
    // Last char must be a digit (check digit)
    if (!/\d$/.test(query)) return false;
    return true;
  }

  /**
   * Convert ISIN to ticker symbol using OpenFIGI API (free, Bloomberg-backed)
   * Returns array of matching tickers with exchange info
   */
  async isinToTicker(isin: string): Promise<
    { ticker: string; name: string; exchCode: string; marketSector?: string }[]
  > {
    const cacheKey = `isin:${isin.toUpperCase()}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch("https://api.openfigi.com/v3/mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin.toUpperCase() }]),
      });

      if (!res.ok) {
        this.fastify.log.warn(`OpenFIGI API returned ${res.status} for ISIN ${isin}`);
        return [];
      }

      const data = await res.json();
      const results = data?.[0]?.data || [];

      if (results.length === 0) {
        this.fastify.log.info(`No OpenFIGI results for ISIN ${isin}`);
        return [];
      }

      // Map to simpler format and prefer US exchanges
      const mapped = results
        .filter((r: any) => r.ticker && r.name)
        .map((r: any) => ({
          ticker: r.ticker,
          name: r.name,
          exchCode: r.exchCode || r.marketSector || "",
          marketSector: r.marketSector,
        }));

      // Sort: US exchanges first, then others
      mapped.sort((a: any, b: any) => {
        const aIsUs = a.exchCode === "US" || a.marketSector === "Equity";
        const bIsUs = b.exchCode === "US" || b.marketSector === "Equity";
        if (aIsUs && !bIsUs) return -1;
        if (!aIsUs && bIsUs) return 1;
        return 0;
      });

      // Deduplicate by ticker
      const seen = new Set<string>();
      const deduplicated = mapped.filter((r: any) => {
        if (seen.has(r.ticker)) return false;
        seen.add(r.ticker);
        return true;
      });

      // Cache for 24 hours (ISIN mappings don't change often)
      await this.cacheSet(cacheKey, 86400, JSON.stringify(deduplicated));

      this.fastify.log.info(`OpenFIGI: ISIN ${isin} -> ${deduplicated.length} unique results (first: ${deduplicated[0]?.ticker})`);
      return deduplicated;
    } catch (error) {
      this.fastify.log.error(error, `Failed to lookup ISIN ${isin} on OpenFIGI`);
      return [];
    }
  }

  // ─── SEARCH (Yahoo Finance with local DB fallback) ──────────────────────────────────────

  async searchAssets(query: string): Promise<
    {
      symbol: string;
      name: string;
      type: string;
      exchange: string;
      sector?: string;
      industry?: string;
      isin?: string; // Include ISIN if searched by ISIN
      isPrimary?: boolean; // True if this is the primary exchange for this ISIN
    }[]
  > {
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    // Check if query is an ISIN code
    if (this.isIsin(query)) {
      this.fastify.log.info(`Detected ISIN code: ${query}, looking up via OpenFIGI`);
      const isinResults = await this.isinToTicker(query);

      if (isinResults.length > 0) {
        // Extract country code from ISIN (first 2 chars)
        const isinCountry = query.substring(0, 2).toUpperCase();
        const primaryExchanges = ISIN_COUNTRY_TO_PRIMARY_EXCHANGE[isinCountry] || [];

        // Helper to check if an exchange is primary for this ISIN
        const isPrimaryExchange = (exchCode: string) =>
          primaryExchanges.includes(exchCode);

        // Find the primary exchange result
        const primaryResult = isinResults.find(r => isPrimaryExchange(r.exchCode)) || isinResults[0];
        const suffix = EXCHANGE_TO_YAHOO_SUFFIX[primaryResult.exchCode] || "";
        const yahooSymbol = suffix ? `${primaryResult.ticker}${suffix}` : primaryResult.ticker;

        this.fastify.log.info(`ISIN ${query} (country: ${isinCountry}): primary exchange ${primaryResult.exchCode}, Yahoo symbol ${yahooSymbol}`);

        // Fetch detailed quotes for all unique tickers in parallel
        const uniqueTickers = new Map<string, typeof isinResults[0]>();
        for (const r of isinResults) {
          const rSuffix = EXCHANGE_TO_YAHOO_SUFFIX[r.exchCode] || "";
          const rYahooSymbol = rSuffix ? `${r.ticker}${rSuffix}` : r.ticker;
          if (!uniqueTickers.has(rYahooSymbol)) {
            uniqueTickers.set(rYahooSymbol, r);
          }
        }

        const tickerList = Array.from(uniqueTickers.keys()).slice(0, 5);
        const detailedQuotes = await Promise.all(
          tickerList.map(t => this.getDetailedQuote(t))
        );

        // Build results with isPrimary flag
        const results: {
          symbol: string;
          name: string;
          type: string;
          exchange: string;
          sector?: string;
          industry?: string;
          isin: string;
          isPrimary: boolean;
        }[] = [];

        for (let i = 0; i < tickerList.length; i++) {
          const ticker = tickerList[i];
          const figiData = uniqueTickers.get(ticker)!;
          const detailed = detailedQuotes[i];
          const isPrimary = isPrimaryExchange(figiData.exchCode);

          results.push({
            symbol: detailed?.symbol || ticker,
            name: detailed?.name || figiData.name,
            type: "stock",
            exchange: figiData.exchCode || "",
            sector: detailed?.sector,
            industry: detailed?.industry,
            isin: query.toUpperCase(),
            isPrimary,
          });
        }

        // Sort: primary first, then by exchange code
        results.sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return a.exchange.localeCompare(b.exchange);
        });

        await this.cacheSet(cacheKey, 600, JSON.stringify(results));
        return results;
      }

      // ISIN not found in OpenFIGI, fall through to regular search
      this.fastify.log.warn(`ISIN ${query} not found in OpenFIGI, trying Yahoo search`);
    }

    // Try Yahoo Finance first
    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`,
        { headers: YAHOO_HEADERS }
      );

      // Check if rate limited
      if (res.status === 429) {
        this.fastify.log.warn(`Yahoo Finance rate limited (429), status: ${res.status}, falling back to local DB`);
        return this.searchLocalAssets(query);
      }

      this.fastify.log.info(`Yahoo Finance search response: status=${res.status}`);

      const text = await res.text();

      // Check if response is HTML (error page) instead of JSON
      if (text.startsWith("<!") || text.startsWith("<html") || text.includes("Too Many Requests")) {
        this.fastify.log.warn("Yahoo Finance returned error page, falling back to local DB");
        return this.searchLocalAssets(query);
      }

      const data = JSON.parse(text);
      const quotes = data?.quotes || [];

      const results = quotes
        .filter((q: any) => q.isYahooFinance)
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.longname || q.shortname || q.symbol,
          type: mapYahooType(q.quoteType),
          exchange: q.exchDisp || q.exchange || "",
          sector: q.sectorDisp || undefined,
          industry: q.industryDisp || undefined,
        }));

      // Cache for 10 minutes
      await this.cacheSet(cacheKey, 600, JSON.stringify(results));
      return results;
    } catch (error) {
      this.fastify.log.error(error, `Failed to search Yahoo Finance for "${query}", using local DB`);
      return this.searchLocalAssets(query);
    }
  }

  // Search in local database as fallback
  private async searchLocalAssets(query: string): Promise<
    {
      symbol: string;
      name: string;
      type: string;
      exchange: string;
      sector?: string;
      industry?: string;
    }[]
  > {
    const assets = await this.fastify.prisma.asset.findMany({
      where: {
        OR: [
          { symbol: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 15,
      orderBy: { symbol: "asc" },
    });

    return assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      type: a.type,
      exchange: a.exchange || "",
      sector: a.sector || undefined,
      industry: undefined,
    }));
  }

  // ─── EXCHANGE RATES ───────────────────────────────────────────────

  /**
   * Fetch all exchange rates from ECB (European Central Bank).
   * Returns a map of currency -> rate (e.g., USD -> 1.1919 means 1 EUR = 1.1919 USD).
   * Cached for 1 hour (ECB updates once daily).
   */
  private async getECBRates(): Promise<Record<string, number>> {
    const cacheKey = "fx:ecb:all";

    try {
      const cached = await this.cacheGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Ignore cache errors
    }

    try {
      const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
      const xml = await res.text();

      // Parse XML to extract rates (format: <Cube currency='USD' rate='1.1919'/>)
      const rates: Record<string, number> = { EUR: 1 };
      const regex = /<Cube currency='([A-Z]{3})' rate='([0-9.]+)'\/>/g;
      let match;

      while ((match = regex.exec(xml)) !== null) {
        const currency = match[1];
        const rate = parseFloat(match[2]);
        if (currency && rate > 0) {
          rates[currency] = rate;
        }
      }

      if (!rates.USD) throw new Error("No USD rate in ECB data");

      // Cache for 1 hour (ECB rates update once daily)
      try {
        await this.cacheSet(cacheKey, 3600, JSON.stringify(rates));
      } catch {
        // Ignore cache errors
      }

      this.fastify.log.info(`ECB rates fetched: ${Object.keys(rates).length} currencies`);
      return rates;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch ECB rates");
      throw error;
    }
  }

  /**
   * Get USD to EUR conversion rate from ECB (European Central Bank).
   * Falls back to Yahoo Finance if ECB fails.
   * Cached for 1 hour.
   */
  async getUsdToEurRate(): Promise<number> {
    const FALLBACK_RATE = 0.84; // Approximate USD to EUR rate
    const cacheKey = "fx:usdeur";

    try {
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        const rate = parseFloat(cached);
        if (rate > 0 && rate < 2) return rate; // Sanity check
      }
    } catch (redisError) {
      this.fastify.log.warn("Redis unavailable for FX cache");
    }

    // Try ECB first (official rates)
    try {
      const ecbRates = await this.getECBRates();
      const eurUsd = ecbRates.USD; // 1 EUR = X USD
      const usdToEur = 1 / eurUsd; // 1 USD = X EUR

      // Sanity check: rate should be between 0.5 and 1.5
      if (usdToEur < 0.5 || usdToEur > 1.5) {
        this.fastify.log.warn(`Suspicious USD/EUR rate from ECB: ${usdToEur}`);
        throw new Error("Invalid ECB rate");
      }

      try {
        await this.cacheSet(cacheKey, 3600, usdToEur.toFixed(6));
      } catch {
        // Ignore Redis errors
      }

      this.fastify.log.info(`Exchange rate (ECB): 1 USD = ${usdToEur.toFixed(4)} EUR`);
      return usdToEur;
    } catch (ecbError) {
      this.fastify.log.warn(ecbError, "ECB rates failed, falling back to Yahoo Finance");

      // Fallback to Yahoo Finance
      try {
        const res = await fetch(
          "https://query2.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d",
          { headers: YAHOO_HEADERS }
        );
        const data = await res.json();
        const eurUsd = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (!eurUsd || eurUsd <= 0) throw new Error("No EUR/USD data");

        const usdToEur = 1 / eurUsd;

        if (usdToEur < 0.5 || usdToEur > 1.5) {
          this.fastify.log.warn(`Suspicious USD/EUR rate: ${usdToEur}, using fallback`);
          return FALLBACK_RATE;
        }

        try {
          await this.cacheSet(cacheKey, 120, usdToEur.toFixed(6));
        } catch {
          // Ignore Redis errors
        }

        this.fastify.log.info(`Exchange rate (Yahoo): 1 USD = ${usdToEur.toFixed(4)} EUR`);
        return usdToEur;
      } catch (error) {
        this.fastify.log.error(error, "All FX sources failed, using fallback");
        return FALLBACK_RATE;
      }
    }
  }

  /**
   * Get conversion rate from any currency to EUR.
   * Uses ECB rates first, falls back to Yahoo Finance.
   * Cached for 1 hour per currency pair.
   */
  async getToEurRate(currency: string): Promise<number> {
    if (currency === "EUR") return 1;
    if (currency === "USD") return await this.getUsdToEurRate();

    const cacheKey = `fx:${currency.toLowerCase()}eur`;

    try {
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        const rate = parseFloat(cached);
        if (rate > 0 && rate < 100) return rate; // Sanity check
      }
    } catch {
      // Ignore Redis errors
    }

    // Try ECB first (official rates)
    try {
      const ecbRates = await this.getECBRates();
      if (ecbRates[currency]) {
        const eurToX = ecbRates[currency]; // 1 EUR = X currency
        const xToEur = 1 / eurToX; // 1 currency = X EUR

        if (xToEur > 0 && xToEur < 100) {
          try {
            await this.cacheSet(cacheKey, 3600, xToEur.toFixed(6));
          } catch {
            // Ignore Redis errors
          }
          this.fastify.log.info(`Exchange rate (ECB): 1 ${currency} = ${xToEur.toFixed(4)} EUR`);
          return xToEur;
        }
      }
      throw new Error(`Currency ${currency} not found in ECB rates`);
    } catch (ecbError) {
      this.fastify.log.warn(ecbError, `ECB rates failed for ${currency}, falling back to Yahoo`);

      // Fallback to Yahoo Finance
      try {
        const pair = `${currency}EUR=X`;
        const res = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1d`,
          { headers: YAHOO_HEADERS }
        );
        const data = await res.json();
        const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (!rate || rate <= 0) throw new Error(`No ${currency}/EUR data`);

        try {
          await this.cacheSet(cacheKey, 120, rate.toFixed(6));
        } catch {
          // Ignore Redis errors
        }
        this.fastify.log.info(`Exchange rate (Yahoo): 1 ${currency} = ${rate.toFixed(4)} EUR`);
        return rate;
      } catch (error) {
        this.fastify.log.error(error, `Failed to fetch ${currency}/EUR rate`);
        // Fallback: try via USD as intermediate
        const toUsd = await this.getToUsdRate(currency);
        const usdToEur = await this.getUsdToEurRate();
        return toUsd * usdToEur;
      }
    }
  }

  private async getToUsdRate(currency: string): Promise<number> {
    if (currency === "USD") return 1;
    try {
      const pair = `${currency}USD=X`;
      const res = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1d`,
        { headers: YAHOO_HEADERS }
      );
      const data = await res.json();
      return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 1;
    } catch {
      return 1;
    }
  }

  /**
   * Get EUR conversion rates for all supported currencies.
   * Returns a map of currency code to EUR rate (e.g., USD -> 0.8390 means 1 USD = 0.8390 EUR).
   * Uses ECB rates first, falls back to Yahoo Finance.
   */
  async getEurRates(): Promise<Record<string, number>> {
    const cacheKey = "fx:eurrates";
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      // Try ECB first - get all rates at once
      const ecbRates = await this.getECBRates();
      const toEurRates: Record<string, number> = { EUR: 1 };

      // Convert ECB rates (1 EUR = X currency) to (1 currency = X EUR)
      for (const [currency, eurToX] of Object.entries(ecbRates)) {
        if (currency !== "EUR") {
          toEurRates[currency] = 1 / eurToX;
        }
      }

      // Cache for 1 hour (ECB updates daily)
      await this.cacheSet(cacheKey, 3600, JSON.stringify(toEurRates));
      this.fastify.log.info(`EUR rates cached: ${Object.keys(toEurRates).length} currencies`);
      return toEurRates;
    } catch (error) {
      this.fastify.log.warn(error, "ECB rates failed, using USD only");

      // Fallback: at least get USD rate
      const usdToEur = await this.getUsdToEurRate();
      const rates: Record<string, number> = {
        EUR: 1,
        USD: usdToEur,
      };

      // Cache for 5 minutes
      await this.cacheSet(cacheKey, 300, JSON.stringify(rates));
      return rates;
    }
  }

  // ─── STOCKS (Yahoo Finance) ────────────────────────────────────────

  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `quote:${symbol}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
        { headers: YAHOO_HEADERS }
      );
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        this.fastify.log.warn(`No Yahoo Finance data for ${symbol}`);
        return null;
      }

      const meta = result.meta;
      const price = meta.regularMarketPrice;
      const previousClose = meta.chartPreviousClose;
      const change = price - previousClose;
      const changePercent = (change / previousClose) * 100;

      const quote: StockQuote = {
        symbol: meta.symbol,
        price,
        change: +change.toFixed(2),
        changePercent: +changePercent.toFixed(2),
        volume: meta.regularMarketVolume || 0,
        previousClose,
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        currency: meta.currency || "USD",
      };

      // Cache for 60 seconds (Yahoo Finance is real-time)
      await this.cacheSet(cacheKey, 60, JSON.stringify(quote));
      return quote;
    } catch (error) {
      this.fastify.log.error(error, `Failed to fetch Yahoo Finance quote for ${symbol}`);
      return null;
    }
  }

  async getHistoricalPrices(
    symbol: string,
    period: string = "daily"
  ): Promise<HistoricalPrice[]> {
    const cacheKey = `history:${symbol}:${period}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const range =
        period === "weekly" ? "1y" : period === "monthly" ? "5y" : "3mo";
      const interval =
        period === "weekly" ? "1wk" : period === "monthly" ? "1mo" : "1d";

      const res = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`,
        { headers: YAHOO_HEADERS }
      );
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.timestamp) return [];

      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      const prices: HistoricalPrice[] = timestamps
        .map((ts: number, i: number) => {
          const close = quotes.close[i];
          const open = quotes.open[i];
          if (close == null || open == null) return null;
          return {
            date: new Date(ts * 1000).toISOString().split("T")[0],
            open: +open.toFixed(2),
            high: +(quotes.high[i] || open).toFixed(2),
            low: +(quotes.low[i] || open).toFixed(2),
            close: +close.toFixed(2),
            volume: quotes.volume[i] || 0,
          };
        })
        .filter(Boolean) as HistoricalPrice[];

      // Cache: 1h for daily, 6h for weekly/monthly
      const ttl = period === "daily" ? 3600 : 21600;
      await this.cacheSet(cacheKey, ttl, JSON.stringify(prices));
      return prices;
    } catch (error) {
      this.fastify.log.error(error, `Failed to fetch Yahoo Finance history for ${symbol}`);
      return [];
    }
  }

  // ─── CRYPTO (CoinGecko) ───────────────────────────────────────────

  async getCryptoPrice(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `crypto:${symbol}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const apiKey = process.env.COINGECKO_API_KEY;
    const headers: Record<string, string> = apiKey
      ? { "x-cg-demo-api-key": apiKey }
      : {};

    try {
      const id = CRYPTO_ID_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
        { headers }
      );
      const data = await res.json();
      if (!data[id]) {
        this.fastify.log.warn(`No CoinGecko data for ${symbol} (id: ${id})`);
        return null;
      }

      const price = data[id].usd;
      const changePercent = data[id].usd_24h_change || 0;
      const previousClose = price / (1 + changePercent / 100);

      const quote: StockQuote = {
        symbol: symbol.toUpperCase(),
        price,
        change: +(price - previousClose).toFixed(2),
        changePercent: +changePercent.toFixed(2),
        volume: data[id].usd_24h_vol || 0,
        previousClose: +previousClose.toFixed(2),
        currency: "USD",
      };

      await this.cacheSet(cacheKey, 60, JSON.stringify(quote));
      return quote;
    } catch (error) {
      this.fastify.log.error(error, `Failed to fetch crypto price for ${symbol}`);
      return null;
    }
  }

  // ─── REFRESH ──────────────────────────────────────────────────────

  /**
   * Refresh crypto prices from CoinGecko (single batch call).
   */
  async refreshCryptoPrices(): Promise<{ updated: number; errors: string[] }> {
    const cryptoAssets = await this.fastify.prisma.asset.findMany({
      where: { type: "crypto" },
    });
    let updated = 0;
    const errors: string[] = [];

    if (cryptoAssets.length === 0) return { updated, errors };

    try {
      const ids = cryptoAssets
        .map((a) => CRYPTO_ID_MAP[a.symbol.toUpperCase()] || a.symbol.toLowerCase())
        .join(",");

      const apiKey = process.env.COINGECKO_API_KEY;
      const headers: Record<string, string> = apiKey
        ? { "x-cg-demo-api-key": apiKey }
        : {};

      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
        { headers }
      );
      const data = await res.json();

      for (const asset of cryptoAssets) {
        const id = CRYPTO_ID_MAP[asset.symbol.toUpperCase()] || asset.symbol.toLowerCase();
        if (data[id]) {
          const price = data[id].usd;
          const changePercent = data[id].usd_24h_change || 0;
          const previousClose = price / (1 + changePercent / 100);

          await this.fastify.prisma.asset.update({
            where: { id: asset.id },
            data: {
              currentPrice: price,
              previousClose: +previousClose.toFixed(2),
              changePercent: +changePercent.toFixed(2),
              volume: data[id].usd_24h_vol || asset.volume,
              marketCap: data[id].usd_market_cap || asset.marketCap,
            },
          });
          updated++;
        } else {
          errors.push(`${asset.symbol}: no CoinGecko data`);
        }
      }
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch crypto prices");
      errors.push("CoinGecko batch fetch failed");
    }

    return { updated, errors };
  }

  /**
   * Refresh stock/ETF/commodity prices from Yahoo Finance (parallel, fast, no API key).
   */
  async refreshStockPrices(): Promise<{ updated: number; errors: string[] }> {
    // Clear FX cache and fetch fresh rates before updating stock prices
    try {
      await this.cacheDel("fx:usdeur");
      await this.cacheDel("fx:eurrates");
      await this.cacheDel("fx:ecb:all"); // Clear ECB cache
      await this.getUsdToEurRate(); // Force fresh rate fetch
    } catch {
      // Ignore cache errors
    }

    const stockAssets = await this.fastify.prisma.asset.findMany({
      where: { type: { not: "crypto" } },
    });
    let updated = 0;
    const errors: string[] = [];

    // Fetch all stock quotes in parallel (Yahoo Finance has no strict rate limit)
    const results = await Promise.allSettled(
      stockAssets.map((asset) => this.getStockQuote(asset.symbol))
    );

    for (let i = 0; i < stockAssets.length; i++) {
      const asset = stockAssets[i];
      const result = results[i];

      if (result.status === "fulfilled" && result.value && result.value.price > 0) {
        const quote = result.value;
        await this.fastify.prisma.asset.update({
          where: { id: asset.id },
          data: {
            currentPrice: quote.price,
            previousClose: quote.previousClose,
            changePercent: quote.changePercent,
            volume: quote.volume,
            currency: quote.currency,
          },
        });
        updated++;
      } else {
        const reason = result.status === "rejected" ? result.reason?.message : "no data";
        errors.push(`${asset.symbol}: ${reason}`);
      }
    }

    return { updated, errors };
  }

  /**
   * Refresh all asset prices (crypto + stocks).
   */
  async refreshAllPrices(): Promise<{ updated: number; errors: string[] }> {
    // Clear FX rate cache to force fresh rates
    try {
      await this.cacheDel("fx:usdeur");
      await this.cacheDel("fx:eurrates");
      this.fastify.log.info("Cleared FX rate cache, will fetch fresh rates");
    } catch {
      // Ignore cache errors
    }

    // Fetch fresh EUR rates before refreshing prices
    await this.getUsdToEurRate();
    await this.getEurRates();

    const [crypto, stocks] = await Promise.all([
      this.refreshCryptoPrices(),
      this.refreshStockPrices(),
    ]);

    return {
      updated: crypto.updated + stocks.updated,
      errors: [...crypto.errors, ...stocks.errors],
    };
  }

  // ─── YAHOO FINANCE DISCOVERY ─────────────────────────────────────

  /**
   * Get trending stocks from Yahoo Finance
   */
  async getTrendingStocks(count: number = 20): Promise<
    { symbol: string; name: string; price: number; changePercent: number; volume: number; sector?: string }[]
  > {
    const cacheKey = `trending:stocks:${count}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      // Get trending tickers from Yahoo
      const trendingRes = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/trending/US?count=${count}`,
        { headers: YAHOO_HEADERS }
      );

      if (!trendingRes.ok) {
        this.fastify.log.warn(`Yahoo trending API returned ${trendingRes.status}`);
        return [];
      }

      const trendingData = await trendingRes.json();
      const tickers = trendingData?.finance?.result?.[0]?.quotes || [];

      if (tickers.length === 0) return [];

      // Get quotes for these symbols
      const symbols = tickers.map((t: any) => t.symbol).slice(0, count);
      const quotesRes = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}`,
        { headers: YAHOO_HEADERS }
      );

      if (!quotesRes.ok) {
        this.fastify.log.warn(`Yahoo quote API returned ${quotesRes.status}`);
        return [];
      }

      const quotesData = await quotesRes.json();
      const quotes = quotesData?.quoteResponse?.result || [];

      const results = quotes
        .filter((q: any) => q.quoteType === "EQUITY" && q.regularMarketPrice)
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice,
          changePercent: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          sector: q.sector || undefined,
        }));

      // Cache for 10 minutes
      await this.cacheSet(cacheKey, 600, JSON.stringify(results));
      return results;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch trending stocks");
      return [];
    }
  }

  /**
   * Get top gainers from Yahoo Finance
   */
  async getTopGainers(count: number = 20): Promise<
    { symbol: string; name: string; price: number; changePercent: number; volume: number; sector?: string }[]
  > {
    const cacheKey = `gainers:${count}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=${count}`,
        { headers: YAHOO_HEADERS }
      );

      if (!res.ok) {
        this.fastify.log.warn(`Yahoo gainers API returned ${res.status}`);
        return [];
      }

      const data = await res.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      const results = quotes
        .filter((q: any) => q.quoteType === "EQUITY")
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          sector: q.sector || undefined,
        }));

      await this.cacheSet(cacheKey, 600, JSON.stringify(results));
      return results;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch top gainers");
      return [];
    }
  }

  /**
   * Get top losers from Yahoo Finance (potential buy opportunities)
   */
  async getTopLosers(count: number = 20): Promise<
    { symbol: string; name: string; price: number; changePercent: number; volume: number; sector?: string }[]
  > {
    const cacheKey = `losers:${count}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_losers&count=${count}`,
        { headers: YAHOO_HEADERS }
      );

      if (!res.ok) {
        this.fastify.log.warn(`Yahoo losers API returned ${res.status}`);
        return [];
      }

      const data = await res.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      const results = quotes
        .filter((q: any) => q.quoteType === "EQUITY")
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          sector: q.sector || undefined,
        }));

      await this.cacheSet(cacheKey, 600, JSON.stringify(results));
      return results;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch top losers");
      return [];
    }
  }

  /**
   * Get most active stocks from Yahoo Finance
   */
  async getMostActive(count: number = 20): Promise<
    { symbol: string; name: string; price: number; changePercent: number; volume: number; sector?: string }[]
  > {
    const cacheKey = `active:${count}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=${count}`,
        { headers: YAHOO_HEADERS }
      );

      if (!res.ok) {
        this.fastify.log.warn(`Yahoo most active API returned ${res.status}`);
        return [];
      }

      const data = await res.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      const results = quotes
        .filter((q: any) => q.quoteType === "EQUITY")
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          sector: q.sector || undefined,
        }));

      await this.cacheSet(cacheKey, 600, JSON.stringify(results));
      return results;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch most active stocks");
      return [];
    }
  }

  /**
   * Get undervalued large cap stocks (value investing)
   */
  async getUndervaluedLargeCaps(count: number = 20): Promise<
    { symbol: string; name: string; price: number; changePercent: number; volume: number; sector?: string }[]
  > {
    const cacheKey = `undervalued:largecap:${count}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=undervalued_large_caps&count=${count}`,
        { headers: YAHOO_HEADERS }
      );

      if (!res.ok) {
        this.fastify.log.warn(`Yahoo undervalued API returned ${res.status}`);
        return [];
      }

      const data = await res.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      const results = quotes
        .filter((q: any) => q.quoteType === "EQUITY")
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          sector: q.sector || undefined,
        }));

      await this.cacheSet(cacheKey, 600, JSON.stringify(results));
      return results;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch undervalued large caps");
      return [];
    }
  }

  /**
   * Get growth technology stocks
   */
  async getGrowthTechStocks(count: number = 20): Promise<
    { symbol: string; name: string; price: number; changePercent: number; volume: number; sector?: string }[]
  > {
    const cacheKey = `growth:tech:${count}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=growth_technology_stocks&count=${count}`,
        { headers: YAHOO_HEADERS }
      );

      if (!res.ok) {
        this.fastify.log.warn(`Yahoo growth tech API returned ${res.status}`);
        return [];
      }

      const data = await res.json();
      const quotes = data?.finance?.result?.[0]?.quotes || [];

      const results = quotes
        .filter((q: any) => q.quoteType === "EQUITY")
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: q.regularMarketVolume || 0,
          sector: q.sector || "Technology",
        }));

      await this.cacheSet(cacheKey, 600, JSON.stringify(results));
      return results;
    } catch (error) {
      this.fastify.log.error(error, "Failed to fetch growth tech stocks");
      return [];
    }
  }

  /**
   * Get detailed quote info for a symbol including sector, industry, etc.
   */
  async getDetailedQuote(symbol: string): Promise<{
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    volume: number;
    sector?: string;
    industry?: string;
    marketCap?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    averageVolume?: number;
    currency: string;
  } | null> {
    const cacheKey = `detailed:${symbol}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
        { headers: YAHOO_HEADERS }
      );

      if (!res.ok) return null;

      const data = await res.json();
      const quote = data?.quoteResponse?.result?.[0];

      if (!quote) return null;

      const result = {
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || quote.symbol,
        price: quote.regularMarketPrice || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        sector: quote.sector,
        industry: quote.industry,
        marketCap: quote.marketCap,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        averageVolume: quote.averageDailyVolume10Day,
        currency: quote.currency || "USD",
      };

      await this.cacheSet(cacheKey, 300, JSON.stringify(result));
      return result;
    } catch (error) {
      this.fastify.log.error(error, `Failed to fetch detailed quote for ${symbol}`);
      return null;
    }
  }
}
