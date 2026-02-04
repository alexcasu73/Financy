#!/bin/bash
set -e

# Financy - Docker Backup Script

echo "💾 Financy Docker Backup"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create backup directory
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Creating database backup...${NC}"

# Backup PostgreSQL
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U financy financy > "$BACKUP_DIR/database.sql"
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U financy financy_n8n > "$BACKUP_DIR/database_n8n.sql"
echo -e "${GREEN}✓ Database backed up${NC}"

# Backup volumes
echo ""
echo -e "${YELLOW}📦 Backing up volumes...${NC}"

# Backup n8n data
docker run --rm \
    -v financy_n8n_data:/data \
    -v "$(pwd)/$BACKUP_DIR":/backup \
    alpine tar czf /backup/n8n_data.tar.gz -C /data .
echo -e "${GREEN}✓ n8n data backed up${NC}"

# Backup Redis data
docker run --rm \
    -v financy_redis_data:/data \
    -v "$(pwd)/$BACKUP_DIR":/backup \
    alpine tar czf /backup/redis_data.tar.gz -C /data .
echo -e "${GREEN}✓ Redis data backed up${NC}"

# Backup configuration
echo ""
echo -e "${YELLOW}📦 Backing up configuration...${NC}"
cp .env.production "$BACKUP_DIR/" 2>/dev/null || true
cp nginx/nginx.conf "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}✓ Configuration backed up${NC}"

# Compress entire backup
echo ""
echo -e "${YELLOW}🗜️  Compressing backup...${NC}"
tar czf "$BACKUP_DIR.tar.gz" -C backups "$(basename $BACKUP_DIR)"
rm -rf "$BACKUP_DIR"
echo -e "${GREEN}✓ Backup compressed${NC}"

# Keep only last 7 backups
echo ""
echo -e "${YELLOW}🧹 Cleaning old backups...${NC}"
ls -t backups/*.tar.gz | tail -n +8 | xargs -r rm
echo -e "${GREEN}✓ Old backups cleaned${NC}"

echo ""
echo -e "${GREEN}✅ Backup completed: $BACKUP_DIR.tar.gz${NC}"
echo ""
echo "To restore: ./restore-docker.sh $BACKUP_DIR.tar.gz"
