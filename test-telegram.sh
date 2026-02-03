#!/bin/bash

# Script per testare le notifiche Telegram
# Uso: ./test-telegram.sh [API_URL] [AUTH_TOKEN]

API_URL=${1:-"http://localhost:3001"}
AUTH_TOKEN=$2

echo "🔍 Testing Telegram Notifications for Financy"
echo "=============================================="
echo ""

# Check if auth token is provided
if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Auth token required"
  echo "Usage: $0 [API_URL] [AUTH_TOKEN]"
  echo ""
  echo "Example:"
  echo "  $0 http://localhost:3001 your_jwt_token"
  echo ""
  echo "To get your token:"
  echo "  1. Login via /api/auth/login"
  echo "  2. Copy the 'token' from the response"
  exit 1
fi

echo "📡 API URL: $API_URL"
echo ""

# 1. Get current settings
echo "1️⃣ Checking current Telegram settings..."
SETTINGS=$(curl -s -X GET "$API_URL/api/settings" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

echo "$SETTINGS" | jq '.'
echo ""

TELEGRAM_ENABLED=$(echo "$SETTINGS" | jq -r '.telegramEnabled // false')
TELEGRAM_CHAT_ID=$(echo "$SETTINGS" | jq -r '.telegramChatId // "null"')

echo "   Telegram Enabled: $TELEGRAM_ENABLED"
echo "   Telegram Chat ID: $TELEGRAM_CHAT_ID"
echo ""

# 2. If chat ID not set, try to get it
if [ "$TELEGRAM_CHAT_ID" == "null" ]; then
  echo "2️⃣ Telegram Chat ID not set. Attempting to retrieve..."
  echo "   ⚠️  Make sure you sent /start to your bot on Telegram first!"
  echo ""

  CHAT_ID_RESPONSE=$(curl -s -X GET "$API_URL/api/settings/telegram/chat-id" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json")

  echo "$CHAT_ID_RESPONSE" | jq '.'

  RETRIEVED_CHAT_ID=$(echo "$CHAT_ID_RESPONSE" | jq -r '.chatId // "null"')

  if [ "$RETRIEVED_CHAT_ID" != "null" ]; then
    echo ""
    echo "   ✅ Chat ID found: $RETRIEVED_CHAT_ID"
    echo "   💡 Now updating settings..."
    echo ""

    UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/api/settings" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"telegramChatId\": \"$RETRIEVED_CHAT_ID\", \"telegramEnabled\": true}")

    echo "$UPDATE_RESPONSE" | jq '.'
    echo ""
  else
    echo ""
    echo "   ❌ Could not retrieve Chat ID"
    echo "   Please:"
    echo "   1. Find your bot on Telegram (check TELEGRAM_BOT_TOKEN in .env)"
    echo "   2. Send /start to the bot"
    echo "   3. Run this script again"
    exit 1
  fi
else
  echo "2️⃣ Chat ID already configured: $TELEGRAM_CHAT_ID"
  echo ""
fi

# 3. Test notification
echo "3️⃣ Sending test notification..."
TEST_RESPONSE=$(curl -s -X POST "$API_URL/api/settings/telegram/test" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

echo "$TEST_RESPONSE" | jq '.'
echo ""

SUCCESS=$(echo "$TEST_RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" == "true" ]; then
  echo "✅ Test notification sent successfully!"
  echo "   Check your Telegram app for the test message"
else
  echo "❌ Test notification failed"
  echo "   Error: $(echo "$TEST_RESPONSE" | jq -r '.message // .error')"
fi

echo ""
echo "=============================================="
echo "Test complete!"
