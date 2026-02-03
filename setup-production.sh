#!/bin/bash
set -e

# Financy - Production Setup Script
# Questo script automatizza il deployment su Ubuntu 22.04+

echo "🚀 Financy Production Setup"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}❌ Non eseguire questo script come root${NC}"
   exit 1
fi

# Prompt for configuration
echo -e "${YELLOW}📝 Configurazione${NC}"
read -p "Domain name (es: financy.example.com): " DOMAIN
read -p "Email per SSL (Let's Encrypt): " EMAIL
read -sp "Password PostgreSQL: " DB_PASSWORD
echo ""
read -sp "JWT Secret (lascia vuoto per generare): " JWT_SECRET
echo ""
read -sp "Internal API Key (lascia vuoto per generare): " INTERNAL_KEY
echo ""
read -p "Anthropic API Key: " ANTHROPIC_KEY
read -p "Telegram Bot Token (opzionale): " TELEGRAM_TOKEN
read -sp "n8n Admin Password: " N8N_PASSWORD
echo ""

# Generate secrets if empty
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}✓ JWT Secret generato${NC}"
fi

if [ -z "$INTERNAL_KEY" ]; then
    INTERNAL_KEY=$(openssl rand -hex 32)
    echo -e "${GREEN}✓ Internal API Key generato${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Installazione dipendenze...${NC}"

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
  git \
  curl \
  build-essential \
  nginx \
  postgresql \
  postgresql-contrib \
  certbot \
  python3-certbot-nginx \
  htop \
  iotop

# Install Node.js 20.x
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓ Node.js installato${NC}"
else
    echo -e "${GREEN}✓ Node.js già installato${NC}"
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 installato${NC}"
else
    echo -e "${GREEN}✓ PM2 già installato${NC}"
fi

# Install n8n
if ! command -v n8n &> /dev/null; then
    sudo npm install -g n8n
    echo -e "${GREEN}✓ n8n installato${NC}"
else
    echo -e "${GREEN}✓ n8n già installato${NC}"
fi

echo ""
echo -e "${YELLOW}🗄️  Setup PostgreSQL...${NC}"

# Setup PostgreSQL
sudo -u postgres psql <<EOF
CREATE DATABASE financy;
CREATE USER financy_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE financy TO financy_user;
ALTER DATABASE financy OWNER TO financy_user;
EOF

echo -e "${GREEN}✓ Database creato${NC}"

echo ""
echo -e "${YELLOW}📂 Setup directory applicazione...${NC}"

# Create app directory
sudo mkdir -p /var/www/financy
sudo chown -R $USER:$USER /var/www/financy

# Clone or update repository
if [ -d "/var/www/financy/.git" ]; then
    cd /var/www/financy
    git pull origin main
    echo -e "${GREEN}✓ Repository aggiornato${NC}"
else
    git clone https://github.com/alexcasu73/Financy.git /var/www/financy
    cd /var/www/financy
    echo -e "${GREEN}✓ Repository clonato${NC}"
fi

# Install dependencies
npm install
echo -e "${GREEN}✓ Dipendenze installate${NC}"

echo ""
echo -e "${YELLOW}⚙️  Configurazione environment...${NC}"

# Create API .env
cat > /var/www/financy/apps/api/.env << EOF
DATABASE_URL="postgresql://financy_user:$DB_PASSWORD@localhost:5432/financy"
JWT_SECRET="$JWT_SECRET"
INTERNAL_API_KEY="$INTERNAL_KEY"
ANTHROPIC_API_KEY="$ANTHROPIC_KEY"
TELEGRAM_BOT_TOKEN="$TELEGRAM_TOKEN"
N8N_WEBHOOK_URL="http://localhost:5678/webhook"
NODE_ENV="production"
EOF

chmod 600 /var/www/financy/apps/api/.env
echo -e "${GREEN}✓ API .env creato${NC}"

# Create Web .env
cat > /var/www/financy/apps/web/.env.local << EOF
NEXT_PUBLIC_API_URL="http://localhost:3001"
NODE_ENV="production"
EOF

chmod 600 /var/www/financy/apps/web/.env.local
echo -e "${GREEN}✓ Web .env.local creato${NC}"

# Create n8n .env
mkdir -p /var/www/financy/n8n/.n8n-data
cat > /var/www/financy/n8n/.env << EOF
N8N_HOST="0.0.0.0"
N8N_PORT=5678
N8N_PROTOCOL="http"
WEBHOOK_URL="http://localhost:5678/"
N8N_USER_FOLDER="/var/www/financy/n8n/.n8n-data"
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER="admin"
N8N_BASIC_AUTH_PASSWORD="$N8N_PASSWORD"
GENERIC_TIMEZONE="Europe/Rome"
EOF

echo -e "${GREEN}✓ n8n .env creato${NC}"

echo ""
echo -e "${YELLOW}🗄️  Migrazione database...${NC}"

# Run Prisma migrations
cd /var/www/financy/apps/api
npx prisma migrate deploy
echo -e "${GREEN}✓ Migrazioni eseguite${NC}"

echo ""
echo -e "${YELLOW}🔨 Build applicazioni...${NC}"

# Build applications
cd /var/www/financy
npm run build
echo -e "${GREEN}✓ Build completato${NC}"

echo ""
echo -e "${YELLOW}🔄 Setup PM2...${NC}"

# Create PM2 ecosystem
cat > /var/www/financy/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'financy-api',
      cwd: '/var/www/financy/apps/api',
      script: 'npm',
      args: 'start',
      env: { NODE_ENV: 'production', PORT: 3001 },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'financy-web',
      cwd: '/var/www/financy/apps/web',
      script: 'npm',
      args: 'start',
      env: { NODE_ENV: 'production', PORT: 3000 },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M'
    },
    {
      name: 'n8n',
      cwd: '/var/www/financy/n8n',
      script: 'n8n',
      args: 'start',
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
EOF

# Start applications
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | bash
echo -e "${GREEN}✓ PM2 configurato e avviato${NC}"

echo ""
echo -e "${YELLOW}🌐 Configurazione Nginx...${NC}"

# Create Nginx config
sudo tee /etc/nginx/sites-available/financy > /dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/financy /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t && sudo systemctl restart nginx
echo -e "${GREEN}✓ Nginx configurato${NC}"

echo ""
echo -e "${YELLOW}🔒 Setup SSL...${NC}"

# Get SSL certificate
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL
echo -e "${GREEN}✓ SSL configurato${NC}"

echo ""
echo -e "${YELLOW}🔥 Configurazione Firewall...${NC}"

# Configure UFW
sudo ufw --force enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo -e "${GREEN}✓ Firewall configurato${NC}"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Setup completato!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${YELLOW}📝 Informazioni importanti:${NC}"
echo ""
echo "🌐 URL: https://$DOMAIN"
echo "🔐 n8n: https://$DOMAIN/n8n (user: admin, password: $N8N_PASSWORD)"
echo ""
echo "📊 Comandi utili:"
echo "  - Stato servizi: pm2 status"
echo "  - Log: pm2 logs"
echo "  - Restart: pm2 restart all"
echo "  - Update: cd /var/www/financy && ./update.sh"
echo ""
echo "📂 File importanti:"
echo "  - API .env: /var/www/financy/apps/api/.env"
echo "  - Web .env: /var/www/financy/apps/web/.env.local"
echo "  - n8n .env: /var/www/financy/n8n/.env"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "1. Importa i workflows n8n manualmente da /var/www/financy/n8n/workflows/"
echo "2. Configura il Telegram Bot se necessario"
echo "3. Crea il primo utente accedendo all'app"
echo ""
echo -e "${GREEN}Buon lavoro! 🚀${NC}"
