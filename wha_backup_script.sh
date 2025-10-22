#!/bin/bash

# WHA Backup Script
# Backs up PostgreSQL database and Redis data

set -e

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="wha-backup-${DATE}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Starting WHA backup...${NC}"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Load environment variables
source .env

# Backup PostgreSQL
echo -e "${YELLOW}Backing up PostgreSQL...${NC}"
docker-compose exec -T postgres pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > ${BACKUP_DIR}/${BACKUP_NAME}.sql

# Backup Redis
echo -e "${YELLOW}Backing up Redis...${NC}"
docker-compose exec -T redis redis-cli --pass ${REDIS_PASSWORD} SAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb ${BACKUP_DIR}/${BACKUP_NAME}.rdb

# Backup configuration files
echo -e "${YELLOW}Backing up configuration...${NC}"
tar -czf ${BACKUP_DIR}/${BACKUP_NAME}-config.tar.gz \
    config/ \
    .env.template \
    docker-compose.yml \
    --exclude='config/mosquitto/passwd'

# Encrypt backups
echo -e "${YELLOW}Encrypting backups...${NC}"
openssl enc -aes-256-cbc -salt -in ${BACKUP_DIR}/${BACKUP_NAME}.sql \
    -out ${BACKUP_DIR}/${BACKUP_NAME}.sql.enc -k ${WHA_ENCRYPTION_KEY}
openssl enc -aes-256-cbc -salt -in ${BACKUP_DIR}/${BACKUP_NAME}.rdb \
    -out ${BACKUP_DIR}/${BACKUP_NAME}.rdb.enc -k ${WHA_ENCRYPTION_KEY}

# Remove unencrypted backups
rm ${BACKUP_DIR}/${BACKUP_NAME}.sql
rm ${BACKUP_DIR}/${BACKUP_NAME}.rdb

# Create manifest
cat > ${BACKUP_DIR}/${BACKUP_NAME}-manifest.txt <<EOF
WHA Backup Manifest
===================
Date: $(date)
PostgreSQL Backup: ${BACKUP_NAME}.sql.enc
Redis Backup: ${BACKUP_NAME}.rdb.enc
Config Backup: ${BACKUP_NAME}-config.tar.gz

Restore Instructions:
1. Decrypt files: openssl enc -aes-256-cbc -d -in FILE.enc -out FILE -k \$WHA_ENCRYPTION_KEY
2. Restore PostgreSQL: docker-compose exec -T postgres psql -U wha wha < ${BACKUP_NAME}.sql
3. Restore Redis: docker cp ${BACKUP_NAME}.rdb \$(docker-compose ps -q redis):/data/dump.rdb
4. Extract config: tar -xzf ${BACKUP_NAME}-config.tar.gz
5. Restart services: docker-compose restart
EOF

# Cleanup old backups (keep last 7 days)
echo -e "${YELLOW}Cleaning up old backups...${NC}"
find ${BACKUP_DIR} -name "wha-backup-*" -mtime +7 -delete

# Calculate backup size
BACKUP_SIZE=$(du -sh ${BACKUP_DIR}/${BACKUP_NAME}* | awk '{print $1}' | paste -sd+ | bc)

echo -e "${GREEN}✓ Backup complete!${NC}"
echo -e "Backup location: ${BACKUP_DIR}/${BACKUP_NAME}*"
echo -e "Total size: ${BACKUP_SIZE}"
echo ""
echo -e "${YELLOW}⚠ Remember to copy backups to off-site storage!${NC}"
