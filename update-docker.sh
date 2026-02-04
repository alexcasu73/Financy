#!/bin/bash
set -e

# Financy - Docker Update Script

echo "🔄 Financy Docker Update"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Backup database before update
echo -e "${YELLOW}💾 Creating database backup...${NC}"
./backup-docker.sh

# Pull latest code
echo ""
echo -e "${YELLOW}📥 Pulling latest code...${NC}"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"

# Pull latest images
echo ""
echo -e "${YELLOW}📥 Pulling Docker images...${NC}"
docker compose -f docker-compose.prod.yml pull
echo -e "${GREEN}✓ Images updated${NC}"

# Rebuild application images
echo ""
echo -e "${YELLOW}🔨 Rebuilding application...${NC}"
docker compose -f docker-compose.prod.yml build
echo -e "${GREEN}✓ Build completed${NC}"

# Run migrations
echo ""
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/apps/api && npx prisma migrate deploy"
echo -e "${GREEN}✓ Migrations completed${NC}"

# Restart services
echo ""
echo -e "${YELLOW}🔄 Restarting services...${NC}"
docker compose -f docker-compose.prod.yml up -d --force-recreate
echo -e "${GREEN}✓ Services restarted${NC}"

# Clean up old images
echo ""
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f
echo -e "${GREEN}✓ Cleanup completed${NC}"

echo ""
echo -e "${GREEN}✅ Update completed successfully!${NC}"
echo ""
echo "View logs: docker compose -f docker-compose.prod.yml logs -f"
