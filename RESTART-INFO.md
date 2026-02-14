# 🔄 Restart Instructions

## Credenziali & Setup

### Database
```
Host: localhost:5432
Database: financy
User: financy
Password: financy
URL: postgresql://financy:financy@localhost:5432/financy
```

### User Login
```
Email: alex.casu@gmail.com
Password: test123
```

### Portfolio Calibration
```
Reference Value (Trade Republic): €9,972.84
Calibration Factor: 1.0318 (+3.18%)
```

## 🚀 Come Riavviare l'Applicazione

### 1. Database (già configurato)
```bash
# Il database è già configurato con tutte le migrazioni
# Schema aggiornato con:
# - user_settings.reference_portfolio_value
# - user_settings.eur_price_adjustment_factor
# - trading_profiles.resuggest_dismissed_after_days
```

### 2. Avvia Backend API
```bash
cd /Users/alessandrocasu/Develop/Financy/apps/api
npm run dev > /tmp/financy-api.log 2>&1 &

# Verifica che sia attivo
curl -s http://localhost:3001/api/trading/profile | head -3
```

### 3. Avvia Frontend Web
```bash
cd /Users/alessandrocasu/Develop/Financy/apps/web
npm run dev > /tmp/financy-web.log 2>&1 &

# Verifica che sia attivo
curl -s http://localhost:3000 | grep "<!DOCTYPE"
```

### 4. Verifica Servizi
```bash
# API Server
lsof -ti:3001 && echo "✅ API running on 3001" || echo "❌ API not running"

# Web Server
lsof -ti:3000 && echo "✅ Web running on 3000" || echo "❌ Web not running"
```

## 📊 Dati Importanti

### Portfolio
- **1 portfolio**: "Trading"
- **6 holdings**:
  1. Vanguard FTSE All-World (IE00BK5BQT80.SG) - 44.43 @ €146.33
  2. Nestlé (NESN.SW) - 6.22 @ €80.48
  3. Johnson & Johnson (JNJ) - 2.69 @ $186.15
  4. AMD - 2.54 @ $197.13
  5. NVIDIA (NVDA) - 4.57 @ $164.20
  6. Alphabet (GOOG) - 3.48 @ $287.44

### Trading Profile
- Cash Balance: €4,940.59
- Target Profit: 10%
- Max Loss: 10%

## 🔧 Fix Comuni

### Se il Portfolio è Vuoto
```bash
# 1. Verifica login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.casu@gmail.com","password":"test123"}'

# 2. Verifica portfolios
psql "postgresql://financy:financy@localhost:5432/financy" \
  -c "SELECT * FROM portfolios WHERE user_id = 'cmkzlyxz20000atvnb10yeu6g';"
```

### Se Mancano Colonne nel DB
```bash
cd /Users/alessandrocasu/Develop/Financy/apps/api
npx prisma db push --skip-generate
```

### Riapplicare Calibrazione
```bash
# Login e ottieni token
TOKEN=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.casu@gmail.com","password":"test123"}' | jq -r '.accessToken')

# Applica calibrazione
curl -s -X POST "http://localhost:3001/api/calibration/set-reference" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"referenceValue": 9972.84}' | jq '.'
```

## 📦 Ultime Modifiche (Pushate su GitHub)

### Commit aa596da - docs: add database schema and deployment instructions
- Schema DB esportato per produzione
- Documentazione deployment completa

### Commit 0802b33 - feat: AI Advisor to Trading integration + portfolio calibration
- **AI Advisor → Trading**: Bottone "Aggiungi in Trading"
- **Portfolio Calibration**: Fattore di aggiustamento prezzi EUR
- **Bug fixes**: Colonne DB mancanti, duplicati portfolio

## 🌐 URLs

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Portfolio**: http://localhost:3000/portfolio
- **Trading**: http://localhost:3000/trading
- **AI Advisor**: http://localhost:3000/advisor

## 📝 Log Files

```bash
# API logs
tail -f /tmp/financy-api.log

# Web logs
tail -f /tmp/financy-web.log
```

## ⚠️ Note Importanti

1. **Calibrazione attiva**: I prezzi EUR sono moltiplicati per 1.0318
2. **User ID**: cmkzlyxz20000atvnb10yeu6g
3. **Portfolio Value**: €9,972.84 (calibrato, matching Trade Republic)
4. **Git history**: Pulita da secrets (workflows-list.json rimosso)

## 🚢 Deploy Produzione

Vedi file: `apps/api/DEPLOY.md`

---

**Data**: 2026-02-14
**Ultima modifica**: Calibrazione portfolio + AI Advisor integration
