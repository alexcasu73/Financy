#!/bin/bash

# n8n Startup Script for Financy
# Uses project-local data directory to persist workflows

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKFLOWS_DIR="$SCRIPT_DIR/workflows"
N8N_DATA_DIR="$SCRIPT_DIR/.n8n-data"
N8N_DB="$N8N_DATA_DIR/.n8n/database.sqlite"

# Set n8n to use project-local directory
export N8N_USER_FOLDER="$N8N_DATA_DIR"

# Disable auth for development (allows webhooks without user setup)
export N8N_BASIC_AUTH_ACTIVE=false
export N8N_SKIP_WEBHOOK_DEREGISTRATION_SHUTDOWN=true

echo "Starting n8n for Financy..."
echo "Data directory: $N8N_DATA_DIR"

# Create data directory if needed
mkdir -p "$N8N_DATA_DIR"

# Check if workflows need to be imported
WORKFLOW_COUNT=$(sqlite3 "$N8N_DB" "SELECT COUNT(*) FROM workflow_entity;" 2>/dev/null || echo "0")

if [ "$WORKFLOW_COUNT" -lt 5 ]; then
    echo "Importing workflows..."

    for f in "$WORKFLOWS_DIR"/*.json; do
        echo "  - $(basename "$f")"
        npx n8n import:workflow --input="$f" 2>/dev/null
    done

    echo "Publishing and activating workflows..."
    sqlite3 "$N8N_DB" "SELECT id FROM workflow_entity;" 2>/dev/null | while read id; do
        npx n8n publish:workflow --id="$id" 2>/dev/null
    done

    # Activate all workflows
    sqlite3 "$N8N_DB" "UPDATE workflow_entity SET active = 1;"

    echo "Workflows ready!"
else
    echo "Workflows already imported ($WORKFLOW_COUNT found)"
fi

echo ""
echo "Starting n8n server..."
echo "Editor: http://localhost:5678"
echo ""

exec npx n8n start
