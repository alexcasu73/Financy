#!/bin/bash
cd /Users/alessandrocasu/Develop/Financy

export N8N_USER_FOLDER=".n8n-data"
export N8N_ENCRYPTION_KEY="KlcKDwiIm/GGnO3/9/XCrYrZOfI7c8xj"
export N8N_USER_MANAGEMENT_JWT_SECRET="financy-n8n-jwt-secret-keep-sessions"
export N8N_SECURE_COOKIE=false

npx n8n start
