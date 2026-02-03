# Fix Notifiche Telegram - Riepilogo

## Problemi Identificati e Risolti

### 1. ✅ Notifiche mancanti in `apps/api/src/routes/internal.ts`
**Problema**: Le notifiche venivano inviate solo al canale `in_app`, Telegram era escluso.
**Fix**: Aggiunta notifica Telegram separata dopo la notifica in-app (linea ~728).

### 2. ✅ Notifiche mancanti in `apps/api/src/routes/trading.ts`
**Problema**: Stesso problema, solo notifiche `in_app`.
**Fix**: Aggiunta notifica Telegram separata (linea ~748).

### 3. ✅ Script di verifica creato
**File**: `apps/api/scripts/check-telegram-settings.ts`
**Scopo**: Verifica configurazione Telegram per tutti gli utenti.

### 4. ✅ Script di test creato
**File**: `test-telegram.sh`
**Scopo**: Test automatico delle notifiche Telegram.

## Come Verificare e Testare

### Prerequisiti

1. **Variabile d'ambiente configurata**:
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```
   ✅ Già configurata nel file `.env`

2. **Database attivo**:
   ```bash
   docker-compose up -d postgres
   # oppure
   npm run db:start
   ```

3. **API server attivo**:
   ```bash
   cd apps/api
   npm run dev
   ```

### Passo 1: Verifica Configurazione Utente

Esegui lo script di verifica:
```bash
cd apps/api
npx tsx scripts/check-telegram-settings.ts
```

Questo mostrerà:
- Quali utenti hanno Telegram abilitato
- Chi ha il Chat ID configurato
- Stato delle variabili d'ambiente

### Passo 2: Configura Telegram (se necessario)

Se l'utente non ha il Chat ID configurato:

1. **Trova il tuo bot su Telegram**:
   - Cerca il bot usando il token configurato in `.env`
   - Oppure usa `@BotFather` per vedere i tuoi bot

2. **Invia `/start` al bot**

3. **Ottieni il Chat ID** tramite API:
   ```bash
   curl -X GET http://localhost:3001/api/settings/telegram/chat-id \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

4. **Aggiorna le impostazioni**:
   ```bash
   curl -X PUT http://localhost:3001/api/settings \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"telegramChatId": "YOUR_CHAT_ID", "telegramEnabled": true}'
   ```

### Passo 3: Test Automatico

Usa lo script di test (più semplice):
```bash
./test-telegram.sh http://localhost:3001 YOUR_JWT_TOKEN
```

Lo script farà automaticamente:
- Verifica impostazioni attuali
- Recupera Chat ID se mancante
- Aggiorna le impostazioni
- Invia notifica di test

### Passo 4: Test Manuale

Invia una notifica di test:
```bash
curl -X POST http://localhost:3001/api/settings/telegram/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Dovresti ricevere un messaggio su Telegram con:
> 🎉 **Test notifica Financy**
>
> Le notifiche Telegram funzionano correttamente!

## Verifica delle Fix

### Alert
Gli alert useranno i canali configurati nel campo `channels` dell'alert stesso.
Per abilitare Telegram negli alert esistenti, aggiorna il campo `channels`:
```sql
UPDATE alerts SET channels = '["in_app", "telegram"]' WHERE channels = '["in_app"]';
```

### Trading Signals
Le notifiche di trading ora inviano **sempre** sia:
- Notifica in-app (per l'interfaccia web)
- Notifica Telegram (se l'utente ha Telegram abilitato)

Questo vale per:
- `apps/api/src/services/trading.ts` - Analisi automatica
- `apps/api/src/routes/internal.ts` - Segnali da n8n
- `apps/api/src/routes/trading.ts` - API manuali

## Flusso delle Notifiche Telegram

```
┌─────────────────────────────────────────┐
│ Evento (Alert, Trading Signal, etc.)    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ NotificationService.notify()             │
│ channels: ["in_app", "telegram"]        │
└────────────────┬────────────────────────┘
                 │
                 ├─────────────────────────┐
                 │                         │
                 ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐
│ sendInApp()          │  │ sendTelegram()       │
│ - Salva in DB        │  │ - Verifica token     │
│ - Emette WebSocket   │  │ - Verifica settings  │
│ - Chiama sendTelegram│  │ - Invia via API      │
└──────────────────────┘  └──────────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │ Check User Settings  │
                          │ - telegramEnabled?   │
                          │ - telegramChatId?    │
                          └──────────┬───────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │ Telegram API         │
                          │ POST /sendMessage    │
                          └──────────────────────┘
```

## Checklist Finale

- [x] Fix in `routes/internal.ts`
- [x] Fix in `routes/trading.ts`
- [x] Script di verifica creato
- [x] Script di test creato
- [ ] Database avviato
- [ ] API server avviato
- [ ] Telegram Chat ID configurato
- [ ] Test notifica inviato con successo

## Troubleshooting

### "TELEGRAM_BOT_TOKEN not configured"
- Verifica che `.env` contenga `TELEGRAM_BOT_TOKEN=...`
- Riavvia l'API server dopo aver modificato `.env`

### "Telegram not enabled for user"
- Esegui lo script di test che configurerà automaticamente
- Oppure aggiorna manualmente le impostazioni tramite API

### "Telegram API error"
- Verifica che il bot token sia valido
- Verifica che il Chat ID sia corretto
- Assicurati di aver inviato `/start` al bot

### Le notifiche non arrivano comunque
- Verifica i log dell'API server
- Esegui il test manuale con `/api/settings/telegram/test`
- Controlla che `telegramEnabled` sia `true` nelle impostazioni utente
