# Trading Section - Piano di Implementazione

## Panoramica

Nuova sezione "Trading" con:
1. **Survey iniziale** per definire profilo investitore
2. **Analisi automatica** via n8n + AI a intervalli configurabili
3. **Notifiche BUY/SELL** basate su criteri intelligenti
4. **Lista asset in trading** con stato e performance

---

## Modelli Dati

### TradingProfile (Profilo Investitore)
```prisma
model TradingProfile {
  id                String   @id @default(cuid())
  userId            String   @unique @map("user_id")

  // Survey responses
  horizon           String   // "short" (giorni), "medium" (settimane), "long" (mesi)
  riskTolerance     String   // "conservative", "moderate", "aggressive"
  targetProfitPct   Float    // 5, 10, 15, 20...
  maxLossPct        Float    // 5, 10, 15...
  preferredSectors  String[] // ["Technology", "Healthcare", ...]
  investmentPerTrade Float?  // Budget per operazione (opzionale)

  // Settings
  analysisInterval  Int      @default(60) // minuti tra analisi

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id])
  tradingAssets     TradingAsset[]
}
```

### TradingAsset (Asset in Trading)
```prisma
model TradingAsset {
  id              String   @id @default(cuid())
  profileId       String   @map("profile_id")
  assetId         String   @map("asset_id")

  // Trade info
  status          String   // "watching", "bought", "sold"
  entryPrice      Float?   // Prezzo di acquisto
  entryDate       DateTime?
  quantity        Float?
  targetPrice     Float?   // Prezzo target (entry + profit%)
  stopLossPrice   Float?   // Prezzo stop-loss

  // Performance
  currentProfitPct Float?  // Profitto/perdita attuale %

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  profile         TradingProfile @relation(fields: [profileId], references: [id])
  asset           Asset    @relation(fields: [assetId], references: [id])
  signals         TradingSignal[]
}
```

### TradingSignal (Segnali di Trading)
```prisma
model TradingSignal {
  id              String   @id @default(cuid())
  tradingAssetId  String   @map("trading_asset_id")

  action          String   // "BUY", "SELL", "HOLD"
  confidence      String   // "high", "medium", "low"
  reason          String   // Motivazione AI
  priceAtSignal   Float

  // Criteri che hanno generato il segnale
  criteria        Json     // { rsi: 25, macd: "bullish", sentiment: 0.7, ... }

  notified        Boolean  @default(false)
  createdAt       DateTime @default(now())

  tradingAsset    TradingAsset @relation(fields: [tradingAssetId], references: [id])
}
```

---

## Criteri per Segnali BUY/SELL

### Segnale BUY (tutti i criteri devono essere soddisfatti)
1. **RSI < 30** (ipervenduto) OPPURE **RSI tra 40-60** con trend positivo
2. **MACD crossover bullish** (linea MACD sopra signal)
3. **Prezzo sopra MA20** o in avvicinamento
4. **Volume sopra media** (conferma interesse)
5. **Sentiment news positivo** (> 0.5)
6. **Nessun segnale sell recente** (ultimi 3 giorni)

### Segnale SELL
1. **Target profit raggiunto** (prezzo >= entryPrice * (1 + targetProfitPct/100))
2. **Stop-loss raggiunto** (prezzo <= entryPrice * (1 - maxLossPct/100))
3. **RSI > 70** (ipercomprato) con divergenza negativa
4. **MACD crossover bearish**
5. **Sentiment news negativo** (< 0.3)
6. **Volume in calo** con prezzo stagnante

### Confidenza del Segnale
- **High**: 4+ criteri soddisfatti
- **Medium**: 3 criteri soddisfatti
- **Low**: 2 criteri soddisfatti

---

## Survey (Step 1)

### Domande

1. **Orizzonte temporale**
   - Breve termine (giorni/settimane) - trading attivo
   - Medio termine (1-6 mesi) - swing trading
   - Lungo termine (6+ mesi) - position trading

2. **Tolleranza al rischio**
   - Conservativo: preferisco guadagni piccoli ma sicuri
   - Moderato: accetto rischi moderati per guadagni medi
   - Aggressivo: accetto alti rischi per alti guadagni

3. **Obiettivo di profitto**
   - 5% - Conservativo
   - 10% - Moderato
   - 15% - Ambizioso
   - 20%+ - Aggressivo

4. **Perdita massima accettabile**
   - 5% - Stop-loss stretto
   - 10% - Stop-loss moderato
   - 15% - Stop-loss ampio

5. **Settori preferiti** (multi-select)
   - Technology, Healthcare, Finance, Energy, Consumer, Industrial, etc.

6. **Budget per operazione** (opzionale)
   - €100-500, €500-1000, €1000-5000, €5000+

---

## API Endpoints

### Trading Profile
- `GET /api/trading/profile` - Ottieni profilo
- `POST /api/trading/profile` - Crea/aggiorna profilo (survey)
- `PUT /api/trading/profile/settings` - Aggiorna impostazioni

### Trading Assets
- `GET /api/trading/assets` - Lista asset in trading
- `POST /api/trading/assets` - Aggiungi asset (da suggerimento AI)
- `PUT /api/trading/assets/:id` - Aggiorna stato (bought, sold)
- `DELETE /api/trading/assets/:id` - Rimuovi asset

### Trading Signals
- `GET /api/trading/signals` - Ultimi segnali
- `POST /api/trading/signals/analyze` - Trigger analisi manuale

### n8n Webhook
- `POST /api/trading/webhook/signals` - Ricevi segnali da n8n

---

## n8n Workflow

### Trigger
- Schedule: ogni X minuti (da TradingProfile.analysisInterval)
- Webhook manuale

### Steps
1. **Fetch trading profiles** attivi
2. Per ogni profilo:
   a. Fetch asset in watchlist/bought
   b. Fetch dati tecnici (RSI, MACD, MA)
   c. Fetch sentiment news
   d. Fetch prezzo attuale
3. **AI Analysis** (Claude):
   - Input: dati tecnici, sentiment, profilo utente
   - Output: BUY/SELL/HOLD con motivazione
4. **Generate signals** se azione necessaria
5. **Send notifications** via WebSocket + in_app

---

## Frontend

### Pagina /trading

#### Stato 1: No Profile (mostra survey)
```
┌─────────────────────────────────────────┐
│  🎯 Configura il tuo Trading Profile    │
│                                         │
│  [Survey multi-step con progress bar]   │
│                                         │
│  Step 1/4: Orizzonte temporale          │
│  ○ Breve termine                        │
│  ○ Medio termine                        │
│  ○ Lungo termine                        │
│                                         │
│  [Indietro]              [Avanti →]     │
└─────────────────────────────────────────┘
```

#### Stato 2: Profile exists (mostra dashboard)
```
┌─────────────────────────────────────────┐
│  Trading                    [⚙️ Profilo] │
│  Prossima analisi: 45 min               │
├─────────────────────────────────────────┤
│  📊 I tuoi Trade                        │
│  ┌─────────────────────────────────────┐│
│  │ AAPL  BUY  +12.5%  [Grafico] [Vendi]││
│  │ Entry: $150 → Target: $165          ││
│  │ Segnale: RSI basso, MACD bullish    ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ NVDA  HOLD  +5.2%  [Grafico]        ││
│  │ Entry: $450 → Target: $495          ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  🔔 Ultimi Segnali                      │
│  • TSLA: SELL (target raggiunto)        │
│  • MSFT: BUY (RSI ipervenduto)          │
└─────────────────────────────────────────┘
```

---

## Impostazioni

Aggiungere in /settings:

```
Trading
├── Intervallo analisi: [15m] [30m] [1h] [4h] [1d]
├── Notifiche trading: [✓] Email [✓] In-app
└── [Modifica Profilo Trading]
```

---

## File da Creare/Modificare

### Backend
| File | Azione |
|------|--------|
| `prisma/schema.prisma` | Aggiungere modelli Trading* |
| `src/routes/trading.ts` | **NUOVO** - Route trading |
| `src/services/trading.ts` | **NUOVO** - Logica trading |
| `src/routes/settings.ts` | Aggiungere trading settings |

### Frontend
| File | Azione |
|------|--------|
| `app/trading/page.tsx` | **NUOVO** - Pagina trading |
| `components/trading/survey.tsx` | **NUOVO** - Survey component |
| `components/trading/trading-card.tsx` | **NUOVO** - Card asset |
| `components/trading/signal-list.tsx` | **NUOVO** - Lista segnali |
| `components/layout/sidebar.tsx` | Aggiungere link Trading |
| `lib/api.ts` | Aggiungere metodi trading |

### n8n
| File | Azione |
|------|--------|
| `n8n/trading-analysis.json` | **NUOVO** - Workflow analisi |

---

## Ordine di Implementazione

1. **Schema Prisma** + migrazione
2. **Backend routes** + services
3. **Frontend survey** component
4. **Frontend trading page**
5. **n8n workflow**
6. **Integrazione notifiche**
7. **Test end-to-end**
