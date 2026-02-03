import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── DEFAULT USER (single-user, no auth) ─────────────────────────
  const defaultUser = await prisma.user.upsert({
    where: { id: "default-user" },
    update: {},
    create: {
      id: "default-user",
      email: "owner@financy.local",
      password: "not-used",
      name: "Owner",
    },
  });
  console.log(`Default user ready: ${defaultUser.email}`);

  // All assets - prices will be updated by live API on server startup
  const assetDefs = [
    // ─── STOCKS: US ────────────────────────────────────────────────
    { symbol: "AAPL", name: "Apple Inc.", type: "stock", sector: "Technology", exchange: "NASDAQ", currency: "USD" },
    { symbol: "MSFT", name: "Microsoft Corporation", type: "stock", sector: "Technology", exchange: "NASDAQ", currency: "USD" },
    { symbol: "GOOGL", name: "Alphabet Inc.", type: "stock", sector: "Technology", exchange: "NASDAQ", currency: "USD" },
    { symbol: "AMZN", name: "Amazon.com Inc.", type: "stock", sector: "Consumer Cyclical", exchange: "NASDAQ", currency: "USD" },
    { symbol: "NVDA", name: "NVIDIA Corporation", type: "stock", sector: "Technology", exchange: "NASDAQ", currency: "USD" },
    { symbol: "META", name: "Meta Platforms Inc.", type: "stock", sector: "Technology", exchange: "NASDAQ", currency: "USD" },
    { symbol: "TSLA", name: "Tesla Inc.", type: "stock", sector: "Automotive", exchange: "NASDAQ", currency: "USD" },
    { symbol: "NFLX", name: "Netflix Inc.", type: "stock", sector: "Communication Services", exchange: "NASDAQ", currency: "USD" },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "stock", sector: "Financial Services", exchange: "NYSE", currency: "USD" },
    { symbol: "V", name: "Visa Inc.", type: "stock", sector: "Financial Services", exchange: "NYSE", currency: "USD" },
    { symbol: "UNH", name: "UnitedHealth Group Inc.", type: "stock", sector: "Healthcare", exchange: "NYSE", currency: "USD" },
    { symbol: "XOM", name: "Exxon Mobil Corporation", type: "stock", sector: "Energy", exchange: "NYSE", currency: "USD" },
    { symbol: "KO", name: "The Coca-Cola Company", type: "stock", sector: "Consumer Defensive", exchange: "NYSE", currency: "USD" },
    { symbol: "DIS", name: "The Walt Disney Company", type: "stock", sector: "Communication Services", exchange: "NYSE", currency: "USD" },

    // ─── STOCKS: EU (traded on US exchanges or European) ───────────
    { symbol: "ASML", name: "ASML Holding N.V.", type: "stock", sector: "Technology", exchange: "NASDAQ", currency: "USD" },
    { symbol: "SAP", name: "SAP SE", type: "stock", sector: "Technology", exchange: "NYSE", currency: "USD" },
    { symbol: "NVO", name: "Novo Nordisk A/S", type: "stock", sector: "Healthcare", exchange: "NYSE", currency: "USD" },
    { symbol: "ENEL.MI", name: "Enel S.p.A.", type: "stock", sector: "Utilities", exchange: "MIL", currency: "EUR" },
    { symbol: "ISP.MI", name: "Intesa Sanpaolo S.p.A.", type: "stock", sector: "Financial Services", exchange: "MIL", currency: "EUR" },
    { symbol: "ENI.MI", name: "Eni S.p.A.", type: "stock", sector: "Energy", exchange: "MIL", currency: "EUR" },

    // ─── CRYPTO ────────────────────────────────────────────────────
    { symbol: "BTC", name: "Bitcoin", type: "crypto", currency: "USD" },
    { symbol: "ETH", name: "Ethereum", type: "crypto", currency: "USD" },
    { symbol: "SOL", name: "Solana", type: "crypto", currency: "USD" },
    { symbol: "ADA", name: "Cardano", type: "crypto", currency: "USD" },
    { symbol: "XRP", name: "Ripple", type: "crypto", currency: "USD" },
    { symbol: "DOT", name: "Polkadot", type: "crypto", currency: "USD" },
    { symbol: "AVAX", name: "Avalanche", type: "crypto", currency: "USD" },
    { symbol: "LINK", name: "Chainlink", type: "crypto", currency: "USD" },
    { symbol: "DOGE", name: "Dogecoin", type: "crypto", currency: "USD" },
    { symbol: "ATOM", name: "Cosmos", type: "crypto", currency: "USD" },

    // ─── ETFs ──────────────────────────────────────────────────────
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "etf", sector: "Broad Market", exchange: "NYSE", currency: "USD" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf", sector: "Technology", exchange: "NASDAQ", currency: "USD" },
    { symbol: "IWM", name: "iShares Russell 2000 ETF", type: "etf", sector: "Small Cap", exchange: "NYSE", currency: "USD" },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "etf", sector: "Broad Market", exchange: "NYSE", currency: "USD" },
    { symbol: "EFA", name: "iShares MSCI EAFE ETF", type: "etf", sector: "International", exchange: "NYSE", currency: "USD" },
    { symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF", type: "etf", sector: "Emerging Markets", exchange: "NYSE", currency: "USD" },
    { symbol: "ARKK", name: "ARK Innovation ETF", type: "etf", sector: "Innovation", exchange: "NYSE", currency: "USD" },
    { symbol: "VNQ", name: "Vanguard Real Estate ETF", type: "etf", sector: "Real Estate", exchange: "NYSE", currency: "USD" },

    // ─── COMMODITIES ───────────────────────────────────────────────
    { symbol: "GLD", name: "SPDR Gold Shares", type: "commodity", sector: "Precious Metals", exchange: "NYSE", currency: "USD" },
    { symbol: "SLV", name: "iShares Silver Trust", type: "commodity", sector: "Precious Metals", exchange: "NYSE", currency: "USD" },
    { symbol: "USO", name: "United States Oil Fund", type: "commodity", sector: "Energy", exchange: "NYSE", currency: "USD" },
    { symbol: "UNG", name: "United States Natural Gas Fund", type: "commodity", sector: "Energy", exchange: "NYSE", currency: "USD" },
    { symbol: "DBA", name: "Invesco DB Agriculture Fund", type: "commodity", sector: "Agriculture", exchange: "NYSE", currency: "USD" },

    // ─── BONDS ─────────────────────────────────────────────────────
    { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", type: "bond", sector: "Government Bonds", exchange: "NASDAQ", currency: "USD" },
    { symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "bond", sector: "Aggregate Bonds", exchange: "NASDAQ", currency: "USD" },
    { symbol: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", type: "bond", sector: "Corporate Bonds", exchange: "NYSE", currency: "USD" },
  ];

  const assets = [];
  for (const def of assetDefs) {
    const asset = await prisma.asset.upsert({
      where: { symbol: def.symbol },
      update: {},
      create: {
        symbol: def.symbol,
        name: def.name,
        type: def.type,
        sector: def.sector,
        exchange: def.exchange,
        currency: def.currency,
      },
    });
    assets.push(asset);
  }

  console.log(`Created/verified ${assets.length} assets:`);
  console.log(`  - Stocks: ${assetDefs.filter((a) => a.type === "stock").length}`);
  console.log(`  - Crypto: ${assetDefs.filter((a) => a.type === "crypto").length}`);
  console.log(`  - ETFs:   ${assetDefs.filter((a) => a.type === "etf").length}`);
  console.log(`  - Commodities: ${assetDefs.filter((a) => a.type === "commodity").length}`);
  console.log(`  - Bonds:  ${assetDefs.filter((a) => a.type === "bond").length}`);
  console.log("Seed completed. Prices will be updated by live API on server startup.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
