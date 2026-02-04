# Financy - Docker Deployment Guide

Complete guide for deploying Financy using Docker on production servers.

## 📋 Prerequisites

- Ubuntu 22.04+ (or similar Linux distribution)
- Minimum 2GB RAM (4GB recommended)
- Domain name pointing to your server
- Ports 80 and 443 open

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/alexcasu73/Financy.git
cd Financy
```

### 2. Run Setup Script

```bash
./setup-docker.sh
```

The script will:
- Install Docker and Docker Compose (if needed)
- Generate secure credentials
- Configure all services
- Setup SSL with Let's Encrypt
- Start all containers

### 3. Access Application

After setup completes:
- **Web App**: `https://your-domain.com`
- **n8n**: `https://your-domain.com/n8n`

## 📦 What's Included

The Docker setup includes:

- **PostgreSQL**: Main database
- **Redis**: Caching and session storage
- **API**: Fastify backend
- **Web**: Next.js frontend
- **n8n**: Workflow automation
- **Nginx**: Reverse proxy
- **Certbot**: SSL certificate management

## 🔧 Configuration

### Environment Variables

All configuration is in `.env.production`:

```env
# Database
POSTGRES_USER=financy
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=financy

# API Keys
JWT_SECRET=your-jwt-secret
INTERNAL_API_KEY=your-internal-key
ANTHROPIC_API_KEY=sk-ant-your-key

# n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-password

# URLs
NEXT_PUBLIC_API_URL=https://your-domain.com/api
N8N_WEBHOOK_URL=https://your-domain.com/webhook
```

### Generate Secure Credentials

```bash
# JWT Secret
openssl rand -base64 32

# Internal API Key
openssl rand -hex 32

# Password
openssl rand -base64 16
```

## 📊 Management Commands

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f n8n
```

### Restart Services

```bash
# All services
docker compose -f docker-compose.prod.yml restart

# Specific service
docker compose -f docker-compose.prod.yml restart api
```

### Stop Services

```bash
docker compose -f docker-compose.prod.yml down
```

### Start Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Check Status

```bash
docker compose -f docker-compose.prod.yml ps
```

## 🔄 Updates

To update to the latest version:

```bash
./update-docker.sh
```

This will:
1. Backup current database
2. Pull latest code
3. Rebuild containers
4. Run migrations
5. Restart services

## 💾 Backup & Restore

### Create Backup

```bash
./backup-docker.sh
```

Backups are stored in `backups/` directory.

### Restore from Backup

```bash
./restore-docker.sh backups/20240101_120000.tar.gz
```

### Automated Backups

Add to crontab for daily backups:

```bash
crontab -e

# Add this line (daily at 2 AM)
0 2 * * * cd /path/to/Financy && ./backup-docker.sh
```

## 🔒 SSL Certificate

SSL is automatically configured during setup. To renew manually:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

## 🗄️ Database Access

### Connect to PostgreSQL

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U financy
```

### Run Migrations

```bash
docker compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

### Database Backup (Manual)

```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U financy financy > backup.sql
```

## 🔍 Troubleshooting

### View Container Logs

```bash
docker compose -f docker-compose.prod.yml logs -f [service-name]
```

### Restart a Service

```bash
docker compose -f docker-compose.prod.yml restart [service-name]
```

### Check Container Health

```bash
docker compose -f docker-compose.prod.yml ps
docker inspect financy-api
```

### Clean Up

```bash
# Remove stopped containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove unused volumes (⚠️ WARNING: Data loss!)
docker volume prune -f
```

### Common Issues

#### Port Already in Use

Check what's using the port:
```bash
sudo lsof -i :80
sudo lsof -i :443
```

Kill the process or change the port in `docker-compose.prod.yml`.

#### Database Connection Failed

Check PostgreSQL is running:
```bash
docker compose -f docker-compose.prod.yml ps postgres
docker compose -f docker-compose.prod.yml logs postgres
```

#### SSL Certificate Failed

Ensure:
- Domain points to your server
- Ports 80 and 443 are open
- No firewall blocking access

Try manual certificate:
```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your@email.com \
  --agree-tos \
  -d your-domain.com
```

## 📈 Monitoring

### Resource Usage

```bash
# All containers
docker stats

# Specific container
docker stats financy-api
```

### Disk Usage

```bash
# Docker disk usage
docker system df

# Volume sizes
docker volume ls
```

## 🔐 Security Best Practices

1. **Change Default Credentials**: Always change default passwords
2. **Firewall**: Use UFW or iptables to restrict access
3. **Regular Updates**: Keep Docker and system updated
4. **Backups**: Automate daily backups
5. **SSL**: Always use HTTPS in production
6. **Secrets**: Never commit `.env.production` to git

### Setup Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
```

## 🌐 Production Checklist

- [ ] Domain configured and pointing to server
- [ ] SSL certificate obtained
- [ ] Database password changed
- [ ] API keys configured
- [ ] n8n workflows imported
- [ ] Telegram bot configured (if using)
- [ ] Firewall configured
- [ ] Backups automated
- [ ] Monitoring setup
- [ ] First user created

## 📞 Support

For issues and questions:
- GitHub Issues: https://github.com/alexcasu73/Financy/issues
- Documentation: Check README.md

## 📝 Notes

- The setup script creates a `credentials.txt` file with all generated passwords
- **IMPORTANT**: Save these credentials securely and delete the file
- Default timezone is Europe/Rome (change in `.env.production`)
- n8n workflows must be imported manually after setup

---

**Happy Trading! 🚀**
