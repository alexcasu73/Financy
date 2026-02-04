#!/bin/bash
set -e

# Financy - Docker Production Setup Script
# This script automates the complete Docker deployment

echo "🚀 Financy Docker Production Setup"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}❌ Don't run this script as root${NC}"
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Docker not found. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✓ Docker installed${NC}"
    echo -e "${YELLOW}⚠️  Please log out and log back in for Docker permissions to take effect${NC}"
    echo -e "${YELLOW}   Then run this script again.${NC}"
    exit 0
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found${NC}"
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

echo -e "${BLUE}📝 Configuration Setup${NC}"
echo ""

# Prompt for configuration
read -p "Domain name (e.g., financy.example.com): " DOMAIN
read -p "Email for SSL (Let's Encrypt): " EMAIL

# Generate secure passwords and secrets
echo ""
echo -e "${YELLOW}🔐 Generating secure credentials...${NC}"

DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 32)
INTERNAL_KEY=$(openssl rand -hex 32)
N8N_API_KEY=$(openssl rand -hex 32)
N8N_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)

echo -e "${GREEN}✓ Credentials generated${NC}"

# Get Anthropic API Key
echo ""
read -p "Anthropic API Key: " ANTHROPIC_KEY
read -p "Telegram Bot Token (optional, press Enter to skip): " TELEGRAM_TOKEN

# Create .env.production file
echo ""
echo -e "${YELLOW}📝 Creating configuration file...${NC}"

cat > .env.production << EOF
# Database Configuration
POSTGRES_USER=financy
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=financy

# JWT & API Keys
JWT_SECRET=$JWT_SECRET
INTERNAL_API_KEY=$INTERNAL_KEY

# Anthropic API
ANTHROPIC_API_KEY=$ANTHROPIC_KEY

# Telegram
TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN

# n8n Configuration
N8N_API_KEY=$N8N_API_KEY
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=$N8N_PASSWORD
N8N_WEBHOOK_URL=https://$DOMAIN/webhook

# Application URLs
NEXT_PUBLIC_API_URL=https://$DOMAIN/api

# Timezone
TIMEZONE=Europe/Rome

# Redis
REDIS_URL=redis://redis:6379
EOF

chmod 600 .env.production
echo -e "${GREEN}✓ Configuration file created${NC}"

# Save credentials to a secure file
cat > credentials.txt << EOF
=================================
FINANCY CREDENTIALS
=================================
Domain: https://$DOMAIN

Database:
  User: financy
  Password: $DB_PASSWORD
  Database: financy

n8n Admin:
  Username: admin
  Password: $N8N_PASSWORD
  URL: https://$DOMAIN/n8n

API Keys:
  JWT Secret: $JWT_SECRET
  Internal API Key: $INTERNAL_KEY
  n8n API Key: $N8N_API_KEY

=================================
⚠️  SAVE THESE CREDENTIALS SECURELY
   Delete this file after saving!
=================================
EOF

chmod 600 credentials.txt
echo -e "${GREEN}✓ Credentials saved to credentials.txt${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: Save credentials.txt securely and delete it!${NC}"

# Create necessary directories
echo ""
echo -e "${YELLOW}📂 Creating directories...${NC}"
mkdir -p nginx/ssl
mkdir -p n8n/workflows
echo -e "${GREEN}✓ Directories created${NC}"

# Pull Docker images
echo ""
echo -e "${YELLOW}📥 Pulling Docker images...${NC}"
docker compose -f docker-compose.prod.yml pull
echo -e "${GREEN}✓ Images pulled${NC}"

# Build application images
echo ""
echo -e "${YELLOW}🔨 Building application images...${NC}"
echo -e "${YELLOW}   This may take several minutes...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache --build-arg BUILDKIT_INLINE_CACHE=1
echo -e "${GREEN}✓ Images built${NC}"

# Start services
echo ""
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose -f docker-compose.prod.yml up -d postgres redis
sleep 5

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL...${NC}"
until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U financy > /dev/null 2>&1; do
    sleep 1
done
echo -e "${GREEN}✓ PostgreSQL ready${NC}"

# Create n8n database
echo -e "${YELLOW}🗄️  Creating n8n database...${NC}"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U financy -c "CREATE DATABASE financy_n8n;" || true
echo -e "${GREEN}✓ n8n database created${NC}"

# Run database migrations
echo ""
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/apps/api && npx prisma migrate deploy"
echo -e "${GREEN}✓ Migrations completed${NC}"

# Start remaining services
echo ""
echo -e "${YELLOW}🚀 Starting all services...${NC}"
docker compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ All services started${NC}"

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Setup SSL with Let's Encrypt
echo ""
echo -e "${YELLOW}🔒 Setting up SSL certificate...${NC}"

# First, get the certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ SSL certificate obtained${NC}"

    # Update nginx config to use SSL
    echo -e "${YELLOW}🔧 Updating Nginx configuration for HTTPS...${NC}"

    # Update nginx.conf to enable HTTPS
    sed -i "s/your-domain.com/$DOMAIN/g" nginx/nginx.conf
    sed -i 's/# location \//location \//g' nginx/nginx.conf
    sed -i 's/#     return 301/    return 301/g' nginx/nginx.conf
    sed -i 's/# server {/server {/g' nginx/nginx.conf
    sed -i 's/#     listen 443/    listen 443/g' nginx/nginx.conf

    # Reload nginx
    docker compose -f docker-compose.prod.yml restart nginx
    echo -e "${GREEN}✓ Nginx configured for HTTPS${NC}"
else
    echo -e "${YELLOW}⚠️  SSL certificate setup failed. You can set it up manually later.${NC}"
fi

# Check services status
echo ""
echo -e "${YELLOW}📊 Checking services status...${NC}"
docker compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}✅ Setup Completed Successfully!${NC}"
echo -e "${GREEN}===================================${NC}"
echo ""
echo -e "${BLUE}📝 Important Information:${NC}"
echo ""
echo -e "🌐 Application URL: ${GREEN}https://$DOMAIN${NC}"
echo -e "🔧 n8n URL: ${GREEN}https://$DOMAIN/n8n${NC}"
echo -e "   Username: ${YELLOW}admin${NC}"
echo -e "   Password: ${YELLOW}$N8N_PASSWORD${NC}"
echo ""
echo -e "${BLUE}📊 Useful Commands:${NC}"
echo -e "  View logs:        ${YELLOW}docker compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "  View logs (API):  ${YELLOW}docker compose -f docker-compose.prod.yml logs -f api${NC}"
echo -e "  Restart services: ${YELLOW}docker compose -f docker-compose.prod.yml restart${NC}"
echo -e "  Stop services:    ${YELLOW}docker compose -f docker-compose.prod.yml down${NC}"
echo -e "  Update services:  ${YELLOW}./update-docker.sh${NC}"
echo ""
echo -e "${BLUE}📂 Important Files:${NC}"
echo -e "  Environment:      ${YELLOW}.env.production${NC}"
echo -e "  Credentials:      ${YELLOW}credentials.txt${NC} ${RED}(DELETE AFTER SAVING!)${NC}"
echo -e "  Nginx config:     ${YELLOW}nginx/nginx.conf${NC}"
echo ""
echo -e "${YELLOW}⚠️  NEXT STEPS:${NC}"
echo -e "1. ${YELLOW}Save credentials.txt securely and DELETE it${NC}"
echo -e "2. ${YELLOW}Import n8n workflows from n8n/workflows/${NC}"
echo -e "3. ${YELLOW}Configure Telegram bot if needed${NC}"
echo -e "4. ${YELLOW}Access the application and create your first user${NC}"
echo ""
echo -e "${GREEN}Happy trading! 🚀${NC}"
