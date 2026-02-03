# Financy - Guida al Deployment in Produzione

## Prerequisiti

- **Server**: Ubuntu 22.04 LTS o superiore
- **RAM**: Minimo 2GB (consigliato 4GB)
- **CPU**: Minimo 2 cores
- **Storage**: Minimo 20GB
- **Porte**: 80, 443, 3000, 3001, 5432, 5678

## 1. Preparazione del Server

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa dipendenze base
sudo apt install -y \
  git \
  curl \
  build-essential \
  nginx \
  postgresql \
  postgresql-contrib \
  certbot \
  python3-certbot-nginx

# Installa Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installa PM2 per gestire i processi
sudo npm install -g pm2

# Installa n8n globalmente
sudo npm install -g n8n
```

## 2. Setup PostgreSQL

```bash
# Accedi a PostgreSQL
sudo -u postgres psql

# Crea database e utente
CREATE DATABASE financy;
CREATE USER financy_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE financy TO financy_user;
ALTER DATABASE financy OWNER TO financy_user;
\q

# Abilita connessioni remote (opzionale)
sudo nano /etc/postgresql/14/main/postgresql.conf
# Imposta: listen_addresses = '*'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# Aggiungi: host    financy    financy_user    0.0.0.0/0    scram-sha-256

sudo systemctl restart postgresql
```

## 3. Clone del Repository

```bash
# Crea directory per l'applicazione
sudo mkdir -p /var/www/financy
sudo chown -R $USER:$USER /var/www/financy
cd /var/www/financy

# Clone del repository
git clone https://github.com/alexcasu73/Financy.git .

# Installa dipendenze
npm install
```

## 4. Configurazione Environment Variables

```bash
# Crea file .env per API
cat > /var/www/financy/apps/api/.env << 'EOF'
# Database
DATABASE_URL="postgresql://financy_user:your_secure_password_here@localhost:5432/financy"

# JWT Secret (genera con: openssl rand -base64 32)
JWT_SECRET="your_jwt_secret_here"

# Internal API Key (genera con: openssl rand -hex 32)
INTERNAL_API_KEY="your_internal_api_key_here"

# Anthropic API (per AI)
ANTHROPIC_API_KEY="sk-ant-api03-..."

# Telegram Bot (opzionale)
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"

# n8n Webhook URL
N8N_WEBHOOK_URL="http://localhost:5678/webhook"

# Redis (opzionale, per caching)
# REDIS_URL="redis://localhost:6379"

# Ambiente
NODE_ENV="production"
EOF

# Crea file .env per Web
cat > /var/www/financy/apps/web/.env.local << 'EOF'
# API URL (interno)
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Ambiente
NODE_ENV="production"
EOF

# Proteggi i file .env
chmod 600 /var/www/financy/apps/api/.env
chmod 600 /var/www/financy/apps/web/.env.local
```

## 5. Migrazione Database

```bash
cd /var/www/financy/apps/api

# Esegui migrazioni Prisma
npx prisma migrate deploy

# (Opzionale) Seed iniziale
npx prisma db seed
```

## 6. Build delle Applicazioni

```bash
cd /var/www/financy

# Build di tutte le app
npm run build
```

## 7. Setup n8n

```bash
# Crea directory per n8n
mkdir -p /var/www/financy/n8n/.n8n

# Crea file di configurazione n8n
cat > /var/www/financy/n8n/.env << 'EOF'
# n8n Configuration
N8N_HOST="0.0.0.0"
N8N_PORT=5678
N8N_PROTOCOL="http"
WEBHOOK_URL="http://localhost:5678/"

# Paths
N8N_USER_FOLDER="/var/www/financy/n8n/.n8n-data"

# Security
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER="admin"
N8N_BASIC_AUTH_PASSWORD="your_n8n_password_here"

# Timezone
GENERIC_TIMEZONE="Europe/Rome"

# Database (opzionale, usa SQLite per default)
# DB_TYPE="postgresdb"
# DB_POSTGRESDB_HOST="localhost"
# DB_POSTGRESDB_PORT=5432
# DB_POSTGRESDB_DATABASE="n8n"
# DB_POSTGRESDB_USER="n8n_user"
# DB_POSTGRESDB_PASSWORD="your_n8n_db_password"
EOF

# Importa workflows
n8n import:workflow --input=/var/www/financy/n8n/workflows/
```

## 8. Configurazione PM2

```bash
# Crea file ecosystem per PM2
cat > /var/www/financy/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'financy-api',
      cwd: '/var/www/financy/apps/api',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/var/log/financy/api-error.log',
      out_file: '/var/log/financy/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'financy-web',
      cwd: '/var/www/financy/apps/web',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      error_file: '/var/log/financy/web-error.log',
      out_file: '/var/log/financy/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'n8n',
      cwd: '/var/www/financy/n8n',
      script: 'n8n',
      args: 'start',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/financy/n8n-error.log',
      out_file: '/var/log/financy/n8n-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF

# Crea directory per i log
sudo mkdir -p /var/log/financy
sudo chown -R $USER:$USER /var/log/financy

# Avvia le applicazioni
pm2 start ecosystem.config.js

# Salva la configurazione PM2
pm2 save

# Setup PM2 per avvio automatico
pm2 startup
# Esegui il comando suggerito da PM2
```

## 9. Configurazione Nginx

```bash
# Crea configurazione Nginx
sudo nano /etc/nginx/sites-available/financy

# Incolla questa configurazione:
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (certbot gestirà questi certificati)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # n8n (protetto da autenticazione)
    location /n8n/ {
        proxy_pass http://localhost:5678/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Logs
    access_log /var/log/nginx/financy-access.log;
    error_log /var/log/nginx/financy-error.log;
}
```

```bash
# Abilita il sito
sudo ln -s /etc/nginx/sites-available/financy /etc/nginx/sites-enabled/

# Rimuovi default (opzionale)
sudo rm /etc/nginx/sites-enabled/default

# Test configurazione
sudo nginx -t

# Riavvia Nginx
sudo systemctl restart nginx
```

## 10. Setup SSL con Let's Encrypt

```bash
# Ottieni certificato SSL
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal (già configurato automaticamente)
# Test renewal
sudo certbot renew --dry-run
```

## 11. Configurazione Firewall

```bash
# Configura UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Verifica status
sudo ufw status
```

## 12. Backup Automatico

```bash
# Crea script di backup
sudo nano /usr/local/bin/financy-backup.sh
```

```bash
#!/bin/bash
# Backup script per Financy

BACKUP_DIR="/var/backups/financy"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="financy"
DB_USER="financy_user"

# Crea directory backup
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD="your_secure_password_here" pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup .env files
tar -czf $BACKUP_DIR/env_$DATE.tar.gz /var/www/financy/apps/api/.env /var/www/financy/apps/web/.env.local

# Backup n8n workflows
tar -czf $BACKUP_DIR/n8n_$DATE.tar.gz /var/www/financy/n8n/.n8n-data

# Rimuovi backup più vecchi di 30 giorni
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completato: $DATE"
```

```bash
# Rendi eseguibile
sudo chmod +x /usr/local/bin/financy-backup.sh

# Aggiungi a crontab (backup giornaliero alle 2 AM)
sudo crontab -e
# Aggiungi: 0 2 * * * /usr/local/bin/financy-backup.sh >> /var/log/financy/backup.log 2>&1
```

## 13. Monitoraggio

```bash
# Installa monitoring tools
sudo apt install -y htop iotop

# Monitoring PM2
pm2 monit

# Log in tempo reale
pm2 logs

# Status applicazioni
pm2 status

# Restart applicazione
pm2 restart financy-api
pm2 restart financy-web
pm2 restart n8n

# Restart tutte
pm2 restart all
```

## 14. Aggiornamenti

```bash
# Script di aggiornamento
cat > /var/www/financy/update.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Updating Financy..."

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build applications
npm run build

# Run migrations
cd apps/api && npx prisma migrate deploy && cd ../..

# Restart services
pm2 restart all

echo "✅ Update completed!"
EOF

chmod +x /var/www/financy/update.sh

# Per aggiornare in futuro:
# cd /var/www/financy && ./update.sh
```

## 15. Troubleshooting

### Controllare i log

```bash
# Log PM2
pm2 logs financy-api --lines 100
pm2 logs financy-web --lines 100
pm2 logs n8n --lines 100

# Log Nginx
sudo tail -f /var/log/nginx/financy-error.log
sudo tail -f /var/log/nginx/financy-access.log

# Log PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Problemi comuni

**API non risponde:**
```bash
pm2 restart financy-api
pm2 logs financy-api --err
```

**Database connection error:**
```bash
# Verifica PostgreSQL
sudo systemctl status postgresql
# Testa connessione
psql -U financy_user -d financy -h localhost
```

**n8n workflows non funzionano:**
```bash
# Verifica che n8n sia avviato
pm2 status n8n
# Reimporta workflows
cd /var/www/financy/n8n
n8n import:workflow --input=workflows/
```

## 16. Security Checklist

- [ ] Cambia tutte le password di default
- [ ] Genera nuovi JWT_SECRET e INTERNAL_API_KEY
- [ ] Configura firewall (UFW)
- [ ] Abilita SSL con Let's Encrypt
- [ ] Configura backup automatici
- [ ] Limita accesso SSH (solo chiave pubblica)
- [ ] Aggiorna regolarmente il sistema
- [ ] Monitora i log per attività sospette
- [ ] Configura fail2ban per protezione brute-force

## 17. Performance Optimization

```bash
# Ottimizza PostgreSQL
sudo nano /etc/postgresql/14/main/postgresql.conf

# Aggiungi/modifica:
# shared_buffers = 256MB
# effective_cache_size = 1GB
# work_mem = 4MB
# maintenance_work_mem = 64MB

sudo systemctl restart postgresql

# Ottimizza Nginx
sudo nano /etc/nginx/nginx.conf

# Aggiungi in http block:
# gzip on;
# gzip_vary on;
# gzip_types text/plain text/css application/json application/javascript;

sudo systemctl restart nginx
```

## Supporto

Per problemi o domande:
- GitHub Issues: https://github.com/alexcasu73/Financy/issues
- Email: support@financy.app

---

**Ultima modifica**: 2026-02-03
**Versione**: 1.0.0
