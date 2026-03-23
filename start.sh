#!/bin/sh
set -e

export NODE_ENV=production

# Backend (Express) — must match nginx upstream backend_api
export PORT="${PORT:-5000}"
cd /app/backend
node server.js &
BACKEND_PID=$!

# Next.js standalone
cd /app/frontend
export HOSTNAME=0.0.0.0
export PORT=3000
node server.js &
NEXT_PID=$!

# Allow Node to bind before nginx starts proxying
sleep 5

shutdown() {
  kill "$NEXT_PID" 2>/dev/null || true
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 0
}
trap shutdown INT TERM

nginx -g 'daemon off;'
