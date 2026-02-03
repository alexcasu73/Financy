# Financy 💰

Sistema intelligente di trading e gestione portfolio con analisi AI.

## 🌟 Caratteristiche

- **Trading Automatico**: Sistema ibrido con regole deterministiche e spiegazioni AI
- **Analisi AI**: Claude AI genera ragioni contestuali per ogni decisione (BUY/SELL/HOLD)
- **Gestione Portfolio**: Tracking completo di asset, profitti e performance
- **Alerts Intelligenti**: Notifiche personalizzate via Telegram e in-app
- **Dashboard Real-time**: Prezzi aggiornati in tempo reale
- **Multi-valuta**: Supporto per USD, EUR, CHF e altre valute con tassi ECB ufficiali

## 🚀 Quick Start (Sviluppo)

```bash
# Clone repository
git clone https://github.com/alexcasu73/Financy.git
cd Financy

# Installa dipendenze
npm install

# Setup database
cd apps/api
cp .env.example .env
# Configura DATABASE_URL nel .env
npx prisma migrate dev
npx prisma db seed

# Avvia in modalità sviluppo
cd ../..
npm run dev
```

Apri:
- Web: http://localhost:3000
- API: http://localhost:3001
- n8n: http://localhost:5678

## 📦 Deployment in Produzione

### Setup Automatico (Ubuntu 22.04+)

```bash
wget https://raw.githubusercontent.com/alexcasu73/Financy/main/setup-production.sh
chmod +x setup-production.sh
./setup-production.sh
```

Lo script configurerà automaticamente:
- ✅ PostgreSQL
- ✅ Node.js & PM2
- ✅ Nginx con SSL (Let's Encrypt)
- ✅ n8n per automation
- ✅ Firewall (UFW)
- ✅ Auto-restart dei servizi

### Setup Manuale

Consulta la [Guida al Deployment](./DEPLOYMENT.md) per istruzioni dettagliate.

## 🏗️ Architettura

```
Financy/
├── apps/
│   ├── api/          # Backend Fastify + Prisma
│   ├── web/          # Frontend Next.js
│   └── n8n/          # Workflows automation
├── packages/         # Shared packages
└── n8n/
    └── workflows/    # n8n workflow definitions
```

### Stack Tecnologico

**Backend:**
- Fastify - API framework
- Prisma - ORM
- PostgreSQL - Database
- Socket.IO - Real-time communication
- Anthropic Claude - AI analysis

**Frontend:**
- Next.js 14 - React framework
- TailwindCSS - Styling
- Recharts - Data visualization
- Shadcn/ui - UI components

**Automation:**
- n8n - Workflow automation
- PM2 - Process management

## 🔧 Configurazione

### Variabili d'Ambiente

#### API (`apps/api/.env`)
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/financy"
JWT_SECRET="your-jwt-secret"
INTERNAL_API_KEY="your-internal-key"
ANTHROPIC_API_KEY="sk-ant-api03-..."
TELEGRAM_BOT_TOKEN="your-telegram-token"
N8N_WEBHOOK_URL="http://localhost:5678/webhook"
```

#### Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

#### n8n (`n8n/.env`)
```env
N8N_BASIC_AUTH_USER="admin"
N8N_BASIC_AUTH_PASSWORD="your-password"
GENERIC_TIMEZONE="Europe/Rome"
```

## 📊 Sistema di Trading

### Decisioni (Regole Deterministiche)
- **SELL**: Profitto >= +10% (target) O Profitto <= -10% (stop loss)
- **HOLD**: Profitto tra -10% e +10%
- **BUY**: Segnali tecnici favorevoli (RSI, MACD, sentiment)

### Spiegazioni (AI)
Claude AI genera ragioni contestuali analizzando:
- Profitto attuale vs target del profilo
- Indicatori tecnici (RSI, MACD, MA20)
- Sentiment delle news
- Profilo utente (orizzonte, risk tolerance, stile)

Esempio:
> "Target del +10% superato con profitto attuale del +12.3%. RSI a 72 indica ipercomprato e sentiment news neutrale suggerisce consolidamento. Con profilo aggressivo short-term, conviene realizzare i guadagni."

## 🔄 Workflow n8n

I workflow automizzano:
1. **Trading Suggestions**: Genera suggerimenti di nuovi asset da watchare
2. **Asset Monitor**: Analizza asset esistenti e genera segnali BUY/SELL
3. **News Import**: Importa e analizza news di mercato
4. **Alert Monitor**: Verifica condizioni alerts e invia notifiche

## 📝 Comandi Utili

### Sviluppo
```bash
npm run dev              # Avvia tutto in dev mode
npm run build            # Build per produzione
npm run lint             # Linting
```

### Database
```bash
cd apps/api
npx prisma migrate dev   # Crea migrazione
npx prisma migrate deploy # Applica migrazioni (prod)
npx prisma studio        # UI per database
npx prisma db seed       # Seed dati iniziali
```

### Produzione
```bash
pm2 status               # Stato servizi
pm2 logs                 # Log in tempo reale
pm2 restart all          # Restart tutti i servizi
pm2 monit                # Monitoring
```

## 🔐 Security

- JWT per autenticazione
- Password hashate con bcrypt
- Rate limiting su API
- CORS configurato
- SQL injection prevention (Prisma)
- XSS protection
- HTTPS obbligatorio in produzione
- Environment variables per secrets

## 🐛 Troubleshooting

### API non risponde
```bash
pm2 logs financy-api --err
pm2 restart financy-api
```

### Database connection error
```bash
sudo systemctl status postgresql
psql -U financy_user -d financy -h localhost
```

### n8n workflows non funzionano
```bash
pm2 logs n8n
cd /var/www/financy/n8n
n8n import:workflow --input=workflows/
```

## 📚 Documentazione

- [Guida al Deployment](./DEPLOYMENT.md) - Setup produzione completo
- [API Documentation](./docs/API.md) - Endpoint e schema
- [Database Schema](./docs/DATABASE.md) - Struttura database
- [Workflows Guide](./docs/WORKFLOWS.md) - Configurazione n8n

## 🤝 Contributing

Contribuzioni benvenute! Per favore:
1. Fork del repository
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

## 📄 License

MIT License - vedi [LICENSE](./LICENSE) per dettagli.

## 🙏 Credits

Sviluppato con ❤️ usando:
- [Anthropic Claude](https://anthropic.com) - AI Analysis
- [n8n](https://n8n.io) - Workflow Automation
- [Prisma](https://prisma.io) - Database ORM
- [Next.js](https://nextjs.org) - React Framework
- [Fastify](https://fastify.io) - Web Framework

## 📞 Support

- 🐛 Issues: [GitHub Issues](https://github.com/alexcasu73/Financy/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/alexcasu73/Financy/discussions)
- 📧 Email: support@financy.app

---

**Made with** 🧠 **by Claude Code & Alessandro Casu**
