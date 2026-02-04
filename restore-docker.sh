#!/bin/bash
set -e

# Financy - Docker Restore Script

if [ -z "$1" ]; then
    echo "Usage: ./restore-docker.sh <backup-file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "💾 Financy Docker Restore"
echo "========================="
echo ""
echo "⚠️  WARNING: This will overwrite current data!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Extract backup
BACKUP_DIR=$(basename "$BACKUP_FILE" .tar.gz)
echo ""
echo -e "${YELLOW}📦 Extracting backup...${NC}"
tar xzf "$BACKUP_FILE" -C backups/
echo -e "${GREEN}✓ Backup extracted${NC}"

# Stop services
echo ""
echo -e "${YELLOW}🛑 Stopping services...${NC}"
docker compose -f docker-compose.prod.yml down
echo -e "${GREEN}✓ Services stopped${NC}"

# Restore database
echo ""
echo -e "${YELLOW}📥 Restoring database...${NC}"
docker compose -f docker-compose.prod.yml up -d postgres
sleep 5

cat "backups/$BACKUP_DIR/database.sql" | docker compose -f docker-compose.prod.yml exec -T postgres psql -U financy financy
cat "backups/$BACKUP_DIR/database_n8n.sql" | docker compose -f docker-compose.prod.yml exec -T postgres psql -U financy financy_n8n
echo -e "${GREEN}✓ Database restored${NC}"

docker compose -f docker-compose.prod.yml down

# Restore volumes
echo ""
echo -e "${YELLOW}📥 Restoring volumes...${NC}"

# Restore n8n data
docker run --rm \
    -v financy_n8n_data:/data \
    -v "$(pwd)/backups/$BACKUP_DIR":/backup \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/n8n_data.tar.gz -C /data"
echo -e "${GREEN}✓ n8n data restored${NC}"

# Restore Redis data
docker run --rm \
    -v financy_redis_data:/data \
    -v "$(pwd)/backups/$BACKUP_DIR":/backup \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/redis_data.tar.gz -C /data"
echo -e "${GREEN}✓ Redis data restored${NC}"

# Restore configuration
echo ""
echo -e "${YELLOW}📥 Restoring configuration...${NC}"
cp "backups/$BACKUP_DIR/.env.production" . 2>/dev/null || true
cp "backups/$BACKUP_DIR/nginx.conf" nginx/ 2>/dev/null || true
echo -e "${GREEN}✓ Configuration restored${NC}"

# Cleanup
rm -rf "backups/$BACKUP_DIR"

# Start services
echo ""
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ Services started${NC}"

echo ""
echo -e "${GREEN}✅ Restore completed successfully!${NC}"
echo ""
echo "View logs: docker compose -f docker-compose.prod.yml logs -f"
