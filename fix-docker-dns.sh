#!/bin/bash
# Quick script to fix Docker DNS issues

echo "🔧 Fixing Docker DNS Configuration"
echo "==================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "⚠️  This script needs sudo privileges"
   echo "Running with sudo..."
   sudo "$0" "$@"
   exit $?
fi

# Backup existing daemon.json if it exists
if [ -f /etc/docker/daemon.json ]; then
    echo "📦 Backing up existing daemon.json..."
    cp /etc/docker/daemon.json /etc/docker/daemon.json.backup
    echo "✓ Backup created: /etc/docker/daemon.json.backup"
fi

# Create or update daemon.json
echo ""
echo "📝 Updating Docker daemon configuration..."

cat > /etc/docker/daemon.json << 'EOF'
{
  "dns": ["8.8.8.8", "8.8.4.4", "1.1.1.1"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

echo "✓ Configuration updated"

# Restart Docker
echo ""
echo "🔄 Restarting Docker..."
systemctl restart docker

# Wait for Docker to start
sleep 3

# Check if Docker is running
if systemctl is-active --quiet docker; then
    echo "✓ Docker restarted successfully"
    echo ""
    echo "✅ DNS configuration fixed!"
    echo ""
    echo "You can now run: ./setup-docker.sh"
else
    echo "❌ Failed to restart Docker"
    echo "Please check: sudo journalctl -u docker"
    exit 1
fi
