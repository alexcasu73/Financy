# Deployment Instructions

## Database Setup

### 1. Create Database
```bash
createdb financy
```

### 2. Import Schema
```bash
psql -d financy < database-schema.sql
```

### 3. Run Pending Migrations
```bash
cd apps/api
npx prisma db push
```

## Required Environment Variables

### API (.env)
```
DATABASE_URL="postgresql://user:password@host:5432/financy"
JWT_SECRET="your-secret-key"
REDIS_URL="redis://localhost:6379" # optional
N8N_WEBHOOK_URL="http://n8n:5678"
```

### Web (.env.local)
```
NEXT_PUBLIC_API_URL="https://your-api-url"
```

## Important Database Columns

Make sure these columns exist after migration:
- `user_settings.reference_portfolio_value` - For portfolio calibration
- `user_settings.eur_price_adjustment_factor` - Calibration factor (default: 1.0)
- `user_settings.last_calibration_at` - Last calibration timestamp
- `trading_profiles.resuggest_dismissed_after_days` - Suggestion reappearance delay

## Post-Deployment

### 1. Set Portfolio Calibration (if needed)
```bash
curl -X POST https://your-api-url/api/calibration/set-reference \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"referenceValue": 9972.84}'
```

### 2. Verify Trading Profile
```bash
curl https://your-api-url/api/trading/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## New Features in This Deployment

- ✅ AI Advisor → Trading integration
- ✅ Direct asset addition to Trading from AI Advisor
- ✅ Portfolio calibration system
- ✅ EUR price adjustment factor
