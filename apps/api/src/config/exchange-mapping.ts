/**
 * Mapping of US stock symbols to their European (Xetra) equivalents.
 * European symbols provide EUR-native prices, avoiding conversion spreads.
 *
 * This is especially useful for users trading on European brokers like Trade Republic,
 * which use LS Exchange prices that are reference-linked to Xetra.
 */

export const US_TO_EU_SYMBOL_MAP: Record<string, string> = {
  // Tech Giants
  "AAPL": "APC.DE",      // Apple
  "MSFT": "MSF.DE",      // Microsoft
  "GOOGL": "ABEC.DE",    // Alphabet Class C
  "GOOG": "ABEA.DE",     // Alphabet Class A
  "AMZN": "AMZ.DE",      // Amazon
  "META": "FB2A.DE",     // Meta (Facebook)
  "TSLA": "TL0.DE",      // Tesla
  "NVDA": "NVD.DE",      // NVIDIA

  // Semiconductors
  "AMD": "AMD.DE",       // AMD
  "INTC": "INL.DE",      // Intel
  "QCOM": "QCI.DE",      // Qualcomm
  "AVGO": "1YD.DE",      // Broadcom
  "TXN": "TII.DE",       // Texas Instruments
  "ASML": "ASME.DE",     // ASML (originally Dutch, also on Xetra)

  // Payment & Fintech
  "V": "3V64.DE",        // Visa
  "MA": "M4I.DE",        // Mastercard
  "PYPL": "2PP.DE",      // PayPal
  "SQ": "SQ3.DE",        // Block (Square)

  // E-commerce & Retail
  "SHOP": "71S.DE",      // Shopify
  "BABA": "AHLA.DE",     // Alibaba
  "JD": "13Z.DE",        // JD.com

  // Streaming & Entertainment
  "NFLX": "NFC.DE",      // Netflix
  "DIS": "WDP.DE",       // Disney
  "SPOT": "2S8.DE",      // Spotify

  // Pharma & Healthcare
  "JNJ": "JNJ.DE",       // Johnson & Johnson
  "PFE": "PFE.DE",       // Pfizer
  "ABBV": "4AB.DE",      // AbbVie
  "TMO": "THM.DE",       // Thermo Fisher
  "UNH": "UST.DE",       // UnitedHealth

  // Finance
  "BRK.B": "BRYN.DE",    // Berkshire Hathaway B
  "JPM": "CMC.DE",       // JPMorgan Chase
  "BAC": "NCB.DE",       // Bank of America
  "WFC": "WFN.DE",       // Wells Fargo
  "GS": "GOS.DE",        // Goldman Sachs

  // Consumer
  "KO": "CCC3.DE",       // Coca-Cola
  "PEP": "PEP.DE",       // PepsiCo
  "NKE": "NKE.DE",       // Nike
  "SBUX": "SRB.DE",      // Starbucks
  "MCD": "MDO.DE",       // McDonald's

  // Industrial
  "BA": "BCO.DE",        // Boeing
  "CAT": "CAT1.DE",      // Caterpillar
  "GE": "GEC.DE",        // General Electric
  "MMM": "MMM1.DE",      // 3M

  // Energy
  "XOM": "XOM.DE",       // Exxon Mobil
  "CVX": "CHV.DE",       // Chevron
  "COP": "COP.DE",       // ConocoPhillips
};

/**
 * Check if a US symbol has a European equivalent
 */
export function hasEuropeanEquivalent(usSymbol: string): boolean {
  return usSymbol in US_TO_EU_SYMBOL_MAP;
}

/**
 * Get European symbol for a US stock, or return original if no mapping exists
 */
export function getEuropeanSymbol(usSymbol: string): string {
  return US_TO_EU_SYMBOL_MAP[usSymbol] || usSymbol;
}

/**
 * Check if a symbol is already a European symbol (ends with .DE, .SW, etc.)
 */
export function isEuropeanSymbol(symbol: string): boolean {
  return /\.(DE|SW|PA|MI|AS|L)$/i.test(symbol);
}

/**
 * Get the preferred symbol based on user preference for European exchanges
 */
export function getPreferredSymbol(
  symbol: string,
  preferEuropean: boolean = true
): string {
  // If already European, return as-is
  if (isEuropeanSymbol(symbol)) {
    return symbol;
  }

  // If user prefers European and mapping exists, use it
  if (preferEuropean && hasEuropeanEquivalent(symbol)) {
    return getEuropeanSymbol(symbol);
  }

  // Otherwise use original
  return symbol;
}
