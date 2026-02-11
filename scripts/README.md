# Scripts

## Import Price History

Popola la tabella `price_history` con dati storici OHLCV da Yahoo Finance.

### Installazione dipendenze

```bash
cd apps/api
npm install yahoofinance2
```

### Uso

**Importa ultimi 90 giorni per tutti gli asset:**
```bash
tsx scripts/import-price-history.ts
```

**Importa specifici asset:**
```bash
tsx scripts/import-price-history.ts --symbols=AAPL,MSFT,GOOGL
```

**Importa ultimi 180 giorni:**
```bash
tsx scripts/import-price-history.ts --days=180
```

**Opzioni avanzate:**
```bash
tsx scripts/import-price-history.ts \
  --days=90 \
  --batch-size=5 \
  --delay=2000
```

### Parametri

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| `--days` | 90 | Giorni di storico da importare |
| `--symbols` | all | Simboli specifici (comma-separated) |
| `--batch-size` | 10 | Asset per batch (evita rate limiting) |
| `--delay` | 1000 | Millisecondi tra batch |

### Note

- ✅ **Gratuito**: Yahoo Finance non richiede API key
- ⚡ **Rate limiting**: lo script fa pause automatiche tra batch
- 🔄 **Idempotente**: può essere eseguito più volte, aggiorna solo dati mancanti
- 📊 **Crypto**: attualmente importa solo stock/ETF (crypto richiede API diverse)

### Troubleshooting

**Errore "Symbol not found"**:
- Verifica che il simbolo esista su Yahoo Finance
- Alcuni asset potrebbero usare ticker diversi (es: `BRK.B` invece di `BRKB`)

**Rate limiting (429 errors)**:
- Aumenta il delay: `--delay=3000`
- Riduci batch size: `--batch-size=5`

**Import lento**:
- È normale! Yahoo Finance limita le richieste
- Per 100 asset con delay 1s: ~10-15 minuti

### Scheduling automatico

Per aggiornare i dati ogni giorno, aggiungi a cron:

```bash
# Ogni giorno alle 2 AM
0 2 * * * cd /path/to/Financy && tsx scripts/import-price-history.ts --days=7
```
