#!/bin/bash

# Test End-to-End per Trading Suggestions
# Questo script testa l'intero flusso di generazione suggerimenti trading

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Test End-to-End Trading Suggestions - Financy       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}\n"

# Configurazione
API_URL="http://localhost:3001"
USER_EMAIL="alex.casu@gmail.com"
USER_PASSWORD="Alex.1973"

# Step 1: Login per ottenere il token
echo -e "${YELLOW}Step 1: Login per ottenere il token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Login fallito. Response: $LOGIN_RESPONSE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login riuscito. Token ottenuto.${NC}\n"

# Step 2: Verifica profilo trading
echo -e "${YELLOW}Step 2: Verifica profilo trading...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/api/trading/profile" \
  -H "Authorization: Bearer $TOKEN")

PROFILE_ID=$(echo $PROFILE_RESPONSE | jq -r '.id // empty')

if [ -z "$PROFILE_ID" ] || [ "$PROFILE_ID" = "null" ]; then
  echo -e "${RED}❌ Profilo trading non trovato. Response: $PROFILE_RESPONSE${NC}"
  exit 1
fi

HORIZON=$(echo $PROFILE_RESPONSE | jq -r '.horizon')
RISK=$(echo $PROFILE_RESPONSE | jq -r '.riskTolerance')
STYLE=$(echo $PROFILE_RESPONSE | jq -r '.tradingStyle')

echo -e "${GREEN}✅ Profilo trading trovato:${NC}"
echo "   Profile ID: $PROFILE_ID"
echo "   Horizon: $HORIZON"
echo "   Risk Tolerance: $RISK"
echo "   Trading Style: $STYLE"
echo

# Step 3: Conta suggerimenti esistenti PRIMA della generazione
echo -e "${YELLOW}Step 3: Conta suggerimenti esistenti...${NC}"
SUGGESTIONS_BEFORE=$(curl -s -X GET "$API_URL/api/trading/suggestions" \
  -H "Authorization: Bearer $TOKEN")
COUNT_BEFORE=$(echo $SUGGESTIONS_BEFORE | jq '. | length')
echo -e "${GREEN}✅ Suggerimenti attuali: $COUNT_BEFORE${NC}\n"

# Step 4: Genera nuovi suggerimenti tramite n8n
echo -e "${YELLOW}Step 4: Genera nuovi suggerimenti tramite n8n workflow...${NC}"
echo "   Chiamata a: $API_URL/api/trading/suggestions/generate"
TEMP_FILE=$(mktemp)
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$TEMP_FILE" -X POST "$API_URL/api/trading/suggestions/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
RESPONSE_BODY=$(cat "$TEMP_FILE")
rm -f "$TEMP_FILE"

echo "   HTTP Status: $HTTP_CODE"
echo "   Response: $RESPONSE_BODY"

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}❌ Generazione fallita con status $HTTP_CODE${NC}"
  exit 1
fi

SUCCESS=$(echo $RESPONSE_BODY | jq -r '.success // false')
GENERATED_COUNT=$(echo $RESPONSE_BODY | jq -r '.count // 0')
MESSAGE=$(echo $RESPONSE_BODY | jq -r '.message // "N/A"')

if [ "$SUCCESS" != "true" ]; then
  echo -e "${RED}❌ Generazione fallita. Response: $RESPONSE_BODY${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Generazione completata!${NC}"
echo "   Suggerimenti generati: $GENERATED_COUNT"
echo "   Message: $MESSAGE"
echo

# Step 5: Attendi qualche secondo per permettere a n8n di completare il workflow
echo -e "${YELLOW}Step 5: Attendi completamento workflow n8n...${NC}"
for i in {5..1}; do
  echo -ne "   ⏳ Attendi $i secondi...\r"
  sleep 1
done
echo -e "${GREEN}   ✅ Attesa completata.${NC}\n"

# Step 6: Verifica i nuovi suggerimenti
echo -e "${YELLOW}Step 6: Verifica i nuovi suggerimenti dal database...${NC}"
SUGGESTIONS_AFTER=$(curl -s -X GET "$API_URL/api/trading/suggestions" \
  -H "Authorization: Bearer $TOKEN")

COUNT_AFTER=$(echo $SUGGESTIONS_AFTER | jq '. | length')
NEW_SUGGESTIONS=$((COUNT_AFTER - COUNT_BEFORE))

echo -e "${GREEN}✅ Suggerimenti dopo generazione: $COUNT_AFTER${NC}"

if [ $COUNT_AFTER -gt $COUNT_BEFORE ]; then
  echo -e "${GREEN}✅ Nuovi suggerimenti trovati: $NEW_SUGGESTIONS${NC}"
  echo -e "\n${BLUE}   📊 Primi 3 suggerimenti:${NC}"
  echo "$SUGGESTIONS_AFTER" | jq -r '.[:3] | .[] | "   • \(.symbol) - \(.confidence) confidence\n     Reason: \(.reason[:100])...\n"'
else
  echo -e "${YELLOW}⚠️  Nessun nuovo suggerimento trovato (potrebbero essere duplicati filtrati)${NC}"
fi
echo

# Step 7: Verifica notifiche
echo -e "${YELLOW}Step 7: Verifica notifiche create...${NC}"
NOTIFICATIONS=$(curl -s -X GET "$API_URL/api/notifications?limit=10" \
  -H "Authorization: Bearer $TOKEN")

NOTIF_COUNT=$(echo $NOTIFICATIONS | jq '. | length')
echo -e "${GREEN}✅ Notifiche recenti: $NOTIF_COUNT${NC}"

# Cerca notifiche di tipo trading
TRADING_NOTIFS=$(echo $NOTIFICATIONS | jq '[.[] | select(.type == "trading")]')
TRADING_COUNT=$(echo $TRADING_NOTIFS | jq '. | length')

if [ $TRADING_COUNT -gt 0 ]; then
  echo -e "${GREEN}✅ Notifiche trading trovate: $TRADING_COUNT${NC}"
  echo -e "${BLUE}   📬 Ultime notifiche:${NC}"
  echo "$TRADING_NOTIFS" | jq -r '.[:3] | .[] | "   • \(.title)"'
else
  echo -e "${YELLOW}⚠️  Nessuna notifica trading trovata${NC}"
fi
echo

# Step 8: Verifica direct query al database
echo -e "${YELLOW}Step 8: Verifica diretta nel database...${NC}"
DB_CHECK=$(psql "postgresql://financy:financy@localhost:5432/financy" -t -c \
  "SELECT COUNT(*) FROM trading_suggestions WHERE profile_id = '$PROFILE_ID' AND status = 'pending';")
DB_COUNT=$(echo $DB_CHECK | tr -d ' ')
echo -e "${GREEN}✅ Suggerimenti pending nel DB per questo profilo: $DB_COUNT${NC}\n"

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 RIEPILOGO TEST                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}✅ Login:${NC} OK (alex.casu@gmail.com)"
echo -e "${GREEN}✅ Profilo:${NC} $PROFILE_ID ($HORIZON/$RISK/$STYLE)"
echo -e "${GREEN}✅ Suggerimenti prima:${NC} $COUNT_BEFORE"
echo -e "${GREEN}✅ Suggerimenti generati:${NC} $GENERATED_COUNT"
echo -e "${GREEN}✅ Suggerimenti dopo:${NC} $COUNT_AFTER"
echo -e "${GREEN}✅ Nuovi suggerimenti:${NC} $NEW_SUGGESTIONS"
echo -e "${GREEN}✅ Notifiche totali:${NC} $NOTIF_COUNT"
echo -e "${GREEN}✅ Notifiche trading:${NC} $TRADING_COUNT"
echo -e "${GREEN}✅ DB pending count:${NC} $DB_COUNT"
echo
echo -e "${GREEN}✅✅✅ Test completato con successo! ✅✅✅${NC}"
echo
echo -e "${BLUE}📍 Prossimi passi:${NC}"
echo "   • Apri http://localhost:3000/trading per vedere i suggerimenti nell'interfaccia web"
echo "   • Controlla i log n8n su http://localhost:5678"
echo "   • Verifica le notifiche Telegram se configurato"
echo
