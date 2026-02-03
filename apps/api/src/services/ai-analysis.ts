import { FastifyInstance } from "fastify";

interface AnalysisResult {
  title: string;
  summary: string;
  content: string;
  sentiment: string;
  recommendations?: string[];
}

export interface UserPreferences {
  riskTolerance: "conservative" | "moderate" | "aggressive";
  timeHorizon: "short" | "medium" | "long";
  goals: "growth" | "income" | "preservation";
  preferredSectors: string[];
  baseCurrency: "EUR" | "USD";
}

interface PortfolioHolding {
  symbol: string;
  name: string;
  type?: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  changePercent: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
  weight: number;
}

interface NewsItem {
  title: string;
  summary: string;
  publishedAt: string;
  sentiment?: string;
  symbol?: string;
}

interface TechnicalSignal {
  indicator: string;
  signal: string;
  value: number;
}

export class AIAnalysisService {
  constructor(private fastify: FastifyInstance) {}

  // Public method to call AI and get raw text response
  async callAI(prompt: string, maxTokens = 2048): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("AI API key not configured (ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY or OPENAI_API_KEY)");
    }

    // Try Anthropic first (best quality)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = await res.json();
        if (data.content?.[0]?.text) {
          return data.content[0].text;
        }
      } catch (error: any) {
        this.fastify.log.warn({ error }, "Anthropic failed, trying Gemini...");
        // Check if it's a rate limit error
        if (error.message?.includes("usage limits") || data?.error?.message?.includes("usage limits")) {
          this.fastify.log.error({ error: data?.error }, "⚠️ ANTHROPIC: Limite crediti raggiunto! Verifica il tuo account.");
        }
      }
    }

    // Try Gemini
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: maxTokens > 8000 ? 8000 : maxTokens,
                temperature: 0.7,
              },
            }),
          }
        );
        const data = await res.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
      } catch (error) {
        this.fastify.log.warn("Gemini failed, trying OpenAI...");
      }
    }

    // Try OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          return data.choices[0].message.content;
        }
      } catch (error) {
        this.fastify.log.warn("OpenAI failed, trying Anthropic...");
      }
    }

    // Try Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content?.[0]?.text || "";
    }

    throw new Error("All AI providers failed");
  }

  private async callAnthropic(prompt: string, maxTokens = 2048): Promise<AnalysisResult> {
    // Try Anthropic first (best quality for complex prompts)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const data = await res.json();

        // Check for API errors
        if (data.error) {
          const errorMsg = data.error.message || "";
          if (errorMsg.includes("usage limits")) {
            this.fastify.log.error({ error: data.error }, "⚠️ ANTHROPIC: Limite API raggiunto! Il servizio riprenderà automaticamente quando il limite si resetta.");
          }
          throw new Error(errorMsg);
        }

        const text = data.content?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (error: any) {
        this.fastify.log.warn({ error: error.message }, "Anthropic failed, trying Gemini...");
      }
    }

    // Try Gemini
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: maxTokens > 8000 ? 8000 : maxTokens,
                temperature: 0.7,
              },
            }),
          }
        );
        const data = await res.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Remove markdown code blocks
        text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

        // Try direct parse first
        try {
          return JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        }
        this.fastify.log.warn({ text: text.substring(0, 500) }, "Gemini response doesn't contain valid JSON");
      } catch (error) {
        this.fastify.log.warn({ error }, "Gemini failed, trying OpenAI...");
      }
    }

    // Try OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const data = await res.json();
        let text = data.choices?.[0]?.message?.content || "";
        text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

        try {
          return JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        }
        this.fastify.log.warn({ text: text.substring(0, 500) }, "OpenAI response doesn't contain valid JSON");
      } catch (error) {
        this.fastify.log.warn({ error }, "OpenAI failed, trying Anthropic...");
      }
    }

    // Try Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const data = await res.json();
        const text = data.content?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        this.fastify.log.warn({ error }, "Anthropic failed");
      }
    }

    throw new Error("Failed to parse AI response from all providers");
  }

  private formatPreferences(preferences: UserPreferences): string {
    const riskLabels = {
      conservative: "Conservativo - Preferisce sicurezza e stabilità",
      moderate: "Moderato - Bilancia rischio e rendimento",
      aggressive: "Aggressivo - Accetta alta volatilità per maggiori rendimenti",
    };
    const horizonLabels = {
      short: "Breve termine (<1 anno)",
      medium: "Medio termine (1-5 anni)",
      long: "Lungo termine (>5 anni)",
    };
    const goalsLabels = {
      growth: "Crescita del capitale",
      income: "Generazione di rendita",
      preservation: "Preservazione del capitale",
    };

    return `- Tolleranza al rischio: ${riskLabels[preferences.riskTolerance]}
- Orizzonte temporale: ${horizonLabels[preferences.timeHorizon]}
- Obiettivo: ${goalsLabels[preferences.goals]}
- Settori preferiti: ${preferences.preferredSectors.length > 0 ? preferences.preferredSectors.join(", ") : "Nessuna preferenza specifica"}
- Valuta base: ${preferences.baseCurrency}`;
  }

  private formatNews(news: NewsItem[]): string {
    if (news.length === 0) return "Nessuna news recente disponibile.";
    return news
      .slice(0, 10)
      .map((n) => {
        const date = new Date(n.publishedAt).toLocaleDateString("it-IT");
        const symbol = n.symbol ? `${n.symbol}: ` : "";
        const sentiment = n.sentiment ? ` (${n.sentiment})` : "";
        return `- [${date}] ${symbol}"${n.title}"${sentiment}`;
      })
      .join("\n");
  }

  async generatePortfolioDigest(
    holdings: PortfolioHolding[],
    news: NewsItem[],
    preferences: UserPreferences,
    availableAssets?: { symbol: string; name: string; price: number; changePercent: number; sector?: string; type?: string }[]
  ): Promise<AnalysisResult> {
    const currency = preferences.baseCurrency === "EUR" ? "€" : "$";
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalProfitLoss = holdings.reduce((sum, h) => sum + h.profitLoss, 0);
    const profitLossPercent = totalValue > 0 ? (totalProfitLoss / (totalValue - totalProfitLoss)) * 100 : 0;
    const dailyChange = holdings.reduce(
      (sum, h) => sum + (h.currentPrice * h.quantity * h.changePercent) / 100,
      0
    );

    // Calculate distributions
    const typeDistribution: Record<string, number> = {};
    const sectorDistribution: Record<string, number> = {};
    holdings.forEach(h => {
      const type = h.type || "other";
      typeDistribution[type] = (typeDistribution[type] || 0) + h.weight;
      // For sector, we'd need it from asset data - skip for now if not available
    });

    const holdingsText = holdings
      .sort((a, b) => b.weight - a.weight)
      .map(
        (h) =>
          `- ${h.symbol} (${h.name}) [${h.type || "N/A"}]: ${h.quantity.toFixed(2)} unità @ ${currency}${h.avgPrice.toFixed(2)} → ${currency}${h.currentPrice.toFixed(2)} | P/L: ${h.profitLossPercent >= 0 ? "+" : ""}${h.profitLossPercent.toFixed(1)}% | Peso: ${h.weight.toFixed(1)}%`
      )
      .join("\n");

    const distributionText = Object.entries(typeDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([type, weight]) => `${type}: ${weight.toFixed(1)}%`)
      .join(", ");

    // Available assets for suggestions (exclude already owned)
    const ownedSymbols = new Set(holdings.map(h => h.symbol));
    const suggestableAssets = availableAssets
      ?.filter(a => !ownedSymbols.has(a.symbol))
      .slice(0, 20)
      .map(a => `- ${a.symbol} (${a.name}): ${currency}${a.price.toFixed(2)} [${a.type || "N/A"}]${a.sector ? ` - ${a.sector}` : ""}`)
      .join("\n") || "Nessun asset aggiuntivo disponibile";

    const prompt = `Sei un consulente finanziario esperto che analizza il portfolio di un investitore e fornisce raccomandazioni personalizzate.

PROFILO INVESTITORE:
${this.formatPreferences(preferences)}

═══════════════════════════════════════
COMPOSIZIONE PORTFOLIO ATTUALE:
═══════════════════════════════════════
${holdingsText}

STATISTICHE PORTFOLIO:
- Valore Totale: ${currency}${totalValue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
- P/L Totale: ${totalProfitLoss >= 0 ? "+" : ""}${currency}${totalProfitLoss.toLocaleString("it-IT", { minimumFractionDigits: 2 })} (${profitLossPercent >= 0 ? "+" : ""}${profitLossPercent.toFixed(1)}%)
- Variazione Oggi: ${dailyChange >= 0 ? "+" : ""}${currency}${dailyChange.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
- Distribuzione per tipo: ${distributionText}
- Numero posizioni: ${holdings.length}

═══════════════════════════════════════
ASSET DISPONIBILI PER DIVERSIFICAZIONE:
═══════════════════════════════════════
${suggestableAssets}

NEWS RECENTI:
${this.formatNews(news)}

═══════════════════════════════════════
ANALISI RICHIESTA:
═══════════════════════════════════════

Fornisci un'analisi COMPLETA e DETTAGLIATA che includa:

1. **TITOLO**: Breve e descrittivo dello stato del portfolio

2. **SOMMARIO**: 2-3 frasi che riassumono la situazione

3. **CONTENUTO DETTAGLIATO** (usa markdown con ## per le sezioni):

   ## Valutazione del Portfolio
   - Il portfolio è ben bilanciato? Analizza la diversificazione
   - Ci sono concentrazioni eccessive in un singolo asset o settore?
   - La distribuzione per tipo di asset (ETF, azioni, crypto) è adeguata al profilo di rischio?

   ## Punti di Forza
   - Quali posizioni stanno performando bene?
   - Quali scelte sono state azzeccate?

   ## Aree di Miglioramento
   - Quali posizioni sono in perdita e perché?
   - Cosa manca al portfolio per essere più bilanciato?
   - Rischi identificati

   ## Opportunità di Investimento
   - Basandoti sul profilo (${preferences.riskTolerance}, ${preferences.timeHorizon}, ${preferences.goals})
   - Quali asset dalla lista disponibile potrebbero migliorare il portfolio?
   - Quali settori andrebbero aggiunti o rafforzati?

4. **RACCOMANDAZIONI** (5 azioni concrete e specifiche):
   - Indica asset specifici da comprare con % suggerita
   - Indica posizioni da alleggerire o vendere
   - Suggerisci l'allocazione target ideale

5. **SENTIMENT**: very_bullish/bullish/neutral/bearish/very_bearish

Rispondi in italiano. Formato JSON:
{
  "title": "...",
  "summary": "...",
  "content": "...",
  "recommendations": ["...", "...", "...", "...", "..."],
  "sentiment": "..."
}`;

    try {
      return await this.callAnthropic(prompt, 4000);
    } catch (error) {
      this.fastify.log.error(error, "Failed to generate portfolio digest");
      throw error;
    }
  }

  async generateMarketOverview(
    assets: { symbol: string; name: string; price: number; changePercent: number; sector?: string; type?: string }[],
    news: NewsItem[],
    preferences: UserPreferences
  ): Promise<AnalysisResult> {
    const currency = preferences.baseCurrency === "EUR" ? "€" : "$";

    // Group assets by type and sector for better analysis
    const byType: Record<string, typeof assets> = {};
    const bySector: Record<string, typeof assets> = {};

    assets.forEach(a => {
      const type = a.type || "other";
      const sector = a.sector || "Other";
      if (!byType[type]) byType[type] = [];
      if (!bySector[sector]) bySector[sector] = [];
      byType[type].push(a);
      bySector[sector].push(a);
    });

    const assetsText = assets
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 25)
      .map(
        (a) =>
          `- ${a.symbol} (${a.name}): ${currency}${a.price.toFixed(2)} (${a.changePercent >= 0 ? "+" : ""}${a.changePercent.toFixed(2)}%)${a.sector ? ` [${a.sector}]` : ""} {${a.type || "N/A"}}`
      )
      .join("\n");

    // Calculate market stats
    const avgChange = assets.reduce((sum, a) => sum + a.changePercent, 0) / assets.length;
    const gainers = assets.filter(a => a.changePercent > 0).length;
    const losers = assets.filter(a => a.changePercent < 0).length;

    const prompt = `Sei un analista di mercato che fornisce una panoramica dei mercati finanziari.

PROFILO UTENTE:
${this.formatPreferences(preferences)}

═══════════════════════════════════════
SITUAZIONE MERCATI
═══════════════════════════════════════
Asset in rialzo: ${gainers} | Asset in ribasso: ${losers}
Variazione media: ${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%

PRINCIPALI MOVIMENTI:
${assetsText}

NEWS RECENTI:
${this.formatNews(news)}

═══════════════════════════════════════
ANALISI RICHIESTA:
═══════════════════════════════════════

Fornisci un'analisi di mercato che includa:

1. **TITOLO**: Breve e descrittivo della situazione di mercato

2. **SOMMARIO**: 2-3 frasi sulla situazione generale

3. **CONTENUTO** (usa markdown con ## per le sezioni):

   ## Panoramica Mercati
   - Trend generale: rialzista, ribassista o laterale?
   - Quali settori stanno performando meglio/peggio?

   ## Analisi Settoriale
   - Technology: come sta andando il settore tech?
   - Crypto: sentiment sul mercato delle criptovalute
   - Altri settori rilevanti

   ## Fattori da Monitorare
   - News e eventi che potrebbero influenzare i mercati
   - Rischi e opportunità nel breve termine

   ## Opportunità di Mercato
   - Asset interessanti da tenere d'occhio
   - Settori con potenziale (considera le preferenze dell'utente: ${preferences.preferredSectors.join(", ") || "nessuna specifica"})

4. **RACCOMANDAZIONI** (3-4 insight di mercato):
   - Trend da seguire
   - Settori da monitorare
   - Cautele da adottare

5. **SENTIMENT**: very_bullish/bullish/neutral/bearish/very_bearish

Rispondi in italiano. Formato JSON:
{
  "title": "...",
  "summary": "...",
  "content": "...",
  "recommendations": ["...", "...", "..."],
  "sentiment": "..."
}`;

    try {
      return await this.callAnthropic(prompt, 2500);
    } catch (error) {
      this.fastify.log.error(error, "Failed to generate market overview");
      throw error;
    }
  }

  async generateAssetDeepDive(
    asset: { symbol: string; name: string; price: number; changePercent: number; sector?: string },
    signals: TechnicalSignal[],
    news: NewsItem[],
    preferences: UserPreferences
  ): Promise<AnalysisResult> {
    const signalsText =
      signals.length > 0
        ? signals.map((s) => `- ${s.indicator}: ${s.value} (${s.signal})`).join("\n")
        : "Nessun segnale tecnico disponibile.";

    const prompt = `Sei un analista finanziario che fornisce un'analisi approfondita di un singolo asset.

PROFILO UTENTE:
${this.formatPreferences(preferences)}

ASSET IN ANALISI:
${asset.symbol} - ${asset.name}
Prezzo: ${preferences.baseCurrency === "EUR" ? "€" : "$"}${asset.price.toFixed(2)}
Variazione: ${asset.changePercent >= 0 ? "+" : ""}${asset.changePercent.toFixed(2)}%
${asset.sector ? `Settore: ${asset.sector}` : ""}

SEGNALI TECNICI:
${signalsText}

NEWS RECENTI SU ${asset.symbol}:
${this.formatNews(news)}

Basandoti su questi dati, fornisci:
1. Un titolo breve e accattivante sull'asset
2. Un sommario di 2-3 frasi
3. Un'analisi tecnica e fondamentale dettagliata
4. Raccomandazioni specifiche (considera il profilo di rischio dell'utente)
5. Sentiment sull'asset (very_bullish/bullish/neutral/bearish/very_bearish)

Rispondi in italiano. Formato JSON:
{
  "title": "...",
  "summary": "...",
  "content": "...",
  "recommendations": ["...", "...", "..."],
  "sentiment": "..."
}`;

    try {
      return await this.callAnthropic(prompt, 4000);
    } catch (error) {
      this.fastify.log.error(error, `Failed to generate deep dive for ${asset.symbol}`);
      throw error;
    }
  }

  async generateMarketDigest(
    marketData: { symbol: string; price: number; changePercent: number }[]
  ): Promise<AnalysisResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    try {
      const prompt = `Analyze the following market data and provide a concise market digest:

${marketData.map((d) => `${d.symbol}: $${d.price.toFixed(2)} (${d.changePercent > 0 ? "+" : ""}${d.changePercent.toFixed(2)}%)`).join("\n")}

Provide:
1. A short title
2. A 2-3 sentence summary
3. Detailed analysis (3-4 paragraphs)
4. Overall sentiment (very_bullish, bullish, neutral, bearish, very_bearish)

Format as JSON: { "title": "", "summary": "", "content": "", "sentiment": "" }`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Failed to parse AI response");
    } catch (error) {
      this.fastify.log.error(error, "Failed to generate AI analysis");
      throw error;
    }
  }

  async analyzeAsset(
    symbol: string,
    priceData: { price: number; changePercent: number },
    technicalSignals: { indicator: string; signal: string; value: number }[]
  ): Promise<AnalysisResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    try {
      const prompt = `Analyze ${symbol} with the following data:
Price: $${priceData.price.toFixed(2)} (${priceData.changePercent > 0 ? "+" : ""}${priceData.changePercent.toFixed(2)}%)

Technical Indicators:
${technicalSignals.map((s) => `- ${s.indicator}: ${s.value} (${s.signal})`).join("\n")}

Provide a JSON response: { "title": "", "summary": "", "content": "", "sentiment": "" }`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Failed to parse AI response");
    } catch (error) {
      this.fastify.log.error(error, `Failed to analyze ${symbol}`);
      throw error;
    }
  }
}
