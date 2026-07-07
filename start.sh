#!/bin/sh
set -e

export NODE_ENV=production

# Backend (Express) — must match nginx upstream backend_api
export PORT="${PORT:-5000}"
cd /app/backend
node server.js &
BACKEND_PID=$!

wait_for_backend() {
  i=0
  while [ "$i" -lt 60 ]; do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "ERROR: backend exited during startup (check MODULE_NOT_FOUND, DB_HOST, DB credentials)"
      wait "$BACKEND_PID" 2>/dev/null || true
      exit 1
    fi
    if node -e "require('http').get('http://127.0.0.1:5000/',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" 2>/dev/null; then
      echo "Backend ready on :5000"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "ERROR: backend not ready after 60s (check DB connection)"
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 1
}

wait_for_backend

# Next.js standalone
cd /app/frontend
export HOSTNAME=0.0.0.0
export PORT=3000
node server.js &
NEXT_PID=$!

sleep 2
if ! kill -0 "$NEXT_PID" 2>/dev/null; then
  echo "ERROR: Next.js exited during startup"
  exit 1
fi

shutdown() {
  kill "$NEXT_PID" 2>/dev/null || true
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 0
}
trap shutdown INT TERM

nginx -g 'daemon off;'
